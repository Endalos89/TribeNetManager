(() => {
  const R = window.TribeNetResearchV2;
  if (!R) throw new Error('research-v2-schema.js must load before final research audit');

  const SOURCE = { title:'TribeNet V3.7 Research List', updated:'06 May 2026' };
  const canon = R.canon;
  const addUnique = (arr, value) => { if (value && !arr.includes(value)) arr.push(value); };
  const topicsNamed = name => R.topics.filter(t => canon(t.name) === canon(name));
  const entityNamed = name => R.entity(name);
  const noteTopic = (name, note) => topicsNamed(name).forEach(t => addUnique(t.notes, note));
  const effectTopic = (name, effect) => topicsNamed(name).forEach(t => addUnique(t.effects, effect));
  const restrictTopic = (name, restriction) => topicsNamed(name).forEach(t => addUnique(t.restrictions, restriction));
  const noteEntity = (name, note) => { const e=entityNamed(name); if(e) addUnique(e.notes, note); };

  // The final pages are a change log / GM working section, not new research articles.
  R.registerBatch({
    id:'research-v2-final-audit',
    title:'Final audit · Added / Removed / Modified / Other Modifications',
    pages:'209–212',
    source:SOURCE,
    skills:[],
    skillNotes:[],
    topics:[]
  });

  const audit = {
    pages:'209–212',
    source:SOURCE,
    added:[
      'Spy Glass','Cascade Tanning Pits','Outpost','Hunting Dogs','Triage','Press gang','Shipbuilding 11','Milking 11','Cheesemaking 11','Archery 12',
      'Atheism and Religion – Extra Members and Military Orders','Collect Trade City Market Sheet','Trebuchet','Informed Marketing','Dance – Spring Arts Festival','Market Research','Wagon Laager','Milk Maids','Extra Fair Slot','Wetlands Wayfinder','Wetlands Corridor','Extra Fair Slot (17 Sep 2025)','Generalship, Marines, Navy, Naval Tradition (19 Sep 2025)','Drydock mod (25 Sep 2025)','Astronomy','Field Glasses (18/10/2025)','Triball Saddle (17 Nov 2025)','Triball Maneuvers (17 Nov 2025)','Command Tent (08/02/2026)','Extra Element (08/02/2026)','Banking 11 (27/02/2026)','Letter of Credit (27/02/2026)','Artillerists (02/04/2026)','Dog Leash (02/04/2026)','Combat Boots (02/04/2026)','Cascade Tanning Pits (02/04/2026)','Hill Sculpture (03/04/2026)','Militia Mobilisation (05/05/2026)','Mobilisation 11 (05/05/2026)'
    ],
    removed:['Feudal Security','Astral Navigation','Terracotta Army','Fortress','Castle','Keep','Boat People'],
    modified:[
      'Wording In Wholesale Trading','Wording in Med 1 Med 2 Hospital and Sewers','Wording in exotic seekers','Marksmen, Close Order Infantry, Close Formation (Close Order Cavalry), Junior Officer, Home Guard, Junior Naval Officer','Geology','Triball Guild','Milk and Cheese – unlimited production at lvl 10','Oilmill','Terracotta Warriors','Field Glasses','Branded Alcohol','Inactive Quarriers','Gin/Marble – may use Int5 to find Juniper/Marble under normal Int rules','Saw – Alt to Iron: Bronze/Brass 7, Coal 30','Army','Scouting – Extra MV I and II allow Locating'
    ],
    otherModifications:[
      'Greaves and Bascinet are not prerequisites for Full and Fluted Plate, but cannot be used in combat in addition to those items. (13 Nov 2025)',
      'Gold requirement removed for making Breast, Fluted and Full Plate from Steel or better Steel, and for Ulfbehrt Sword. (04 Jan 2026)',
      'Sewers do not affect Fleets. (23 Jan 2026)'
    ],
    proposals:[
      { skill:'Glasswork', name:'Stained Glass', status:'proposal', text:'Make an item that can be added to Religious buildings and reduces (or eliminates) the exotic wood requirement.' },
      { skill:'Intelligence', name:'Double use per year', status:'rejected', text:'Rejected; manual GM.' }
    ]
  };

  // Removed list: the later change log supersedes earlier detailed entries.
  for (const name of audit.removed) {
    for (const t of topicsNamed(name)) {
      t.status = 'removed';
      addUnique(t.notes, `Final Research List change log (page 211) lists ${name} as Removed.`);
    }
    noteEntity(name, `Final Research List change log (page 211) lists this as Removed.`);
  }

  // Entries whose final change-log line only says that wording/content was modified.
  const modifiedFlags = [
    'Wholesale Trading','Medicine 1','Medicine 2','Hospital','Sewers','Exotic Seekers','Marksmen','Close Order Infantry','Close Formation','Junior Officer','Home Guard','Junior Naval Officer','Geology','Triball Guild','Oilmill','Terracotta Warriors','Field Glasses','Branded Alcohol','Inactive Quarriers','Saw','Army','Extra Movement 1','Extra Movement 2'
  ];
  for (const name of modifiedFlags) noteTopic(name, 'The final Research List change log flags this entry as Modified; the detailed article uses the rule text from its current research entry rather than inventing an unstated change.');

  // Modifications where the final change log gives an operational rule.
  effectTopic('Triball Guild','The final change log confirms that an additional 800 Warriors may be assigned during Fair, allowing Triball to generate both Gold and Silver while assigning up to 1,600 Warriors in total.');
  noteEntity('Milk','Final change log: Milk and Cheese production is unlimited at level 10 (08 Oct 2025).');
  noteEntity('Cheese','Final change log: Milk and Cheese production is unlimited at level 10 (08 Oct 2025).');
  noteTopic('Gin','Final change log: Intelligence 5 may be used to find Juniper under the normal Intelligence rules.');
  noteTopic('Marble Statue','Final change log: Intelligence 5 may be used to find Marble under the normal Intelligence rules.');
  noteTopic('Saw','Final change log confirms the alternative to Iron: 7 Bronze or 7 Brass with 30 Coal.');
  effectTopic('Extra Movement 1','The final change log states that Extra Movement 1 may be used for Locating.');
  effectTopic('Extra Movement 2','The final change log states that Extra Movement 2 may be used for Locating.');

  // Other Modifications, page 212.
  for (const name of ['Full Plate','Fluted Plate']) {
    for (const t of topicsNamed(name)) {
      t.prerequisites = t.prerequisites.filter(p => !['GREAVES','BASCINET'].includes(canon(p.label)));
      addUnique(t.restrictions,'Greaves and Bascinet are not prerequisites, but they cannot be used in combat in addition to this armour.');
      addUnique(t.notes,'Final Research List Other Modifications, 13 Nov 2025.');
    }
    const e=entityNamed(name); if(e) addUnique(e.restrictions,'Greaves and Bascinet cannot be used in combat in addition to this armour.');
  }

  const removeGoldFromSteelRecipe = r => {
    if (!r) return;
    const steel = (r.inputs||[]).some(i => canon(i.item).includes('STEEL'));
    if (steel) r.inputs = (r.inputs||[]).filter(i => canon(i.item) !== 'GOLD');
    (r.variants||[]).forEach(removeGoldFromSteelRecipe);
  };
  for (const name of ['Breast Plate','Breastplate','Fluted Plate','Full Plate','Ulfbehrt Sword']) {
    for (const t of topicsNamed(name)) {
      removeGoldFromSteelRecipe(t.recipe);
      addUnique(t.notes,'Final Research List Other Modifications (04 Jan 2026): Gold is not required when making the listed Steel-or-better version.');
    }
    const e=entityNamed(name);
    if(e){ (e.recipes||[]).forEach(removeGoldFromSteelRecipe); addUnique(e.notes,'Final Research List: Gold requirement removed for the applicable Steel-or-better recipe.'); }
  }

  restrictTopic('Sewers','Fleets are not affected by Sewers.');
  const sewers=entityNamed('Sewers'); if(sewers) addUnique(sewers.restrictions,'Fleets are not affected by Sewers.');

  // Proposed/rejected items remain audit metadata only; they are deliberately not registered as active research topics.
  audit.unmatchedRemoved = audit.removed.filter(name => topicsNamed(name).length === 0);
  window.TribeNetResearchFinalAudit = audit;
})();
