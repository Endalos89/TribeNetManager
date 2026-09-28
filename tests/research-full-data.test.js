const assert = require('assert');
const zlib = require('zlib');

global.window = {};
for (let i=1;i<=6;i++) require(`../src/research-full-data-${String(i).padStart(2,'0')}.js`);

const encoded = global.window.TribeNetResearchFullB64Parts.join('');
const topics = JSON.parse(zlib.gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));

assert.strictEqual(topics.length,287,'The complete Research List should contain 287 parsed topic entries');

const find = (skill,name) => topics.find(row=>row.skill===skill && row.name===name);
const spy=find('Glasswork','Spy Glass');
assert(spy,'Spy Glass research should be present');
assert.strictEqual(spy.dl,'5');
assert.match(spy.recipe,/Lens 2/);
assert.match(spy.recipe,/Brass 2/);
assert.match(spy.effect,/\+2 Capt/);
assert(spy.affectedSkills.some(row=>row.skill==='Captaincy'),'Spy Glass should be linked as affecting Captaincy');

const field=find('Glasswork','Field Glasses');
assert(field,'Field Glasses research should be present');
assert.match(field.effect,/\+2 Ldr/);
assert(field.affectedSkills.some(row=>row.skill==='Leadership'),'Field Glasses should be linked as affecting Leadership');

const hospital=find('Healing','Hospital');
assert(hospital,'Hospital research should be present');
assert.match(hospital.recipe,/People 1250/);
assert.match(hospital.description,/population growth/i);
assert.match(hospital.description,/Healing Skill/i);

assert(topics.filter(row=>row.description).length>=280,'Most topics should retain their detailed Research List description');
assert(topics.filter(row=>row.recipe).length>=125,'Research recipes/costs should be captured where the source supplies them');
assert(topics.filter(row=>row.affectedSkills?.length).length>=70,'Cross-skill research effects should be indexed');

console.log('Full Research List regression tests passed.');
