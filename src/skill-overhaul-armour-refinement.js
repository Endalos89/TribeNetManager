(() => {
  const S = window.TribeNetSkillOverhaul;
  const armour = S?.profile?.('Armour');
  if (!armour) return;

  // The direct-production table already contains the items made with Armour.
  // Keep this secondary table for cross-skill armour only, so the page does not
  // repeat the same Armour-made items a second time.
  armour.ruleGroups = [{
    title:'Other armour from related skills',
    detail:'These items use the same armour categories but are produced by other skills.',
    rows:[
      { label:'Head', values:['Hood'] },
      { label:'Shielding', values:['Heater'] },
      { label:'Torso', values:['Scale','Ring','Jerkin'] },
      { label:'Over torso', values:['Cuirboilli','Bone Armour'] },
      { label:'Leg', values:['Trews'] }
    ]
  }];
})();
