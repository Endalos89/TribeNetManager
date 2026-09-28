(() => {
  Promise.resolve(window.TribeNetResearchFullReady || true).then(() => {
    const topics=window.TribeNetResearchData?.topics||[];
    const find=(skill,name)=>topics.find(t=>t.skill===skill&&t.name===name);

    const command=find('Sewing','Command Tent');
    if(command){
      command.sourceStatus='To be modified';
      command.leadsTo='N/A';
      command.description='Command Tents are designated locations for leaders to plan out and command in the lead up to battles and also during large scale battles. The use of Command Tents can increase Leadership Modifier and Tactics skill.';
      command.effect=command.description;
      command.bonus='Crafting: Allows crafting (via Armour activity) of Command Tent. Leadership Modifier boost: all participants on the side using Command Tent gain +1 to Leadership Modifier. Tactics Skill boost: if a unit participating in the Combat has the Command Tent research topic completed, all participants on their side gain +2 Tactics for the duration of the combat.';
      command.requirements='Sufficient Command Tents: 1 Command Tent is required for every 100 Warriors participating in the Combat; bonuses are reduced proportionately if fewer are available. Spoils: if a unit utilizing Command Tents is routed and the Enemy is not, 100% of Command Tents utilized are captured by the Enemy when calculating Spoils.';
      command.restrictions='N/A';
      command.notes='Other Clans/Tribes: any unit / tribe / clan may utilize Command Tents, but the Tactics Skill boost only applies if one participating unit has the Command Tent research topic. Weight: 200 lbs.';
      command.affectedSkills=[
        {skill:'Leadership',reason:'All participants on the side using Command Tent gain +1 to Leadership Modifier.'},
        {skill:'Tactics',reason:'If a participating unit has Command Tent research, all participants on its side gain +2 Tactics for the duration of the combat.'}
      ];
    }

    const mining11=find('Mining','Mining 11');
    if(mining11&&!mining11.description){
      mining11.effect='Skill Level Increase - Mining by +1.';
      mining11.description='The Research List leaves the Description field blank; its Summary specifies a +1 Mining skill level increase.';
      mining11.affectedSkills=[{skill:'Mining',reason:'Skill Level Increase - Mining by +1.'}];
    }

    const crown=find('Pottery','Crown Moulding');
    if(crown){
      crown.recipe='10 Crown Moulding: People 1, Pot 10, Art 10, Portland Cement 10, Clay 10, Refined Sand 10, Water 40, Weighs 10lb';
      crown.description='A decorative form of plaster for use in the most prestigious new buildings. Crown Moulding is installed at a rate of 2 per worker.';
      crown.effect=crown.description;
      crown.requirements='N/A'; crown.restrictions='N/A';
      crown.notes='Crafting Recipe Ingredients: some components are only generated via research-topic recipes; the creator does not need those topics but must have access to the components. As of this Research List, there are no public uses of Crown Moulding.';
    }
    const mould=find('Pottery','Moulding');
    if(mould){
      mould.recipe='5 Moulding: People 1, Pot 10, Design 6, Architecture 3, Portland Cement 10, Clay 20, Refined Sand 20, Water 40, Weighs 10lb';
      mould.description='A decorative form of plaster for use in the most prestigious new buildings. Moulding is installed at a rate of 2 per worker.';
      mould.effect=mould.description;
      mould.requirements='N/A'; mould.restrictions='N/A';
      mould.notes='Crafting Recipe Ingredients: some components are only generated via research-topic recipes; the creator does not need those topics but must have access to the components. As of this Research List, there are no public uses of Moulding.';
    }

    for(const marble of topics.filter(t=>t.name==='Marble Statue')){
      marble.description=String(marble.description||'').replace(/^\(Also under ([^)]+)\)\s+n\s+/,'(Also under $1) ');
      marble.effect=marble.description;
    }
    const castle=find('Politics','Castle'); if(castle) castle.sourceStatus='Under review';
    const terracotta=find('Pottery','Terracotta Army'); if(terracotta) terracotta.sourceStatus='Removed';
    for(const healing of topics.filter(t=>t.skill==='Healing' && t.name!=='Seek Herbs')) healing.sourceStatus='Battlefield-related healing topics under review';
  });
})();
