(() => {
  const R = window.TribeNetResearchV2;
  if (!R) throw new Error('research-v2-schema.js must load before batch 03');
  const t = (skill, name, dl, page, extra={}) => ({ skill, name, dl:String(dl), page, ...extra });
  const rr = (label, topic, skill) => ({ label, topic: topic || label, type:'research', ...(skill ? { skill } : {}) });
  const item = (name, effects=[], extra={}) => ({ name, kind:'item', effects, ...extra });
  const building = (name, effects=[], extra={}) => ({ name, kind:'facility', effects, ...extra });
  const ship = (name, effects=[], extra={}) => ({ name, kind:'ship', effects, ...extra });
  const recipe = (activity, output, people, inputs=[], skills=[], raw='', variants=[]) => ({ activity, output, people, inputs, skills, raw, variants });
  const topics = [];

  topics.push(
    t('Fishing','Trawler',6,80,{
      effects:['Unlocks construction of the Trawler vessel.','Trawlers increase Fish output from the Fishing activity.','Trawlers may be used by Tribes or Clans that do not possess the research.'],
      recipe:recipe('Shipbuilding',{item:'Trawler',quantity:1},160,[{item:'Logs',quantity:160},{item:'Brass',quantity:40},{item:'Coal',quantity:200},{item:'Sheath',quantity:150},{item:'Silver',quantity:3000},{item:'Leather',quantity:30},{item:'Cloth',quantity:15},{item:'Rope',quantity:20}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:7}],'1 Trawler: People 160, ShB8, Wdw8, Mtl7, Logs 160, Brass 40, Coal 200, Sheath 150, Silver 3000, Leather 30, Cloth 15, Rope 20, Oars'),
      requirements:['The recipe lists Oars but does not state a quantity.'],
      notes:['Published vessel data: Sail MP 20; Navigation 2; Seamanship 2; Sail 4; Sail crew 10+7. Row MP 15; Navigation 0.5; Seamanship 0.5; Row 2; Row crew 20+7. MEF 12; Sail 16; Hull 16; Max People 60.','Defense Points: 16. Cargo: 20,000. Weight: 20,000.'],
      sourceGaps:['The source says a Trawler increases Fishing output but does not give a numeric Fishing multiplier in this entry.','The recipe requires Oars but gives no Oar quantity.'],
      affectsSkills:['Fishing'],
      relatedSkills:['Shipbuilding','Woodwork','Metalwork','Navigation','Seamanship'],
      creates:[ship('Trawler',['Fishing vessel that increases Fish output from the Fishing activity.','May be used without owning the research.'],{recipe:recipe('Shipbuilding',{item:'Trawler',quantity:1},160,[{item:'Logs',quantity:160},{item:'Brass',quantity:40},{item:'Coal',quantity:200},{item:'Sheath',quantity:150},{item:'Silver',quantity:3000},{item:'Leather',quantity:30},{item:'Cloth',quantity:15},{item:'Rope',quantity:20}],[{name:'Shipbuilding',level:8},{name:'Woodwork',level:8},{name:'Metalwork',level:7}]),requirements:['Oars are required; the source does not state a quantity.'],notes:['Sail MP 20; Row MP 15; MEF 12; Sail 16; Hull 16; Max People 60.','Defense Points 16; Cargo 20,000; Weight 20,000.']})]
    }),
    t('Fishing','Trawling Net',4,80,{
      effects:['A Trawling Net counts as +2 Active Months when Fishing from a Trawler.'],
      recipe:recipe('Weaving',{item:'Trawling Net',quantity:1},4,[{item:'Cotton',quantity:30},{item:'Silver',quantity:25}],[{name:'Weaving',level:7}],'1 Trawling Net: People 4, Wv7, Cotton 30, Silver 25'),
      restrictions:['The number of Trawling Nets used may not exceed the number of people Fishing.','One worker may use either a Net or a Trawling Net, not both.'],
      notes:['Weight: 5 lb.'],
      affectsSkills:['Fishing'],
      relatedSkills:['Weaving'],
      creates:[item('Trawling Net',['Counts as +2 Active Months when Fishing from a Trawler.'],{recipe:recipe('Weaving',{item:'Trawling Net',quantity:1},4,[{item:'Cotton',quantity:30},{item:'Silver',quantity:25}],[{name:'Weaving',level:7}]),restrictions:['No more Trawling Nets than Fishing workers.','A worker cannot use both a Net and a Trawling Net.'],notes:['Weight: 5 lb.']})]
    })
  );

  const forestryRates=[
    ['5 Logs / Person',5,83,5,'6 Logs / Person'],
    ['6 Logs / Person',6,83,6,'7 Logs / Person'],
    ['7 Logs / Person',7,83,7,'8 Logs / Person'],
    ['8 Logs / Person',8,84,8,'9 Logs / Person'],
    ['9 Logs / Person',8,84,9,'10 Logs / Person'],
    ['10 Logs / Person',8,84,10,null]
  ];
  for (let i=0;i<forestryRates.length;i++) {
    const [name,dl,page,logs,next]=forestryRates[i];
    topics.push(t('Forestry',name,dl,page,{
      prerequisites:i ? [rr(forestryRates[i-1][0],forestryRates[i-1][0],'Forestry')] : [],
      effects:[`Sets an untooled Forester's cutting rate to ${logs} Logs per person.`],
      leadsTo:next ? [rr(next,next,'Forestry')] : [],
      affectsSkills:['Forestry']
    }));
  }

  topics.push(
    t('Forestry','Burner Improvements',2,84,{
      effects:['A Burner Improvement doubles the effective workers assigned to Charcoal Making for one Burner.','Each Burner Improvement affects one Burner serving 10 people.'],
      recipe:recipe('Engineering',{item:'Burner Improvement',quantity:1},50,[{item:'Stone',quantity:150},{item:'Iron',quantity:50},{item:'Fodder',quantity:50},{item:'Clay',quantity:50}],[{name:'Engineering',level:6},{name:'Stonework',level:4},{name:'Metalwork',level:4},{name:'Brickmaking',level:4}],'1 Burner Improvement: People 50, Eng 6, Stn 4, Mtl 4, Brk 4, Stones 150, Iron 50, Fodder 50, Clay 50'),
      requirements:['An existing Burner is required for each Burner Improvement.','Materials are sent to usage (1263) and the GM Action must identify the unit and hex where the improvement is built.'],
      restrictions:['The number of Burner Improvements may never exceed the number of Burners.','Burner Improvements are buildings and are not transportable; they must be built in place.'],
      relatedSkills:['Engineering','Stonework','Metalwork','Brickmaking'],
      creates:[building('Burner Improvement',['Doubles effective Charcoal Making workers for one Burner serving 10 people.'],{recipe:recipe('Engineering',{item:'Burner Improvement',quantity:1},50,[{item:'Stone',quantity:150},{item:'Iron',quantity:50},{item:'Fodder',quantity:50},{item:'Clay',quantity:50}],[{name:'Engineering',level:6},{name:'Stonework',level:4},{name:'Metalwork',level:4},{name:'Brickmaking',level:4}]),requirements:['One existing Burner per Burner Improvement.'],restrictions:['Not transportable; must be built in place.','Cannot have more Burner Improvements than Burners.']})]
    }),
    t('Forestry','Scraper (Metal)',1,85,{
      effects:['A metal Scraper doubles the rate of Bark Stripping.'],
      recipe:recipe('Metalwork',{item:'Scraper',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:4}],[{name:'Metalwork',level:1}],'1 Scraper: Person 1, Mtl1, Iron 1, Coal 4 (or Bronze 1, Coal 3)',[
        recipe('Metalwork',{item:'Scraper',quantity:1},1,[{item:'Bronze',quantity:1},{item:'Coal',quantity:3}],[{name:'Metalwork',level:1}],'Bronze alternative: Person 1, Mtl1, Bronze 1, Coal 3')
      ]),
      notes:['Weight: 1 lb.','The source also lists this research under Metalwork.'],
      relatedSkills:['Metalwork'],
      creates:[item('Scraper',['Doubles Bark Stripping output.'],{recipe:recipe('Metalwork',{item:'Scraper',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:4}],[{name:'Metalwork',level:1}],'',[
        recipe('Metalwork',{item:'Scraper',quantity:1},1,[{item:'Bronze',quantity:1},{item:'Coal',quantity:3}],[{name:'Metalwork',level:1}])
      ]),notes:['Metal version; weight 1 lb.']})]
    }),
    t('Forestry','Scraper (Stone)',1,86,{
      effects:['A stone Scraper doubles the rate of Bark Stripping.'],
      recipe:recipe('Stonework',{item:'Scraper',quantity:1},1,[{item:'Stone',quantity:1}],[{name:'Stonework',level:2}],'1 Scraper: People 1, Stn2, Stone 1'),
      notes:['The source also lists this research under Stonework.','The source marks this version as coded.'],
      relatedSkills:['Stonework'],
      creates:[item('Scraper',['Doubles Bark Stripping output.'],{recipe:recipe('Stonework',{item:'Scraper',quantity:1},1,[{item:'Stone',quantity:1}],[{name:'Stonework',level:2}]),notes:['Stone version.']})]
    }),
    t('Forestry','Saw',5,86,{
      effects:['A Saw multiplies the Forestry logging rate by four.','The source examples are: no tool = 4 Logs, Adze = 8 Logs, Saw = 16 Logs per Forester.'],
      recipe:recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Iron',quantity:5},{item:'Coal',quantity:40}],[{name:'Metalwork',level:5}],'1 Saw: People 3, Mtl5, Iron 5, Coal 40 (alt Bronze/Brass 7, Coal 30)',[
        recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Bronze',quantity:7},{item:'Coal',quantity:30}],[{name:'Metalwork',level:5}],'Bronze alternative: 7 Bronze, 30 Coal'),
        recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Brass',quantity:7},{item:'Coal',quantity:30}],[{name:'Metalwork',level:5}],'Brass alternative: 7 Brass, 30 Coal')
      ]),
      restrictions:['A Saw cannot be used together with an Adze.'],
      notes:['Weight: 2 lb.','The source also lists this research under Metalwork.'],
      affectsSkills:['Forestry'],
      relatedSkills:['Metalwork'],
      creates:[item('Saw',['Multiplies logging output by ×4.'],{recipe:recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Iron',quantity:5},{item:'Coal',quantity:40}],[{name:'Metalwork',level:5}],'',[
        recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Bronze',quantity:7},{item:'Coal',quantity:30}],[{name:'Metalwork',level:5}]),
        recipe('Metalwork',{item:'Saw',quantity:1},3,[{item:'Brass',quantity:7},{item:'Coal',quantity:30}],[{name:'Metalwork',level:5}])
      ]),restrictions:['Cannot be used with an Adze.'],notes:['Weight: 2 lb.']})]
    })
  );

  topics.push(
    t('Furrier','Advanced Trap',4,87,{
      prerequisites:[rr('Improved Trap','Improved Trap','Metalwork'),rr('Improved Trap','Improved Trap','Furrier')],
      effects:['One Hunter/Furrier using one Advanced Trap gains +1.0 effective Hunting, so one hunter counts as two.'],
      recipe:recipe('Metalwork',{item:'Advanced Trap',quantity:1},2,[{item:'Iron',quantity:2},{item:'Coal',quantity:8}],[{name:'Metalwork',level:10}],'1 Advanced Trap: People 2, Mtl 10, Iron 2, Coal 8'),
      restrictions:['A Hunter/Furrier using an Advanced Trap may use only one Advanced Trap and no standard or Improved Traps at the same time.'],
      notes:['The source also lists Advanced Trap under Hunting and Metalwork.'],
      affectsSkills:['Hunting'],
      relatedSkills:['Metalwork','Hunting'],
      creates:[item('Advanced Trap',['One trap gives one Hunter/Furrier +1.0 effective Hunting, making one hunter count as two.'],{recipe:recipe('Metalwork',{item:'Advanced Trap',quantity:1},2,[{item:'Iron',quantity:2},{item:'Coal',quantity:8}],[{name:'Metalwork',level:10}]),restrictions:['One Advanced Trap per Hunter/Furrier; no standard or Improved Traps simultaneously.']})]
    }),
    t('Furrier','Improved Trap',2,87,{
      effects:['Each Improved Trap adds +0.15 effective Hunting instead of the standard Trap bonus of +0.10.','A Hunter/Furrier using five Improved Traps gains +0.75 effective Hunting.','Improved Traps may be used by units that do not possess the research.'],
      recipe:recipe('Metalwork',{item:'Improved Trap',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:6}],[{name:'Metalwork',level:3}],'1 Improved Trap: People 1, Mtl 3, Iron 1, Coal 6'),
      leadsTo:[rr('Advanced Trap','Advanced Trap','Furrier'),rr('Advanced Trap','Advanced Trap','Metalwork')],
      restrictions:['The standard limit of five traps per Hunter applies.','A Hunter/Furrier using Improved Traps may not mix them with standard Traps.'],
      notes:['The source also lists Improved Trap under Hunting and Metalwork.'],
      affectsSkills:['Hunting'],
      relatedSkills:['Metalwork','Hunting'],
      creates:[item('Improved Trap',['Adds +0.15 effective Hunting per trap; five give +0.75.','May be used without owning the research.'],{recipe:recipe('Metalwork',{item:'Improved Trap',quantity:1},1,[{item:'Iron',quantity:1},{item:'Coal',quantity:6}],[{name:'Metalwork',level:3}]),restrictions:['Up to five per Hunter under the normal trap limit; do not mix with standard Traps.']})]
    }),
    t('Furrier','Winter Furs',4,88,{
      effects:['Allows Furriers to identify and obtain Winter Furs during Winter months only.','Winter Furs sell at the Fair for twice the price of ordinary Furs.','During Winter, a Furrier equipped with five Traps or better produces four Winter Furs in addition to ordinary Furrying.'],
      leadsTo:[rr('Winter Pants','Winter Pants','Furrier'),rr('Winter Shirt','Winter Shirt','Furrier')],
      requirements:['The Furrier must have five Traps or better.','The activity is reported as a Transfer in addition to ordinary Furrying.'],
      notes:['Source example: 100 Actives with 500 Traps transfer 400 Winter Furs.'],
      creates:[item('Winter Fur',['Special Winter fur sold at twice the Fair price of ordinary Fur.'],{requirements:['Produced only in Winter by Furriers with five Traps or better.'],notes:['Four Winter Furs per qualifying Furrier, over and above ordinary Furrying.']})]
    })
  );

  topics.push(
    t('Geology','Geology 11',5,91,{
      prerequisites:[{label:'Geology 10',skill:'Geology',type:'skill'}],
      effects:['Adds +1 level to Geology (for example Geology 10 → 11).'],
      leadsTo:[rr('Geology IV','Geology IV','Geology'),rr('Geology V','Geology V','Geology'),rr('Geology VI','Geology VI','Geology')],
      notes:['The source states there is currently no benefit for Geology skill itself to be greater than 10.'],
      affectsSkills:['Geology']
    }),
    t('Geology','Geology IV',4,91,{
      prerequisites:[rr('Geology 11','Geology 11','Geology')],
      effects:['Adds +2 levels to Mining.'],
      notes:['Books may be written.','Every Geology research topic level 7 or higher adds another +2 Mining levels; the source states there is no current limit to Geology research levels.'],
      sourceIssues:['The grouped “Leads To” lines say “Geology IV: Geology III (Mining research)” and later repeat mismatched IV/V labels. The Compendium does not infer a corrected chain from those inconsistent lines.'],
      affectsSkills:['Mining']
    }),
    t('Geology','Geology V',5,91,{
      prerequisites:[rr('Geology IV','Geology IV','Geology')],
      effects:['Adds +2 levels to Mining.'],
      notes:['Books may be written.','Every Geology research topic level 7 or higher adds another +2 Mining levels; the source states there is no current limit to Geology research levels.'],
      sourceIssues:['The grouped “Leads To” lines contain internally inconsistent Geology III/IV/V labels; no corrected Leads To chain is invented.'],
      affectsSkills:['Mining']
    }),
    t('Geology','Geology VI',6,91,{
      prerequisites:[rr('Geology V','Geology V','Geology')],
      effects:['Adds +2 levels to Mining.'],
      notes:['Books may be written.','Every Geology research topic level 7 or higher adds another +2 Mining levels; the source states there is no current limit to Geology research levels.'],
      sourceIssues:['The grouped “Leads To” lines contain internally inconsistent labels; no corrected Leads To chain is invented.'],
      affectsSkills:['Mining']
    })
  );

  const opticsRecipe = output => recipe('Glasswork',{item:output,quantity:1},2,[{item:'Lens',quantity:2},{item:'Brass',quantity:2},{item:'Coal',quantity:10},{item:'Leather',quantity:2},{item:'Gold',quantity:4}],[{name:'Glasswork',level:10},{name:'Metalwork',level:3}],`1 ${output}: People 2, Gls10, Mtl3, Lens 2, Brass 2, Coal 10, Leather 2, Gold 4`);
  topics.push(
    t('Glasswork','Field Glasses',5,93,{
      effects:['A pair of Field Glasses adds +2 Leadership in field combat.','The +2 Leadership applies to all participating units when one pair is available in one of the combat units.','Research ownership is not required to use the item.'],
      recipe:opticsRecipe('Field Glasses'),
      requirements:['At least one pair of Field Glasses must be available in one of the combat units.','The player must alert the GM that the Field Glasses bonus is being used.'],
      restrictions:['The Leadership bonus applies to field combat only, not Siege or Assault combat.'],
      affectsSkills:['Leadership'],
      relatedSkills:['Metalwork'],
      creates:[item('Field Glasses',['Adds +2 Leadership in field combat to all participating units when one pair is present in a combat unit.','May be used without owning the research.'],{recipe:opticsRecipe('Field Glasses'),requirements:['One pair present in one combat unit; player alerts the GM.'],restrictions:['No benefit in Siege or Assault combat.']})]
    }),
    t('Glasswork','Spy Glass',5,93,{
      effects:['A Spy Glass adds +2 Captaincy in naval combat.','Research ownership is not required to use the item.'],
      recipe:opticsRecipe('Spy Glass'),
      requirements:['Each Fleet that is to receive the benefit must have one Spy Glass available.'],
      affectsSkills:['Captaincy'],
      relatedSkills:['Metalwork'],
      creates:[item('Spy Glass',['Adds +2 Captaincy in naval combat.','May be used without owning the research.'],{recipe:opticsRecipe('Spy Glass'),requirements:['One Spy Glass must be available in each benefiting Fleet.']})]
    })
  );

  R.registerBatch({
    id:'research-03-fire-control-glasswork',
    title:'Batch 3 · Fire Control through Glasswork',
    pages:'79–93',
    source:{title:'TribeNet V3.7 Research List',updated:'06 May 2026'},
    skills:['Fire Control','Fishing','Fletching','Forestry','Furrier','Generalship','Geology','Glasswork'],
    skillNotes:[
      {skill:'Fire Control',page:79,status:'no-topics-listed',note:'The Fire Control section contains no research topics in this source edition.'},
      {skill:'Fletching',page:82,status:'no-topics-listed',note:'The Fletching section contains no research topics in this source edition.'},
      {skill:'wGarrison',page:89,status:'no-topics-listed',note:'The source contains a heading “wGarrison” but lists no research topics beneath it.'},
      {skill:'Generalship',page:90,status:'under-review',note:'The source states: “All topics under review.” No Generalship research topics are listed in this section.'}
    ],
    topics
  });
})();
