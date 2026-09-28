(() => {
  Promise.resolve(window.TribeNetResearchFullReady || true).then(() => {
    const topics=window.TribeNetResearchData?.topics||[];
    const command=topics.find(t=>t.skill==='Sewing'&&t.name==='Command Tent');
    if(command){
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
    const mining11=topics.find(t=>t.skill==='Mining'&&t.name==='Mining 11');
    if(mining11&&!mining11.description){
      mining11.effect='Skill Level Increase - Mining by +1.';
      mining11.description='The Research List leaves the Description field blank; its Summary specifies a +1 Mining skill level increase.';
      mining11.affectedSkills=[{skill:'Mining',reason:'Skill Level Increase - Mining by +1.'}];
    }
  });
})();
