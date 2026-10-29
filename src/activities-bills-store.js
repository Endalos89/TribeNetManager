'use strict';
const { allocation, forecast, optimizeTools, predicted, provisionTarget, retentionCap } = require('./activities-hunting-engine');
const { canonicalTurnKey } = require('./turn-key');

const canon = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const whole = v => Math.max(0,Math.floor(Number(v)||0));
const validNumber = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const code = v => String(v || '').trim().toLowerCase();
const BILL_COLUMNS = `id, unit, skill, mode, months, yield_mode AS yieldMode,
  load_percent AS loadPercent, priority, paused, created_at AS createdAt, updated_at AS updatedAt`;

class ActivityBillStore {
  constructor(turnDb) {
    this.owner = turnDb;
    this.db = turnDb.db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS running_activity_bills (
        id INTEGER PRIMARY KEY, unit TEXT NOT NULL, skill TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'months', months REAL NOT NULL DEFAULT 1,
        yield_mode TEXT NOT NULL DEFAULT 'average',
        load_percent REAL, priority INTEGER NOT NULL DEFAULT 0,
        paused INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_running_activity_bills_priority ON running_activity_bills(priority,id);
      CREATE TABLE IF NOT EXISTS generated_activity_links (
        bill_id INTEGER NOT NULL, turn_key TEXT NOT NULL, activity_id INTEGER,
        transfer_id INTEGER, PRIMARY KEY(bill_id,turn_key)
      );
      CREATE TABLE IF NOT EXISTS skipped_activity_bills (
        bill_id INTEGER NOT NULL, turn_key TEXT NOT NULL,
        PRIMARY KEY(bill_id,turn_key)
      );
    `);
    const columns = new Set(this.db.prepare('PRAGMA table_info(planned_activities)').all().map(x=>x.name));
    if(!columns.has('implements_json'))this.db.exec("ALTER TABLE planned_activities ADD COLUMN implements_json TEXT NOT NULL DEFAULT '[]'");
    if(!columns.has('generated_locked'))this.db.exec('ALTER TABLE planned_activities ADD COLUMN generated_locked INTEGER NOT NULL DEFAULT 0');
    const transferColumns = new Set(this.db.prepare('PRAGMA table_info(planned_transfers)').all().map(x=>x.name));
    if(!transferColumns.has('derived_bill_id'))this.db.exec('ALTER TABLE planned_transfers ADD COLUMN derived_bill_id INTEGER');
  }
  list() {
    return this.db.prepare(`SELECT ${BILL_COLUMNS} FROM running_activity_bills ORDER BY priority,id`).all()
      .map(row=>({...row,paused:Boolean(row.paused)}));
  }
  save(value) {
    const unit=code(value?.unit),id=value?.id==null?null:Number(value.id);
    if(!/^\d{4}(?:[efgc]\d+)?$/.test(unit))throw Error('Select a valid unit for this Hunting Bill.');
    const mode=String(value?.mode||'months');
    if(!['months','maximise'].includes(mode))throw Error('Hunting Bills support months or maximise.');
    const months=Number(value?.months??1);
    if(mode==='months'&&(!Number.isFinite(months)||months<0||months>120))throw Error('Months must be between 0 and 120.');
    const yieldMode=String(value?.yieldMode||'average');
    if(!['optimistic','average','conservative'].includes(yieldMode))throw Error('Choose Optimistic, Average or Conservative.');
    const load=value?.loadPercent===''||value?.loadPercent==null?null:Number(value.loadPercent);
    if(load!==null&&(!Number.isFinite(load)||load<=0||load>100))throw Error('Capacity percentage must be between 0 and 100.');
    const now=new Date().toISOString();
    if(id!==null){
      if(!this.db.prepare('SELECT 1 FROM running_activity_bills WHERE id=?').get(id))throw Error('Running Order not found.');
      this.db.prepare(`UPDATE running_activity_bills SET unit=?, mode=?, months=?,yield_mode=?,
        load_percent=?,updated_at=? WHERE id=?`).run(unit,mode,months,yieldMode,load,now,id);
    }else{
      const highest=this.db.prepare('SELECT COALESCE(MAX(priority),0) AS n FROM running_activity_bills').get().n;
      const result=this.db.prepare(`INSERT INTO running_activity_bills
        (unit,skill,mode,months,yield_mode,load_percent,priority,paused,created_at,updated_at)
        VALUES (?,'HUNTING',?,?,?,?,?,0,?,?)`).run(unit,mode,months,yieldMode,load,highest+1,now,now);
      return this.list().find(row=>row.id===Number(result.lastInsertRowid));
    }
    return this.list().find(row=>row.id===id);
  }
  move(id, direction) {
    id=Number(id);const list=this.list(),idx=list.findIndex(x=>x.id===id),next=idx+(Number(direction)<0?-1:1);
    if(idx<0||next<0||next>=list.length)return this.list();
    this.db.prepare('UPDATE running_activity_bills SET priority=?,updated_at=? WHERE id=?')
      .run(list[next].priority,new Date().toISOString(),id);
    this.db.prepare('UPDATE running_activity_bills SET priority=?,updated_at=? WHERE id=?')
      .run(list[idx].priority,new Date().toISOString(),list[next].id);
    return this.list();
  }
  pause(id, paused) {
    this.db.prepare('UPDATE running_activity_bills SET paused=?,updated_at=? WHERE id=?')
      .run(paused?1:0,new Date().toISOString(),Number(id));
    return this.list();
  }
  remove(id,turnKey) {
    const key=canonicalTurnKey(turnKey)||turnKey;
    this.db.exec('BEGIN IMMEDIATE');
    try{
      if(key)this.clearGenerated(Number(id),key,{explicit:true});
      this.db.prepare('DELETE FROM skipped_activity_bills WHERE bill_id=?').run(Number(id));
      this.db.prepare('DELETE FROM running_activity_bills WHERE id=?').run(Number(id));
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
    return this.list();
  }
  clearGenerated(id,turnKey,{explicit=false}={}) {
    const link=this.linkFor(id,turnKey);
    if(!link)return true;
    const row=link.activity_id?this.db.prepare('SELECT generated_locked FROM planned_activities WHERE id=?').get(link.activity_id):null;
    // A locked row is the user's edit for this turn. Keep its link and
    // associated retention row until the user explicitly skips/deletes it.
    if(row?.generated_locked&&!explicit)return false;
    if(link.activity_id)this.db.prepare('DELETE FROM planned_activities WHERE id=?').run(link.activity_id);
    if(link.transfer_id)this.db.prepare('DELETE FROM planned_transfers WHERE id=? AND derived_bill_id=?').run(link.transfer_id,id);
    this.db.prepare('DELETE FROM generated_activity_links WHERE bill_id=? AND turn_key=?').run(id,turnKey);
    return true;
  }
  skip(id,turnKey){
    id=Number(id);
    const key=canonicalTurnKey(turnKey)||turnKey;
    if(!key||!this.db.prepare('SELECT 1 FROM running_activity_bills WHERE id=?').get(id))throw Error('Select an existing Bill and turn.');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      // Explicit user intent: remove only the row belonging to this Bill.
      this.clearGenerated(id,key,{explicit:true});
      this.db.prepare('INSERT OR IGNORE INTO skipped_activity_bills(bill_id,turn_key) VALUES (?,?)').run(id,key);
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
    return {id,turnKey:key,skipped:true};
  }
  reset(id,turnKey){
    const key=canonicalTurnKey(turnKey)||turnKey;
    this.db.prepare('DELETE FROM skipped_activity_bills WHERE bill_id=? AND turn_key=?').run(Number(id),key);
    return {id:Number(id),turnKey:key,skipped:false};
  }
  linkFor(id,turnKey){
    return this.db.prepare('SELECT * FROM generated_activity_links WHERE bill_id=? AND turn_key=?').get(id,turnKey)||null;
  }
  apply(turnKey, units) {
    const key=canonicalTurnKey(turnKey)||turnKey;
    if(!key||!Array.isArray(units)||!units.length)throw Error('A turn and confirmed unit context are required. No orders were changed.');
    const unitMap=new Map(units.map(unit=>[code(unit.code||unit.unit||unit.unitCode),unit]));
    const bills=this.list(),active=bills.filter(x=>!x.paused);
    const missing=active.filter(x=>!unitMap.has(code(x.unit)));
    if(missing.length)throw Error('Missing confirmed context for '+missing.map(x=>x.unit).join(', ')+'. No orders were changed.');
    const manual=this.owner.listActivities(key);
    const transfers=this.owner.listTransfers(key);
    const availableWorkers=new Map();
    for(const unit of units){
      const unitCode=code(unit.code||unit.unit||unit.unitCode);
      if(active.some(b=>code(b.unit)===unitCode)&&!validNumber(unit.workersAvailable))
        throw Error('Unknown available worker count for '+unitCode);
      const committed=manual.filter(row=>code(row.unit)===unitCode
        && !this.db.prepare('SELECT 1 FROM generated_activity_links WHERE turn_key=? AND activity_id=?').get(key,row.id))
        .reduce((sum,row)=>sum+whole(row.people),0);
      const locked=manual.filter(row=>code(row.unit)===unitCode&&row.generatedLocked).reduce((n,row)=>n+whole(row.people),0);
      availableWorkers.set(unitCode,Math.max(0,whole(unit.workersAvailable)-committed-locked-whole(unit.externalReservedWorkers)));
    }
    const pools=new Map(),claims=new Map(),projectedOutputs=new Map(),summaries=[];
    const sourceFor=unit=>code(unit.goodsTribe||unit.code||unit.unit||unit.unitCode);
    for(const unit of units){
      const pool=sourceFor(unit);
      if(!pools.has(pool))pools.set(pool,{eaters:0});
      pools.get(pool).eaters+=whole(unit.eaters);
    }
    // Manually committed tool selections reserve first. Prior generated rows
    // are superseded by this pass; locked generated rows are not.
    for(const row of manual){
      const linked=this.db.prepare('SELECT 1 FROM generated_activity_links WHERE turn_key=? AND activity_id=?').get(key,row.id);
      if(linked&&!row.generatedLocked)continue;
      const performer=unitMap.get(code(row.unit));
      if(!performer)continue;
      const pool=sourceFor(performer),already=claims.get(pool)||{};
      for(const tool of row.implements||[]){
        const name=canon(tool.name);
        already[name]=(already[name]||0)+whole(tool.quantity);
      }
      claims.set(pool,already);
    }

    // Use existing saved BM Transfers for any movement-time provisions changes.
    // A same-unit retention row is output protection, NOT a stock transfer.
    const bm=transfers.filter(t=>t.timing==='BM'&&code(t.from)!==code(t.to));
    const moveStock=(owner,item)=>{
      let delta=0;
      for(const transfer of bm){
        if(canon(transfer.item)!==canon(item))continue;
        if(code(transfer.from)===owner)delta-=whole(transfer.quantity);
        if(code(transfer.to)===owner)delta+=whole(transfer.quantity);
      }
      return delta;
    };
    this.db.exec('BEGIN IMMEDIATE');
    try{
      for(const bill of bills){
        const context=unitMap.get(code(bill.unit));
        const link=this.linkFor(bill.id,key);
        if(this.db.prepare('SELECT 1 FROM skipped_activity_bills WHERE bill_id=? AND turn_key=?').get(bill.id,key)){
          summaries.push({id:bill.id,unit:bill.unit,status:'Skipped this turn',workers:0});
          continue;
        }
        if(bill.paused){
          const removed=this.clearGenerated(bill.id,key);
          summaries.push({id:bill.id,unit:bill.unit,status:removed?'Paused':'Paused; locked turn override preserved',workers:0});
          continue;
        }
        const retained=link?.activity_id?this.db.prepare('SELECT * FROM planned_activities WHERE id=?').get(link.activity_id):null;
        if(retained?.generated_locked){
          const reservedForBill=JSON.parse(retained.implements_json||'[]');
          const retainedWorkers=whole(retained.people);
          // Worker and tool claims for locked plans were already reserved above.
          const owner=sourceFor(context);
          const ownerContext=unitMap.get(owner)||context;
          const f=forecast({workers:retainedWorkers,skill:context.skill,terrain:context.terrain,month:context.month,
            waterBorders:context.waterBorders,effectiveAM:retainedWorkers+reservedForBill.reduce((sum,t)=>
              sum+whole(t.quantity)*(t.name==='Hunting Dog'?2:({ 'Advanced Trap':1,'Improved Trap':.15,'Trap':.1,'Snare':.05,'Arbalest':.2,'Bow':.15,'Sling':.1,'Net':.1,'Spear':.05,'Bone Spear':.05,'Stone Spear':.05,'Spetum':.05}[t.name]||0)),0)});
          const amount=predicted(f,bill.yieldMode);
          if(amount!=null)projectedOutputs.set(owner,(projectedOutputs.get(owner)||0)+amount);
          summaries.push({id:bill.id,unit:bill.unit,status:'Locked: this-turn manual override',workers:retainedWorkers,
            expected:amount,tools:reservedForBill,activityId:link.activity_id,transferId:link.transfer_id});
          continue;
        }
        const poolKey=sourceFor(context),poolUnit=unitMap.get(poolKey);
        if(!poolUnit){
          summaries.push({id:bill.id,unit:bill.unit,status:'Needs review: Goods Tribe inventory not available; existing draft preserved',workers:0});
          continue;
        }
        const goods=poolUnit.stock||{};
        if(!validNumber(context.month)||!context.terrain){
          summaries.push({id:bill.id,unit:bill.unit,status:'Needs review: Hunting month or terrain not verified; existing draft preserved',workers:0});
          continue;
        }
        if(!validNumber(poolUnit.provs)){
          summaries.push({id:bill.id,unit:bill.unit,status:'Needs review: Provisions baseline missing; existing draft preserved',workers:0});
          continue;
        }
        const pool=pools.get(poolKey)||{eaters:whole(context.eaters)};
        const stockNow=Number(poolUnit.provs);
        const expectedPreviously=projectedOutputs.get(poolKey)||0;
        const target=provisionTarget(bill.months,pool.eaters);
        const goal=Math.max(0,target.beforeEating-stockNow-moveStock(poolKey,'PROVS')-expectedPreviously);
        const workersMax=availableWorkers.get(code(bill.unit))||0;
        const reserved=claims.get(poolKey)||{};
        let result=bill.mode==='maximise'
          ?(function(){const tools=optimizeTools(workersMax,goods,reserved);
            const range=forecast({workers:workersMax,effectiveAM:tools.effectiveAM,
              skill:context.skill,terrain:context.terrain,month:context.month,waterBorders:context.waterBorders});
            return {workers:workersMax,tools:tools.implements,range,expected:predicted(range,bill.yieldMode),achievable:true};})()
          :allocation({workersAvailable:workersMax,goalProvs:goal,mode:bill.yieldMode,
            skill:context.skill,terrain:context.terrain,month:context.month,waterBorders:context.waterBorders,
            stock:goods,reservations:reserved});
        if(!result.range){
          summaries.push({id:bill.id,unit:bill.unit,status:'Needs review: Unknown Hunting yield for start terrain; existing draft preserved',workers:0});
          continue;
        }
        this.clearGenerated(bill.id,key);
        const now=new Date().toISOString();
        let activityId=null,transferId=null;
        if(result.workers>0){
          const added=this.db.prepare(`INSERT INTO planned_activities
            (turn_key,unit,activity_code,people,target,distinction,mining_direction,notes,created_at,updated_at,implements_json)
            VALUES (?,?,'HUNTING',?,'NONE','NONE','','',?,?,?)`)
            .run(key,bill.unit,result.workers,now,now,JSON.stringify(result.tools));
          activityId=Number(added.lastInsertRowid);
          availableWorkers.set(code(bill.unit),workersMax-result.workers);
          const next={...reserved};
          for(const item of result.tools)next[canon(item.name)]=(next[canon(item.name)]||0)+item.quantity;
          claims.set(poolKey,next);
          projectedOutputs.set(poolKey,expectedPreviously+(result.expected||0));
        }
        let warning='';
        if(bill.loadPercent!==null&&bill.loadPercent!==undefined){
          if(context.goodsTribe&&code(context.goodsTribe)!==code(bill.unit))warning='Weight limit unavailable while using a Goods Tribe';
          else{
            const perProvs=validNumber(context.provsWeight)?Number(context.provsWeight):1;
            const otherWeight=Number(context.otherMaxWeight);
            const cap=retentionCap({capacity:context.capacity,percent:bill.loadPercent,
              otherWeight:validNumber(context.otherMaxWeight)?otherWeight:null,provsWeight:perProvs});
            if(cap.quantity===null)warning=cap.warning;
            else if(cap.quantity===0)warning='No carrying capacity available for Provs; cannot safely write a zero-quantity retention row';
            else {
              const added=this.db.prepare(`INSERT INTO planned_transfers
                (turn_key,from_unit,to_unit,item,quantity,timing,notes,created_at,updated_at,derived_bill_id)
                VALUES (?,?,?,'PROVS',?,'BM','Automatic Hunting weight limit',?,?,?)`)
                .run(key,bill.unit,bill.unit,cap.quantity,now,now,bill.id);
              transferId=Number(added.lastInsertRowid);
              if(cap.warning)warning=cap.warning;
              if(bill.mode==='months'&&cap.quantity<target.beforeEating)warning+=(warning?'; ':'')+'Food-months target may be reduced by weight cap';
            }
          }
        }
        this.db.prepare(`INSERT INTO generated_activity_links(bill_id,turn_key,activity_id,transfer_id)
          VALUES (?,?,?,?)`).run(bill.id,key,activityId,transferId);
        summaries.push({id:bill.id,unit:bill.unit,workers:result.workers,expected:result.expected,
          min:result.range.min,max:result.range.max,tools:result.tools,goal:bill.mode==='months'?goal:null,
          status:warning||(!result.achievable?'Target not fully feasible':'Planned'),
          transferId,activityId});
      }
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
    return summaries;
  }
}
module.exports={ActivityBillStore};
