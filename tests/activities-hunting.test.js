const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TurnManagerDatabase } = require('../src/turn-manager-database');
const { ActivityBillStore } = require('../src/activities-bills-store');
const engine = require('../src/activities-hunting-engine');
const { assembleActivityAssignments } = require('../src/activity-assignments');
const { normalizeTransferRows, normalizeActivityRows } = require('../src/orders-workbook');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tribenet-hunt-test-'));
let db;
try{
  assert.equal(engine.canonicalTerrain('D'),'DF');
  const low=engine.forecast({workers:10,skill:0,terrain:'PR',month:1,waterBorders:0});
  assert.equal(low.fine,20);
  assert.equal(low.min,8);
  assert.equal(low.max,20);
  assert.ok(low.min<low.average&&low.average<low.max);
  assert.equal(engine.predicted(low,'optimistic'),low.max);
  assert.equal(engine.predicted(low,'conservative'),low.min);
  assert.equal(engine.predicted(low,'average'),low.average);
  assert.equal(engine.forecast({workers:5,terrain:'UNKNOWN',month:1}),null);
  assert.deepEqual(engine.provisionTarget(3,700),{beforeEating:2800,afterEating:2100,currentTurn:700});
  assert.deepEqual(engine.retentionCap({capacity:100,percent:75,otherWeight:20,provsWeight:1}),{quantity:55,warning:''});
  assert.equal(engine.retentionCap({capacity:100,percent:75,otherWeight:null}).quantity,null,
    'Unknown weight must never silently become zero');

  const allocated=engine.optimizeTools(2,{Bow:1,Trap:12,'Hunting Dog':2});
  assert.ok(allocated.implements.some(x=>x.name==='Hunting Dog'&&x.quantity===2));
  assert.ok(allocated.implements.some(x=>x.name==='Trap'&&x.quantity<=10));
  assert.ok(allocated.effectiveAM>2);
  assert.ok(engine.allocation({workersAvailable:200,goalProvs:50,mode:'conservative',skill:0,terrain:'PR',month:1,
    stock:{},reservations:{}}).workers>0);
  assert.equal(engine.allocation({workersAvailable:10,goalProvs:0,mode:'average',skill:0,terrain:'PR',month:1,
    stock:{}}).workers,0);

  db=new TurnManagerDatabase(temp);
  const store=new ActivityBillStore(db);
  assert.throws(()=>store.save({unit:'invalid',mode:'months',months:1}),/valid unit/);
  const first=store.save({unit:'0485',mode:'months',months:1,yieldMode:'average'});
  const second=store.save({unit:'0485e1',mode:'months',months:1,yieldMode:'conservative'});
  assert.equal(store.list().length,2);
  const changed=store.save({id:first.id,unit:'0485',mode:'months',months:2,yieldMode:'optimistic',loadPercent:80});
  assert.equal(changed.id,first.id,'Editing must update the existing Bill, not add another');
  assert.equal(changed.months,2);
  assert.equal(changed.yieldMode,'optimistic');
  assert.equal(changed.loadPercent,80);
  const restored=store.save({id:first.id,unit:'0485',mode:'months',months:1,yieldMode:'average'});
  assert.equal(restored.loadPercent,null);
  assert.equal(store.list().length,2,'Editing should not duplicate Running Bills');
  const context=[
    {code:'0485',goodsTribe:'0485g1',eaters:20,workersAvailable:15,skill:0,terrain:'PR',waterBorders:0,
      month:1,stock:{},provs:0},
    {code:'0485e1',goodsTribe:'0485g1',eaters:20,workersAvailable:15,skill:0,terrain:'PR',waterBorders:0,
      month:1,stock:{},provs:0},
    {code:'0485g1',eaters:0,workersAvailable:0,skill:0,terrain:'PR',waterBorders:0,
      month:1,stock:{Bow:5,Trap:6},provs:0}
  ];
  const one=store.apply('906-05',context);
  assert.equal(one.length,2);
  assert.equal(db.listActivities('906-05').length,2);
  assert.ok(one.every(x=>x.workers>=0 && x.workers<=15));
  const totalBows=one.flatMap(x=>x.tools||[]).filter(t=>t.name==='Bow').reduce((n,t)=>n+t.quantity,0);
  assert.ok(totalBows<=5,'Shared equipment cannot be claimed more than once');
  const again=store.apply('906-05',context);
  assert.equal(again.length,2);
  assert.equal(db.listActivities('906-05').length,2,'Recalculation must replace generated rows, not append');

  const linked=db.listActivities('906-05').find(row=>row.generatedBillId===second.id);
  assert.ok(linked,'Generated activities expose their original Running Bill');
  db.updateActivity(linked.id,{unit:'0485e1',activityCode:'HUNTING',people:3,target:'NONE',
    distinction:'NONE',implements:[{name:'Bow',quantity:1}]});
  assert.equal(db.listActivities('906-05').find(x=>x.id===linked.id).generatedLocked,1);
  const lockedRun=store.apply('906-05',context).find(x=>x.id===second.id);
  assert.match(lockedRun.status,/Locked:/);
  assert.equal(db.listActivities('906-05').filter(x=>x.unit==='0485e1').length,1,
    'Re-running a locked Bill must not create an additional row.');
  assert.equal(db.listActivities('906-05').find(x=>x.id===linked.id).generatedBillId,second.id,
    'The locked row must retain its Bill association.');
  store.skip(second.id,'906-05');
  assert.equal(db.listActivities('906-05').filter(x=>x.unit==='0485e1').length,0,
    'Explicit Skip this turn removes only this Bill generated draft.');
  const skipRun=store.apply('906-05',context).find(x=>x.id===second.id);
  assert.match(skipRun.status,/Skipped this turn/);
  assert.equal(db.listActivities('906-05').filter(x=>x.unit==='0485e1').length,0,
    'Skip persists across recalculations.');
  store.reset(second.id,'906-05');
  store.apply('906-05',context);
  assert.equal(db.listActivities('906-05').filter(x=>x.unit==='0485e1').length,1,
    'Reset this turn allows the Bill to regenerate.');

  const third=store.save({unit:'0499',mode:'months',months:1,yieldMode:'optimistic',loadPercent:75});
  const own={code:'0499',eaters:10,workersAvailable:10,skill:0,terrain:'PR',waterBorders:0,
    month:1,stock:{Provs:25},provs:25,capacity:100,otherMaxWeight:20};
  const contexts=[...context,own];
  const thirdRun=store.apply('906-05',contexts).find(x=>x.id===third.id);
  assert.equal(thirdRun.workers,0,'Confirmed Provs already exceed the one-month goal');
  const safety=db.listTransfers('906-05').find(x=>x.from==='0499'&&x.to==='0499');
  assert.equal(safety.quantity,55,'BM quantity means how much to keep, not how much to drop');
  assert.equal(safety.timing,'BM');
  assert.equal(normalizeTransferRows([safety],10)[0].quantity,55);
  assert.throws(()=>normalizeTransferRows([{from:'0499',to:'0499',item:'WARRIORS',quantity:5,timing:'BM'}],10),
    /people/);
  assert.equal(db.listTransfers('906-05').length,1,'Only one derived retention per Bill');
  store.apply('906-05',contexts);
  assert.equal(db.listTransfers('906-05').length,1,'No duplicate safety Transfer');
  assert.equal(db.listActivities('906-05').length,2);

  const manual=db.addActivity('906-05',{unit:'0499',activityCode:'HUNTING',people:2,target:'NONE',
    distinction:'NONE',implements:[{name:'Bow',quantity:2}]});
  assert.equal(db.listActivities('906-05').find(row=>row.id===manual.id).implements[0].quantity,2);
  const assembled=assembleActivityAssignments({activities:db.listActivities('906-05')});
  assert.equal(assembled.activities.find(x=>x.unit==='0499').implements[0].quantity,2);
  assert.equal(normalizeActivityRows(assembled.activities,100).find(x=>x.unit==='0499').implements[0].name,'Bow');

  store.move(second.id,-1);
  assert.equal(store.list()[0].id,second.id);
  store.pause(first.id,true);
  store.apply('906-05',contexts);
  assert.equal(db.listActivities('906-05').filter(x=>x.unit==='0485').length,0,
    'Paused Bill must remove its own unlocked generated activity');
  store.pause(first.id,false);
  store.remove(third.id,'906-05');
  assert.equal(db.listTransfers('906-05').length,0);
  assert.ok(db.listActivities('906-05').some(x=>x.id===manual.id),'Manual activity survives Bill deletion');
  console.log('Hunting Activities: forecast, priority, Goods Tribe tools, bills, BM retention and export normalization passed');
} finally {
  db?.close();
  fs.rmSync(temp,{recursive:true,force:true});
}
