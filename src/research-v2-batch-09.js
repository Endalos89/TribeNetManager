(() => {
  const R = window.TribeNetResearchV2;
  if (!R) throw new Error('research-v2-schema.js must load before batch 09');
  const t = (skill, name, dl, page, extra={}) => ({ skill, name, dl:String(dl), page, ...extra });
  const item = (name, effects=[], extra={}) => ({ name, kind:'item', effects, ...extra });
  const ship = (name, effects=[], extra={}) => ({ name, kind:'ship', effects, ...extra });
  const recipe = (activity, output, people, inputs=[], skills=[], raw='', variants=[]) => ({ activity, output, people, inputs, skills, raw, variants });
  const topics = [];

  // Weaving
  topics.push(
    t('Weaving','Basket',3,205,{
      effects:['A Basket doubles the productivity of farmers harvesting crops, adding +100% effective workers for harvesting.','The Basket bonus may be combined with other permitted harvesting implements, but bonuses are additive rather than compounded.'],
      recipe:recipe('Weaving',{item:'Basket',quantity:1},1,[{item:'Bark',quantity:5},{item:'Gut',quantity:5}],[{name:'Weaving',level:4}],'1 Basket: People 1, Wv 4, Bark 5, Gut 5'),
      notes:['Example from the source: Scythe + Basket gives 3 equivalent Farmers and 9 acres of Grain, not 12.','Example from the source: a Tobacco Farmer with Basket + Machete is shown as 5 equivalent workers, not 8.','Players are responsible for showing equivalent workers in Orders.'],
      affectsSkills:['Farming'],
      creates:[item('Basket',['Doubles harvesting productivity by adding +100% effective workers; combines additively with other permitted harvesting implements.'],{
        recipe:recipe('Weaving',{item:'Basket',quantity:1},1,[{item:'Bark',quantity:5},{item:'Gut',quantity:5}],[{name:'Weaving',level:4}])
      })]
    }),
    t('Weaving','Epic Tapestry',6,205,{
      effects:['Provides +0.04 General Morale to the owning Clan, assigned through one nominated Tribe per Epic Tapestry held.','Provides +0.06 Military Morale when the benefiting Tribe is in combat.','If the Epic Tapestry is lost or destroyed, the owning Clan suffers -0.05 Morale.'],
      recipe:recipe('Weaving',{item:'Epic Tapestry',quantity:1},20,[{item:'Cotton',quantity:5000},{item:'Silver',quantity:500},{item:'Gold',quantity:50},{item:'Diamonds',quantity:5}],[],'1 Epic Tapestry: People 20, Cotton 5k, Silver 500, Gold 50, Diamonds 5'),
      requirements:['The owner must identify which Tribe receives the General Morale benefit.','The nominated Tribe must hold the Tapestry or have it in the Goods Tribe.'],
      restrictions:['Once assigned to a Tribe, the recipient does not change.','Holding more than one Epic Tapestry gives no additional bonus unless one is lost or destroyed.'],
      notes:['Weight: 25 lb.'],
      creates:[item('Epic Tapestry',['+0.04 General Morale to its assigned Tribe/Clan and +0.06 Military Morale when in combat; loss/destruction causes -0.05 Morale.'],{
        recipe:recipe('Weaving',{item:'Epic Tapestry',quantity:1},20,[{item:'Cotton',quantity:5000},{item:'Silver',quantity:500},{item:'Gold',quantity:50},{item:'Diamonds',quantity:5}]),
        requirements:['Must be assigned to one Tribe; that Tribe must hold it or have it in the Goods Tribe.'],
        restrictions:['Only one Epic Tapestry bonus applies at a time.'],
        notes:['Weight: 25 lb.']
      })]
    }),
    t('Weaving','Exotic Weaving',4,206,{
      prerequisites:[{ label:'Art 6', skill:'Art', type:'skill' }],
      effects:['Unlocks a Village-only Exotic Weaving activity for one Tribe per Clan.','Allows creation of a Clan-specific exotic Carpet, Rug or Tapestry using regional techniques/legends.','At Fair, exotic woven goods sell at the normal price and normal Fair limits; Fair Trade Multipliers do not apply.','At an Exotic Trading Post, exotic woven goods sell for twice the normal Silver price or may be sold for Diamonds equal to twice normal Silver price divided by 300, rounded down.','Using Silk instead of Cotton triples the Exotic Trading Post price.','Once three Tribes complete Exotic Weaving, they are considered members of the exclusive Exotic Weavers Guild.'],
      requirements:['Village Activity only.','Only one Tribe per Clan may perform Exotic Weaving.','A Clan selects one unique exotic item.','An Exotic Trading Post is required for the enhanced sale rules; these occur in NPC International cities and players must ask the GM for locations.'],
      restrictions:['At Fair, exotic goods have no special price premium and use normal Fair limits.','Fair Trade Multipliers do not apply.','A Clan may not belong to more than one exclusive Guild.'],
      notes:['The source lists example exotic items as Carpet, Rug and Tapestry and gives per-item skill/people/material/Silver values in a compact table.','When the Guild forms, a Guild leader must place a paper Element in Shanghai; without a leader the Guild collapses but may later be re-established.','After the initial three Tribes, further membership is determined by annual Gold auction.'],
      sourceGaps:['The compact recipe table is OCR-fragmented in this source extract. The Compendium preserves the stated item names and trading rules but does not invent ambiguous column mappings or output quantities.'],
      relatedSkills:['Art']
    })
  );

  // Whaling
  topics.push(
    t('Whaling','Whaler',6,207,{
      effects:['A Whaler increases the size of a whale catch, but does not change the chance of catching whales.','Allows whales to be processed at sea according to the crewing Tribe’s Peeling, Flensing and Blubbering capability.','A Whaler can process two whales in the same turn for flensing/peeling and blubberwork concurrently.'],
      recipe:recipe('Shipbuilding',{item:'Whaler',quantity:1},160,[{item:'Logs',quantity:160},{item:'Brass',quantity:40},{item:'Coal',quantity:200},{item:'Sheathing',quantity:150},{item:'Silver',quantity:3000},{item:'Leather',quantity:40},{item:'Cloth',quantity:20},{item:'Rope',quantity:50},{item:'Cauldrons',quantity:2},{item:'Longboats',quantity:6}],[{name:'Shipbuilding',level:9},{name:'Woodwork',level:8},{name:'Metalwork',level:8}],'1 Whaler: People 160, ShB9, Wdw8, Mtl8, Logs 160, Brass 40, Coal 200, Sheath 150, Silver 3000, Leather 40, Cloth 20, Rope 50, Oars, Cauldrons 2, Longboats 6 minimum (11 maximum), Oars 6 per longboat, Spear/spetum 3 per longboat minimum'),
      requirements:['Minimum 6 Longboats; maximum 11 Longboats.','6 Oars are required per Longboat.','At least 3 Spears or Spetums are required per Longboat.','The vessel needs 2 Cauldrons for the described at-sea processing setup.'],
      notes:['Defense Points: 16.','Cargo: 40,000.','Weight: 20,000.','Source ship table lists Sail Movement 25 MP with Navigation 3, Seamanship 2, Sailing 4, Crew 10+7; Row Movement 15 MP with Navigation 0.5, Seamanship 0.5, Rowing 2, Crew 20+7; MEF 4; Sail 16; Hull 16; Max People 60.','The source narrative describes using Longboats as whaleboats with 6 Warriors with ropes and cauldrons/tryworks for rendering oil.'],
      relatedSkills:['Shipbuilding','Woodwork','Metalwork','Peeling','Flensing','Blubbering'],
      creates:[ship('Whaler',['Specialized vessel that increases whale catch size and supports at-sea processing of up to two whales concurrently.'],{
        recipe:recipe('Shipbuilding',{item:'Whaler',quantity:1},160,[{item:'Logs',quantity:160},{item:'Brass',quantity:40},{item:'Coal',quantity:200},{item:'Sheathing',quantity:150},{item:'Silver',quantity:3000},{item:'Leather',quantity:40},{item:'Cloth',quantity:20},{item:'Rope',quantity:50},{item:'Cauldrons',quantity:2},{item:'Longboats',quantity:6}],[{name:'Shipbuilding',level:9},{name:'Woodwork',level:8},{name:'Metalwork',level:8}]),
        requirements:['6–11 Longboats; 6 Oars per Longboat; at least 3 Spears/Spetums per Longboat; 2 Cauldrons.'],
        notes:['Defense Points 16; Cargo 40,000; Weight 20,000; Max People 60.']
      })]
    })
  );

  // Woodwork
  topics.push(
    t('Woodwork','Bunk',3,208,{
      effects:['Every 2 Bunks add 1 additional person-space to Lodgings and Barracks.','The maximum number of Bunks that can contribute is equal to the base Lodgings/Barracks capacity.'],
      recipe:recipe('Woodwork',{item:'Bunk',quantity:1},2,[{item:'Logs',quantity:2},{item:'Iron',quantity:1},{item:'Coal',quantity:5}],[],'1 Bunk: People 2, Log 2, Iron 1, Coal 5'),
      notes:['Woodwork Activity only.','The source describes this as three non-Clan members sharing 2 Bunks by sleeping/working in shifts.','Example: 10 Lodgings normally hold 200 extra people; 200 Bunks add another 100 spaces for a total of 300.','Weight: 50 lb.'],
      creates:[item('Bunk',['Every 2 Bunks add 1 capacity to Lodgings/Barracks, up to the base lodging/barracks capacity.'],{
        recipe:recipe('Woodwork',{item:'Bunk',quantity:1},2,[{item:'Logs',quantity:2},{item:'Iron',quantity:1},{item:'Coal',quantity:5}]),
        notes:['Weight: 50 lb.']
      })]
    }),
    t('Woodwork','Mining Ladder',5,208,{
      effects:['A Mining Ladder gives +100% Mining output to up to 10 Miners.','A Mining Ladder gives +100% Digging output to up to 10 Diggers for activities such as Clay, Sand or moat digging.','The Mining Ladder bonus is cumulative with other implements such as Picks, Shovels, Ore Carts and Seam Wedges, but the bonuses are additive rather than compounded.'],
      recipe:recipe('Woodwork / Metalwork',{item:'Mining Ladder',quantity:1},15,[{item:'Logs',quantity:4},{item:'Iron',quantity:25},{item:'Coal',quantity:150}],[{name:'Woodwork',level:3},{name:'Metalwork',level:3}],'People 15, Wd3, Mtl3, Log 4, Iron 25, Coal 150'),
      notes:['The source also lists this research under Engineering, Mining and Metalwork.','Weight: 50 lb.','The source gives an order-entry workaround: if the implement is not coded correctly, add Auxiliaries and assign the doubled effective workers manually.'],
      affectsSkills:['Mining','Engineering'],
      relatedSkills:['Engineering','Mining','Metalwork'],
      creates:[item('Mining Ladder',['+100% Mining output for up to 10 Miners and +100% Digging output for up to 10 Diggers; stacks additively with other implements.'],{
        recipe:recipe('Woodwork / Metalwork',{item:'Mining Ladder',quantity:1},15,[{item:'Logs',quantity:4},{item:'Iron',quantity:25},{item:'Coal',quantity:150}],[{name:'Woodwork',level:3},{name:'Metalwork',level:3}]),
        notes:['Weight: 50 lb.']
      })]
    }),
    t('Woodwork','Wheelbarrow',4,209,{
      effects:['A worker using a Wheelbarrow increases Mining output by 50%.','A worker using a Wheelbarrow increases Engineering output by 50%.','A worker using a Wheelbarrow doubles Quarrying output.'],
      recipe:recipe('Woodwork',{item:'Wheelbarrow',quantity:1},2,[{item:'Logs',quantity:2}],[{name:'Woodwork',level:5}],'1 Wheelbarrow: People 2, Wdw5, Logs 2'),
      notes:['Woodwork Activity only.','The source states this implement is coded.','Weight: 50 lb.'],
      affectsSkills:['Mining','Engineering','Quarrying'],
      creates:[item('Wheelbarrow',['+50% Mining output, +50% Engineering output and ×2 Quarrying output for the worker using it.'],{
        recipe:recipe('Woodwork',{item:'Wheelbarrow',quantity:1},2,[{item:'Logs',quantity:2}],[{name:'Woodwork',level:5}]),
        notes:['Weight: 50 lb.']
      })]
    })
  );

  R.addBatch({
    id:'research-v2-batch-09',
    label:'Batch 9 — Weaving to Woodwork',
    pages:'205–209',
    topics,
    skillNotes:[]
  });
})();
