'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const livestock=require('../src/activities-livestock-engine');
const {TurnManagerDatabase}=require('../src/turn-manager-database');
const {ActivityBillStore}=require('../src/activities-bills-store');
const {assembleActivityAssignments}=require('../src/activity-assignments');
const {normalizeActivityRows}=require('../src/orders-workbook');

assert.equal(livestock.animalKey('Goats'),'GOAT');
assert.equal(livestock.activityKey('GUT'),'GUTTING');
assert.equal(livestock.activityKey('BONE'),'BONING');
assert.equal(livestock.activityKey('SKIN&GUT&BONE'),'SKIN_GUT_BONE');
assert.equal(livestock.baseRate('SKIN_GUT_BONE','GOAT'),3);
assert.equal(livestock.baseRate('SKIN_GUT_BONE','CATTLE'),1);
assert.equal(livestock.baseRate('GUTTING','ELEPHANT'),1);
assert.equal(livestock.baseRate('SKINNING','ELEPHANT'),0);
const combined=livestock.process({activity:'SKIN_GUT_BONE',animal:'GOAT',workers:1,animalsAvailable:3});
assert.deepEqual(combined.outputs,{SKINS:3,GUT:6,BONES:6,PROVS:12});
assert.equal(livestock.process({activity:'GUTTING',animal:'GOAT',workers:1,knives:1,animalsAvailable:30}).animals,12);
assert.deepEqual(livestock.staffForHerd({Goats:21,Cattle:10,Elephants:6}),{
  workers:5,animals:{GOAT:21,CATTLE:10,ELEPHANT:6}
});
assert.equal(livestock.staffForHerd({Goats:21},{GOAT:2}).workers,1);
assert.equal(livestock.staffForHerd({Goats:21},{},{atSea:true}).workers,0);
assert.equal(livestock.capForLevel(1),10);
assert.equal(livestock.capForLevel(10),Infinity);
assert.equal(livestock.allocateProcessing({activity:'SKIN_GUT',animal:'GOAT',workerLimit:2,
  knivesAvailable:1,animalsAvailable:10,need:8,goalItem:'GUT'}).animals,6);

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tribenet-livestock-test-'));
let db;
try{
  db=new TurnManagerDatabase(temp);
  const store=new ActivityBillStore(db);
  const units=[
    {code:'0485',workersAvailable:12,skill:2,skillLevels:{GUTTING:2,SKINNING:2,BONING:2,HERDING:0},
      stock:{Goat:25,'Knife':2},eaters:12,terrain:'PR',month:1,provs:0},
    {code:'0485e1',goodsTribe:'0485',workersAvailable:8,skill:2,
      skillLevels:{GUTTING:2,SKINNING:2,BONING:2,HERDING:0},
      stock:{},eaters:5,terrain:'PR',month:1,provs:0}
  ];
  const first=store.apply('906-08',units);
  let herds=db.listActivities('906-08').filter(x=>x.activityCode==='HERDING');
  assert.equal(herds.length,1,'Auto Herding should allocate one row per eligible unit');
  assert.equal(herds[0].people,2,'25 Goats require two herders');
  assert.ok(first.some(x=>x.skill==='HERDING'));
  store.apply('906-08',units);
  assert.equal(db.listActivities('906-08').filter(x=>x.activityCode==='HERDING').length,1,
    'Recalculation must replace the old automatic order, not duplicate it');
  store.apply('906-09',units);
  assert.equal(db.listActivities('906-09').filter(x=>x.activityCode==='HERDING').length,1,
    'A new turn should generate a new Herding draft without destroying the prior turn');

  const bill=store.save({unit:'0485',skill:'GUTTING',activityCode:'SKIN_GUT_BONE',
    animal:'GOAT',mode:'maximise',goalItem:'GUT',quantity:0});
  assert.equal(bill.activityCode,'SKIN_GUT_BONE');
  assert.equal(bill.skill,'GUTTING');
  const planned=store.apply('906-08',units);
  const row=db.listActivities('906-08').find(x=>x.generatedBillId===bill.id);
  assert.ok(row,'Processing Bill must generate a saved activity');
  assert.equal(row.activityCode,'SKIN_GUT_BONE');
  assert.equal(row.target,'GOAT');
  assert.equal(row.distinction,'NONE');
  assert.ok(row.people<=10,'Herding reserves two of the twelve available workers');
  assert.ok(row.implements.every(x=>x.name==='KNIFE'));
  assert.ok(planned.find(x=>x.id===bill.id).outputs.PROVS>0,'Combined processing also produces Provisions');
  const assembled=assembleActivityAssignments({activities:db.listActivities('906-08')});
  const exported=normalizeActivityRows(assembled.activities,100);
  const sgb=exported.find(x=>x.activity==='SKIN&GUT&BONE');
  assert.ok(sgb,'Combined workbook activity must use the established order name');
  assert.equal(sgb.item,'GOAT');
  assert.equal(sgb.distinction,'NONE');
  assert.equal(exported.filter(x=>x.activity==='HERDING').length,1);
  store.apply('906-08',units);
  assert.equal(db.listActivities('906-08').filter(x=>x.generatedBillId===bill.id).length,1,
    'Processing Bill recomputation must be idempotent');

  const total=store.save({id:bill.id,unit:'0485',skill:'GUTTING',activityCode:'SKIN_GUT_BONE',
    animal:'GOAT',mode:'stock',goalItem:'GUT',quantity:10});
  assert.equal(total.id,bill.id);
  store.apply('906-08',units);
  assert.ok(db.listActivities('906-08').find(x=>x.generatedBillId===bill.id)?.people<=2,
    'Maintain Stock should use the minimum staff required after stock and higher-priority output');

  const manual=db.addActivity('906-08',{unit:'0485e1',activityCode:'SKIN_GUT',people:1,
    target:'GOAT',distinction:'NONE',implements:[{name:'KNIFE',quantity:1}]});
  assert.equal(db.listActivities('906-08').find(x=>x.id===manual.id).target,'GOAT');
  store.apply('906-08',units);
  assert.ok(db.listActivities('906-08').some(x=>x.id===manual.id),
    'Regenerating automatic activities never deletes manual processing');
  store.skip(bill.id,'906-08');
  store.apply('906-08',units);
  assert.ok(!db.listActivities('906-08').some(x=>x.generatedBillId===bill.id),
    'Skipping should remove the processing draft for this turn only');
  store.reset(bill.id,'906-08');
  const reached=store.apply('906-08',units).find(x=>x.id===bill.id);
  assert.equal(reached.status,'Stock target reached',
    'A reset Bill should correctly do no work if manual processing already meets its goal');
  store.save({id:bill.id,unit:'0485',skill:'GUTTING',activityCode:'SKIN_GUT_BONE',
    animal:'GOAT',mode:'maximise',goalItem:'GUT',quantity:0});
  store.apply('906-08',units);
  assert.ok(db.listActivities('906-08').some(x=>x.generatedBillId===bill.id),
    'A reset Bill should generate a draft when its goal again requires processing');
  console.log('Livestock: shared skill caps, combined yields, herd auto-orders, idempotence, running bills and export mappings passed');
} finally {
  db?.close();
  fs.rmSync(temp,{recursive:true,force:true});
}
