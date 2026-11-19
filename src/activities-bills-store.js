'use strict';
const { allocation, forecast, optimizeTools, predicted, provisionTarget, retentionCap, stockCount } = require('./activities-hunting-engine');
const { canonicalTurnKey } = require('./turn-key');
const livestock = require('./activities-livestock-engine');

const canon = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const whole = v => Math.max(0,Math.floor(Number(v)||0));
const validNumber = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const code = v => String(v || '').trim().toLowerCase();
const BILL_COLUMNS = `id, unit, skill, activity_code AS activityCode, animal, goal_item AS goalItem, quantity, mode, months, yield_mode AS yieldMode,
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
    const billColumns = new Set(this.db.prepare('PRAGMA table_info(running_activity_bills)').all().map(x=>x.name));
    if(!billColumns.has('activity_code'))this.db.exec("ALTER TABLE running_activity_bills ADD COLUMN activity_code TEXT NOT NULL DEFAULT 'HUNTING'");
    if(!billColumns.has('animal'))this.db.exec("ALTER TABLE running_activity_bills ADD COLUMN animal TEXT NOT NULL DEFAULT ''");
    if(!billColumns.has('goal_item'))this.db.exec("ALTER TABLE running_activity_bills ADD COLUMN goal_item TEXT NOT NULL DEFAULT ''");
    if(!billColumns.has('quantity'))this.db.exec("ALTER TABLE running_activity_bills ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0");
    this.db.exec(`CREATE TABLE IF NOT EXISTS auto_herding_orders (
      turn_key TEXT NOT NULL, unit TEXT NOT NULL, activity_id INTEGER NOT NULL,
      PRIMARY KEY (turn_key,unit)
    )`);
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
    if(!/^\d{4}(?:[efgc]\d+)?$/.test(unit))throw Error('Select a valid unit for this Running Order.');
    const previous=id!==null?this.list().find(row=>row.id===id):null;
    if(id!==null&&!previous)throw Error('Running Order not found.');
    const skill=String(value?.skill||previous?.skill||'HUNTING').toUpperCase();
    const processing=['GUTTING','SKINNING','BONING'].includes(skill);
    if(skill!=='HUNTING'&&!processing)throw Error('Unsupported Running Order skill.');
    const activityCode=processing?(livestock.activityKey(value?.activityCode||previous?.activityCode||skill)): 'HUNTING';
    if(processing&&(!activityCode||!livestock.COMBINATIONS[activityCode].includes(skill)))
      throw Error('Select a processing activity that includes '+skill+'.');
    const animal=processing?livestock.animalKey(value?.animal||previous?.animal):'';
    if(processing&&!livestock.baseRate(activityCode,animal))throw Error('This animal cannot be processed by the selected combination.');
    const mode=String(value?.mode||(processing?'maximise':'months'));
    if(!((processing?['stock','maximise']:['months','maximise']).includes(mode)))
      throw Error(processing?'Processing Bills support Maintain Stock or Maximise.':'Hunting Bills support months or maximise.');
    const months=processing?0:Number(value?.months??1);
    if(!processing&&mode==='months'&&(!Number.isFinite(months)||months<0||months>120))
      throw Error('Months must be between 0 and 120.');
    const yieldMode=processing?'average':String(value?.yieldMode||'average');
    if(!['optimistic','average','conservative'].includes(yieldMode))throw Error('Invalid yield basis.');
    const load=processing?null:(value?.loadPercent===''||value?.loadPercent==null?null:Number(value.loadPercent));
    if(load!==null&&(!Number.isFinite(load)||load<=0||load>100))
      throw Error('Capacity percentage must be between 0 and 100.');
    const outputChoices=processing?Object.keys(livestock.produce(activityCode,animal,1).outputs).filter(x=>x!=='PROVS'):[];
    const goalItem=processing?String(value?.goalItem||previous?.goalItem||livestock.primaryOutput(activityCode)).toUpperCase():'';
    if(processing&&!outputChoices.includes(goalItem))throw Error('Choose an output produced by this processing activity.');
    const quantity=processing?Number(value?.quantity??previous?.quantity??0):0;
    if(processing&&(!Number.isInteger(quantity)||quantity<0||quantity>100000000))
      throw Error('Stock target must be a nonnegative whole number.');
    const now=new Date().toISOString();
    if(id!==null){
      this.db.prepare(`UPDATE running_activity_bills SET unit=?,skill=?,activity_code=?,animal=?,goal_item=?,quantity=?,
        mode=?,months=?,yield_mode=?,load_percent=?,updated_at=? WHERE id=?`)
        .run(unit,skill,activityCode,animal,goalItem,quantity,mode,months,yieldMode,load,now,id);
    }else{
      const highest=this.db.prepare('SELECT COALESCE(MAX(priority),0) AS n FROM running_activity_bills').get().n;
      const result=this.db.prepare(`INSERT INTO running_activity_bills
        (unit,skill,activity_code,animal,goal_item,quantity,mode,months,yield_mode,load_percent,priority,paused,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?)`)
        .run(unit,skill,activityCode,animal,goalItem,quantity,mode,months,yieldMode,load,highest+1,now,now);
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
    // Prior automatic herding drafts are regenerated, never counted as manual commitments.
    const previousHerds=this.db.prepare('SELECT * FROM auto_herding_orders WHERE turn_key=?').all(key);
    const automaticIds=new Set(previousHerds.map(row=>row.activity_id));
    const manual=this.owner.listActivities(key).filter(row=>!automaticIds.has(row.id));
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
    const pools=new Map(),claims=new Map(),projectedOutputs=new Map(),summaries=[],dogClaims=new Map();
    const processingOutputs=new Map(),animalsSpent=new Map(),skillWorkers=new Map();
    const outputPool=pool=>{if(!processingOutputs.has(pool))processingOutputs.set(pool,{});return processingOutputs.get(pool);};
    const spentPool=pool=>{if(!animalsSpent.has(pool))animalsSpent.set(pool,{});return animalsSpent.get(pool);};
    const rootOf=unit=>code(typeof unit==='string'?unit:(unit?.code||unit?.unit||unit?.unitCode)).slice(0,4);
    const claimSkills=(unit,activity,workers)=>{
      const bits=livestock.COMBINATIONS[livestock.activityKey(activity)]||[];
      for(const skill of bits){const k=rootOf(unit)+'/'+skill;skillWorkers.set(k,(skillWorkers.get(k)||0)+whole(workers));}
    };
    const limitFor=(unit,activity)=>{
      const bits=livestock.COMBINATIONS[livestock.activityKey(activity)]||[];
      return bits.reduce((min,skill)=>{
        const level=unit.skillLevels?.[skill];
        const cap=livestock.capForLevel(level);
        const used=skillWorkers.get(rootOf(unit.code)+'/'+skill)||0;
        return Math.min(min,Math.max(0,cap-used));
      },Infinity);
    };
    const countOutput=(pool,outputs)=>{
      const totals=outputPool(pool);
      for(const [item,n] of Object.entries(outputs||{}))totals[item]=(totals[item]||0)+n;
    };
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
        if(name==='HUNTING DOG')continue; // Animals are not legal implement slots.
        already[name]=(already[name]||0)+whole(tool.quantity);
      }
      if(canon(row.activityCode)==='HUNTING'){
        const stock=unitMap.get(pool)?.stock||{};
        const left=Math.max(0,stockCount(stock,'Hunting Dog')-whole(already['HUNTING DOG']));
        const dogs=Math.min(whole(row.people),left);
        already['HUNTING DOG']=(already['HUNTING DOG']||0)+dogs;
        dogClaims.set(row.id,dogs);
      }
      claims.set(pool,already);
      const activity=livestock.activityKey(row.activityCode);
      if(activity){
        const animal=livestock.animalKey(row.target);
        if(animal&&livestock.baseRate(activity,animal)){
          const knives=(row.implements||[]).filter(t=>canon(t.name)==='KNIFE').reduce((sum,t)=>sum+whole(t.quantity),0);
          const prior=spentPool(pool),available=Math.max(0,livestock.stockCount(unitMap.get(pool)?.stock||{},animal)-whole(prior[animal]));
          const result=livestock.process({activity,animal,workers:row.people,knives,animalsAvailable:available});
          prior[animal]=(prior[animal]||0)+result.animals;
          countOutput(pool,result.outputs);
          claimSkills(performer,activity,row.people);
          if(result.outputs.PROVS)projectedOutputs.set(pool,(projectedOutputs.get(pool)||0)+result.outputs.PROVS);
        }
      }
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
        if(bill.skill!=='HUNTING'){
          const activity=livestock.activityKey(bill.activityCode||bill.skill);
          const animal=livestock.animalKey(bill.animal);
          const poolKey=sourceFor(context),poolUnit=unitMap.get(poolKey);
          if(!activity||!animal||!livestock.COMBINATIONS[activity]?.includes(bill.skill)||!livestock.baseRate(activity,animal)){
            summaries.push({id:bill.id,unit:bill.unit,status:'Needs review: invalid processing activity/animal'});
            continue;
          }
          if(retained?.generated_locked){
            summaries.push({id:bill.id,unit:bill.unit,skill:bill.skill,status:'Locked: this-turn manual override',workers:whole(retained.people),activityId:link.activity_id});
            continue;
          }
          if(!poolUnit||!poolUnit.stock){
            summaries.push({id:bill.id,unit:bill.unit,status:'Needs review: Goods Tribe animal stock not verified; existing draft preserved'});
            continue;
          }
          const pool=spentPool(poolKey),available=Math.max(0,livestock.stockCount(poolUnit.stock,animal)-whole(pool[animal]));
          const workerLimit=Math.min(availableWorkers.get(code(bill.unit))||0,limitFor(context,activity));
          const knownKnives=livestock.stockCount(poolUnit.stock,'KNIFE');
          const knivesAvailable=Math.max(0,knownKnives-whole((claims.get(poolKey)||{}).KNIFE));
          const madeBefore=whole(outputPool(poolKey)[bill.goalItem]);
          const needed=bill.mode==='maximise'?Infinity:
            Math.max(0,whole(bill.quantity)-livestock.stockCount(poolUnit.stock,bill.goalItem)-madeBefore);
          const result=livestock.allocateProcessing({activity,animal,workerLimit,knivesAvailable,
            animalsAvailable:available,need:needed,goalItem:bill.goalItem});
          this.clearGenerated(bill.id,key);
          const now=new Date().toISOString();
          let activityId=null;
          if(result.workers>0){
            const selected=result.knives?[{name:'KNIFE',quantity:result.knives}]:[];
            const row=this.db.prepare(`INSERT INTO planned_activities
              (turn_key,unit,activity_code,people,target,distinction,mining_direction,notes,created_at,updated_at,implements_json)
              VALUES (?,?,?,?,?,'NONE','','',?,?,?)`)
              .run(key,bill.unit,activity,result.workers,animal,now,now,JSON.stringify(selected));
            activityId=Number(row.lastInsertRowid);
            pool[animal]=(pool[animal]||0)+result.animals;
            countOutput(poolKey,result.outputs);
            claimSkills(context,activity,result.workers);
            availableWorkers.set(code(bill.unit),(availableWorkers.get(code(bill.unit))||0)-result.workers);
            if(result.knives){
              const reserved=claims.get(poolKey)||{};
              reserved.KNIFE=(reserved.KNIFE||0)+result.knives;claims.set(poolKey,reserved);
            }
            if(result.outputs.PROVS)projectedOutputs.set(poolKey,(projectedOutputs.get(poolKey)||0)+result.outputs.PROVS);
          }
          this.db.prepare('INSERT INTO generated_activity_links(bill_id,turn_key,activity_id,transfer_id) VALUES (?,?,?,NULL)')
            .run(bill.id,key,activityId);
          summaries.push({id:bill.id,unit:bill.unit,skill:bill.skill,workers:result.workers,
            animals:result.animals,outputs:result.outputs,activityId,
            status:!result.workers?(needed===0?'Stock target reached':available===0?'No animals available':'No available processing workers'):'Planned'});
          continue;
        }
        if(retained?.generated_locked){
          const reservedForBill=JSON.parse(retained.implements_json||'[]');
          const retainedWorkers=whole(retained.people);
          // Worker and tool claims for locked plans were already reserved above.
          const owner=sourceFor(context);
          const ownerContext=unitMap.get(owner)||context;
          const f=forecast({workers:retainedWorkers,skill:context.skill,terrain:context.terrain,month:context.month,
            waterBorders:context.waterBorders,effectiveAM:retainedWorkers+reservedForBill.reduce((sum,t)=>
              sum+whole(t.quantity)*({ 'Advanced Trap':1,'Improved Trap':.15,'Trap':.1,'Snare':.05,'Arbalest':.2,'Bow':.15,'Sling':.1,'Net':.1,'Spear':.05,'Bone Spear':.05,'Stone Spear':.05,'Spetum':.05}[t.name]||0),0)
             +(dogClaims.get(link.activity_id)||0)*2});
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
        if(!validNumber(context.month)||!context.terrain||!validNumber(context.skill)){
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
            return {workers:workersMax,tools:tools.implements,huntingDogs:tools.huntingDogs,range,expected:predicted(range,bill.yieldMode),achievable:true};})()
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
            VALUES (?,?,'HUNTING',?,'PROVS','NONE','','',?,?,?)`)
            .run(key,bill.unit,result.workers,now,now,JSON.stringify(result.tools));
          activityId=Number(added.lastInsertRowid);
          availableWorkers.set(code(bill.unit),workersMax-result.workers);
          const next={...reserved};
          for(const item of result.tools)next[canon(item.name)]=(next[canon(item.name)]||0)+item.quantity;
          if(result.huntingDogs)next['HUNTING DOG']=(next['HUNTING DOG']||0)+result.huntingDogs;
           claims.set(poolKey,next);
          projectedOutputs.set(poolKey,expectedPreviously+(result.expected||0));
        }
        let warning='';
        if(bill.loadPercent!==null&&bill.loadPercent!==undefined){
          if(context.goodsTribe&&code(context.goodsTribe)!==code(bill.unit))warning='Weight limit unavailable while using a Goods Tribe';
          else{
            const perProvs=validNumber(context.provsWeight)?Number(context.provsWeight):10;
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
      // Rebuild Herding after manual AND recurring processing have reserved
      // slaughtered animals; each combined order consumes its animals once.
      // A unit gets at most one HERDING row for its surviving herd.
      for(const old of previousHerds){
        this.db.prepare('DELETE FROM planned_activities WHERE id=?').run(old.activity_id);
      }
      this.db.prepare('DELETE FROM auto_herding_orders WHERE turn_key=?').run(key);
      for(const unit of units){
        const unitCode=code(unit.code||unit.unit||unit.unitCode);
        if(!unitCode)continue;
        const herd=livestock.staffForHerd(unit.stock||{},spentPool(unitCode),{atSea:Boolean(unit.atSea)});
        if(!herd.workers)continue;
        if(manual.some(row=>code(row.unit)===unitCode&&canon(row.activityCode)==='HERDING')){
          summaries.push({unit:unitCode,skill:'HERDING',status:'Manual Herding order retained; automatic duplicate suppressed'});
          continue;
        }
        if(!validNumber(unit.workersAvailable)){
          summaries.push({unit:unitCode,skill:'HERDING',status:'Needs review: herding workforce not verified'});
          continue;
        }
        const spare=availableWorkers.get(unitCode)||0;
        if(herd.workers>spare){
          summaries.push({unit:unitCode,skill:'HERDING',status:'Needs review: '+herd.workers+' herders required; only '+spare+' workers remain'});
          continue;
        }
        const now=new Date().toISOString();
        const inserted=this.db.prepare(`INSERT INTO planned_activities
          (turn_key,unit,activity_code,people,target,distinction,mining_direction,notes,created_at,updated_at,implements_json)
          VALUES (?,?,'HERDING',?,'NONE','NONE','','',?,?,'[]')`)
          .run(key,unitCode,herd.workers,now,now);
        this.db.prepare('INSERT INTO auto_herding_orders(turn_key,unit,activity_id) VALUES (?,?,?)')
          .run(key,unitCode,Number(inserted.lastInsertRowid));
        availableWorkers.set(unitCode,spare-herd.workers);
        summaries.push({unit:unitCode,skill:'HERDING',workers:herd.workers,status:'Automatically herding '+Object.entries(herd.animals).map(([name,n])=>n+' '+name).join(', ')});
      }
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
    return summaries;
  }
}
module.exports={ActivityBillStore};
