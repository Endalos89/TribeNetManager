const { canonical } = require('./mandate-catalog');

const SOURCE_DOCUMENT = 'Mandate TN03 rev.N02.1 Feb 26 2026';

const LIMITED_WORKER_SKILLS = new Set([
  'BAKING','BONING','BRICK MAKING','COOKING','CURING','DRESSING','EXCAVATION','FLETCHING','FORESTRY',
  'GUTTING','MILLING','POTTERY','QUARRYING','REFINING','SALTING','SHIPWRIGHT','SKINNING','TANNING'
]);

const DETAILS = {
  'ADMINISTRATION': { summary:'Determines how many Elements and Fleets a Tribe may maintain.', sections:['8.7.4','29.1'], links:[] },
  'ALCHEMY': { summary:'A Group C research skill. The Mandate notes that its scope is still being expanded.', sections:['29.2'], limitations:['Primarily a research skill in the current Mandate.'] },
  'APOTHECARY': { summary:'A Group B research skill unlocked through research.', sections:['29.3'], limitations:['Research-unlocked skill.'] },
  'ARCHAEOLOGY': { summary:'Allows excavation of ruins from level 1.', sections:['26','29.4'] },
  'ARCHERY': { summary:'Improves effectiveness with missile weapons such as slings, bows and arbalests in combat.', sections:['17','29.5'], topics:['land-combat','naval-combat'] },
  'ARCHITECTURE': { summary:'Required for construction of higher-order buildings and structures.', sections:['14','29.6'] },
  'ART': { summary:'A Group C Fair skill.', sections:['15','29.7'] },
  'BANKING': { summary:'A Group C research skill associated with Economics and banking.', sections:['25','29.10'] },
  'CAPTAINCY': { summary:'Replaces Leadership for Fleets and improves effectiveness in naval battles.', sections:['17.15','29.11'], topics:['naval-combat'] },
  'COMBAT': { summary:'Improves effectiveness during melee in land combat.', sections:['17','29.12'], topics:['land-combat'] },
  'COURIER': { summary:'Determines the number of Courier units allowed in the Clan; only one Tribe may learn it.', sections:['8.7.9','29.13'], limitations:['Only one Tribe in the Clan may learn Courier.'] },
  'DANCE': { summary:'A Group C Fair skill.', sections:['15','29.14'] },
  'DIPLOMACY': { summary:'Determines the number of Tribes permitted in the Clan and can unlock Fair trading.', sections:['8.7.1','15.1','29.16'], limitations:['Diplomacy 7 is relevant to Fair trading.'] },
  'ECONOMICS': { summary:'Supports Fair trading and banking.', sections:['15.1','25','29.17'], limitations:['Fair trading begins at the levels specified in the Fair rules; Economics 10 is required to operate a Bank.'] },
  'FISHING': { summary:'Collects fish for food where there is suitable water access.', sections:['22','29.18'], limitations:['Requires suitable ocean, river or lake access.'] },
  'GARRISON': { summary:'Determines how many Garrison units a Tribe may have.', sections:['8.7.8','29.20'] },
  'HEALING': { summary:'Used to tend wounds and improve recovery after casualties.', sections:['13.1.13','17'], topics:['land-combat','naval-combat'] },
  'HEAVY WEAPONS': { summary:'Improves effectiveness when using heavy weapons such as ballistae in combat.', sections:['17','18.4','29.21'], topics:['land-combat','naval-combat'] },
  'HORSEMANSHIP': { summary:'Improves effectiveness when fighting mounted on horses.', sections:['17','29.22'], topics:['land-combat'] },
  'INTELLIGENCE': { summary:'Controls the information that may be requested through Intelligence activities.', sections:['13.1.16'] },
  'LEADERSHIP': { summary:'Improves effectiveness in land combat; Captaincy replaces it for Fleets.', sections:['17','17.15','29.23'], topics:['land-combat','naval-combat'] },
  'LITERACY': { summary:'Improves the ability to read and write books.', sections:['23.1','23.2','29.24'] },
  'MAINTAIN BOATS': { summary:'Used to maintain naval vessels.', sections:['20','29.25'], topics:['naval-combat'] },
  'MARINER': { summary:'Replaces Combat in Fleets and improves effectiveness in naval melee.', sections:['17.15','29.26'], topics:['naval-combat'] },
  'MOBILISATION': { summary:'Allows some Warriors who performed other activities to remain available for combat.', sections:['17','29.27'], topics:['land-combat','naval-combat'], limitations:['Combat availability remains subject to the overall one-third rule and assignment restrictions.'] },
  'NAVIGATION': { summary:'Increases Fleet movement.', sections:['21','29.28'], topics:['naval-combat'] },
  'POLITICS': { summary:'Research skill for territorial domination; level 10 enables a City.', sections:['24','29.29'] },
  'RELIGION ATHEISM': { summary:'Religious/atheist development skill; see the Religion rules for dynamic effects and local religious units.', sections:['27','29.30'] },
  'RESEARCH': { summary:'At level 10 enables construction of a University and supports research projects.', sections:['23','23.4','29.31'] },
  'ROWING': { summary:'Increases Fleet movement when rowing.', sections:['21','29.32'], topics:['naval-combat'] },
  'SAILING': { summary:'Increases Fleet movement when sailing.', sections:['21','29.33'], topics:['naval-combat'] },
  'SALTING': { summary:'Converts fish into preserved provisions.', sections:['22.2.1','29.34'] },
  'SANITATION': { summary:'Helps Villages withstand siege and improves Well effectiveness.', sections:['18','18.5.8','29.35'], topics:['land-combat'] },
  'SCOUTING': { summary:'Improves scouting operations used to explore, locate and support field operations.', sections:['16','29'], topics:['land-combat'] },
  'SEAMANSHIP': { summary:'General ocean-going expertise that increases Fleet movement for both rowing and sailing.', sections:['21','29.36'], topics:['naval-combat'] },
  'SECURITY': { summary:'Protects units and sites against hostile scouting, raiding and related operations.', sections:['16','29'], topics:['land-combat'] },
  'SHIPWRIGHT': { summary:'Controls how many people a Tribe may assign to ship construction.', sections:['20.3'], topics:['naval-combat'], limitations:['Worker limit is 10 people per skill level until level 10, then unlimited. A Shipyard of sufficient capacity is also required.'] },
  'SLAVERY': { summary:'Governs slave-related activity and restrictions.', sections:['13.1.31'] },
  'SPYING': { summary:'Supports covert information-gathering operations.', sections:['16','29'] },
  'TACTICS': { summary:'Limits raiding-party size, may improve land-combat effectiveness, and increases the permitted ranged proportion in field combat.', sections:['16.4.2','17','29.37'], topics:['land-combat'], limitations:['Raid parties are limited to 10 raiders per Tactics level per scouting party. Field ranged troops are limited to 25% + 1% per Tactics level.'] },
  'TORTURE': { summary:'A Group B skill associated with interrogation and information extraction.', sections:['29'] },
  'TRIBALL': { summary:'A Group B Fair skill associated with Triball activities and guild research.', sections:['15','29.38'] },
  'WHALING': { summary:'Determines the chance of catching whales and the number caught.', sections:['29.39'] },

  'ARMOUR': { summary:'Makes shields, helmets and body armour used to protect Warriors in combat.', sections:['13.1.1','17.10'], topics:['land-combat','naval-combat'] },
  'BONEWORK': { summary:'Turns bones into tools, weapons, frames and bone armour.', sections:['13.1.3'] },
  'BONING': { summary:'Processes slaughtered animals for bones and can be combined with Skinning and Gutting.', sections:['13.1.2'], limitations:['Worker-limited skill.'] },
  'CURING': { summary:'Converts skins/furs into leather using gut.', sections:['13.1.5'], limitations:['Worker-limited skill.'] },
  'DRESSING': { summary:'Converts skins/furs into leather using salt.', sections:['13.1.6'], limitations:['Worker-limited skill.'] },
  'EXCAVATION': { summary:'Resource-gathering skill used for excavation activities.', sections:['13','26'], limitations:['Worker-limited skill.'] },
  'FLETCHING': { summary:'Produces ammunition such as arrows.', sections:['13.1.7'], topics:['land-combat','naval-combat'], limitations:['Worker-limited skill.'] },
  'FORESTRY': { summary:'Harvests logs and bark in suitable terrain and supports charcoal production.', sections:['13.1.9','14.6.1'], limitations:['Worker-limited skill. Logs gathered this turn cannot normally be used in the same turn.'] },
  'FURRIER': { summary:'Processes furs into finished fur goods.', sections:['13.1.10'] },
  'GUTTING': { summary:'Processes slaughtered animals for gut and can be combined with Skinning and Boning.', sections:['13.1.12'], limitations:['Worker-limited skill.'] },
  'HERDING': { summary:'Manages domesticated animals; required manpower depends on herd size rather than increasing output with extra workers.', sections:['13.1.14'] },
  'HUNTING': { summary:'Produces food and animal products from hunting, affected by terrain, equipment and skill.', sections:['13.1.15'] },
  'JEWELLERY': { summary:'Produces jewellery and decorative valuables from metals and rare materials.', sections:['13.1.17'] },
  'LEATHERWORK': { summary:'Turns leather into clothing, shields, containers and other leather goods.', sections:['13.1.18'] },
  'METALWORK': { summary:'Produces metal fittings, tools and components and is a prerequisite for several advanced crafts/buildings.', sections:['13.1.21','14'] },
  'MINING': { summary:'Extracts mineral deposits identified in a hex.', sections:['13.1.22'], limitations:['A mineral deposit must be known to be present; research-derived deposits can require the relevant research.'] },
  'POTTERY': { summary:'Produces pottery containers from clay, with special water/terrain rules for clay sourcing.', sections:['13.1.24'], limitations:['Worker-limited skill.'] },
  'QUARRYING': { summary:'Extracts stone and related quarry materials from suitable deposits/terrain.', sections:['13.1.25'], limitations:['Worker-limited skill.'] },
  'SEWING': { summary:'Produces cloth-based clothing, sails and other sewn goods.', sections:['13.1.28'] },
  'SIEGE EQUIPMENT': { summary:'Produces siege engines and related equipment used against fortified positions.', sections:['13.1.29','18'], topics:['land-combat'] },
  'SKINNING': { summary:'Processes slaughtered animals for skins/furs and can be combined with Gutting and Boning.', sections:['13.1.30'], limitations:['Worker-limited skill.'] },
  'TANNING': { summary:'Converts hides/skins into leather through tanning.', sections:['13.1.33'], limitations:['Worker-limited skill.'] },
  'WAXWORK': { summary:'Produces goods from wax.', sections:['13.1.34'] },
  'WEAPONS': { summary:'Makes melee and other weapons used to equip Warriors.', sections:['13.1.35','17.10'], topics:['land-combat','naval-combat'] },
  'WEAVING': { summary:'Produces cloth, rope, nets and other woven goods used across production and naval activities.', sections:['13.1.36','22'], topics:['naval-combat'] },
  'WOODWORK': { summary:'Turns logs into shafts, frames, tools, equipment and other wooden goods.', sections:['13.1.37'] },

  'APIARISM': { summary:'Manages bees/apiaries and their products.', sections:['14','29'] },
  'BAKING': { summary:'Processes food through Bakery/Oven production.', sections:['14.8.1'], limitations:['Worker-limited skill.'] },
  'BRICK MAKING': { summary:'Produces bricks using Brickworks/Kiln production.', sections:['14.8.1'], limitations:['Worker-limited skill.'] },
  'COOKING': { summary:'Converts raw food materials into provisions.', sections:['13.1.4'], limitations:['Worker-limited skill.'] },
  'DISTILLING': { summary:'Produces distilled goods through Still/Distillery production.', sections:['14.8.1'] },
  'ENGINEERING': { summary:'Core construction skill for buildings, fortifications, Boatsheds, Shipyards and other structures.', sections:['14','18.5','20.1','20.2'], topics:['land-combat','naval-combat'] },
  'FARMING': { summary:'Produces agricultural crops; output depends on land, labour, skill and farming conditions.', sections:['Agriculture','29'] },
  'GLASSWORK': { summary:'Produces glass goods such as beads, panes, bottles and lenses.', sections:['13.1.11'] },
  'MILLING': { summary:'Processes agricultural materials through a Mill.', sections:['14'], limitations:['Worker-limited skill.'] },
  'MUSIC': { summary:'Supports musical performance and the manufacture of instruments with Woodwork/Metalwork prerequisites.', sections:['13.1.23'] },
  'REFINING': { summary:'Refines ores into usable metals using refinery installations and fuel.', sections:['14','14.8.1'], limitations:['Worker-limited skill.'] },
  'SEEKING': { summary:'Springtide activity used to search for certain resources; Rich Seeking can apply in special hexes.', sections:['13.1.26','13.1.27'], limitations:['Seasonal activity performed by Warriors.'] },
  'SHIPBUILDING': { summary:'Determines which vessels a Tribe can build; construction also requires Shipwright capacity, a suitable Shipyard and materials.', sections:['20.3','20.4'], topics:['naval-combat'] },
  'STONEWORK': { summary:'Produces worked stone goods and supports stone construction.', sections:['13.1.32','18.5'], topics:['land-combat'] }
};

const TOPICS = [
  {
    key:'land-combat', title:'Land Combat', section:'17',
    summary:'Field combat between land units. Numbers deployed are the largest factor, with terrain, weather, skills, weapons, armour, morale and research also contributing.',
    rules:[
      'Only up to one third of a unit’s available Warriors normally contribute to the overall battle total.',
      'Combat covers ranged troops, cavalry, infantry and heavy weapons, with ranged fire resolved before melee.',
      'Tactics controls the permitted ranged proportion in field combat: 25% plus 1% per Tactics level.',
      'Combat improves melee effectiveness; Leadership improves overall land-combat effectiveness; Horsemanship affects mounted fighting; Archery and Heavy Weapons affect their respective roles.',
      'Mobilisation can make some Warriors who performed other activities available for combat, subject to the Mandate’s exclusions and one-third ceiling.'
    ],
    coreSkills:['Combat','Leadership','Archery','Heavy Weapons','Horsemanship','Tactics','Mobilisation'],
    supportSkills:['Armour','Weapons','Fletching','Healing','Siege Equipment','Engineering','Stonework','Sanitation','Scouting','Security'],
    sections:['16','17','18','29.5','29.12','29.21','29.22','29.23','29.27','29.37']
  },
  {
    key:'naval-combat', title:'Naval Combat', section:'17.15',
    summary:'Combat between opposing Fleets. It is resolved as ship-versus-ship combat followed by Warrior combat, subject to surviving ship capacity and naval deployment limits.',
    rules:[
      'Mariner replaces Combat for Fleets.',
      'Captaincy replaces Leadership for Fleets.',
      'Archery remains the Archery skill and there is no cavalry component.',
      'The one-third Warrior availability limit still applies, and deployed Warriors are also capped by ship Defensive Points.',
      'Ship Damage Rating and Defensive Points drive the ship-versus-ship component before the Warrior melee component.',
      'Fleet movement and readiness depend on Navigation, Rowing/Sailing and Seamanship; ship construction and maintenance link to Shipbuilding, Shipwright, Engineering and Maintain Boats.'
    ],
    coreSkills:['Mariner','Captaincy','Archery','Heavy Weapons','Mobilisation'],
    supportSkills:['Navigation','Rowing','Sailing','Seamanship','Shipbuilding','Shipwright','Maintain Boats','Engineering','Weapons','Armour','Fletching','Healing','Weaving'],
    sections:['17.15','20','21','29.11','29.25','29.26','29.28','29.32','29.33','29.36']
  }
];

function detailForSkill(skill) {
  const key = canonical(skill.name);
  const detail = DETAILS[key] || {};
  const workerLimited = LIMITED_WORKER_SKILLS.has(key);
  return {
    summary: detail.summary || `Mandate-listed Group ${skill.skillGroup || skill.group || '?'} skill.`,
    sections: Array.from(new Set([skill.section, ...(detail.sections || [])].filter(Boolean))),
    limitations: [...(detail.limitations || []), ...(workerLimited && !(detail.limitations || []).some(x => /worker/i.test(x)) ? ['Worker limit: 10 people per skill level until level 10, then unlimited.'] : [])],
    topics: detail.topics || [],
    workerLimited
  };
}

function buildCompendiumCatalog(baseCatalog) {
  const recipes = baseCatalog?.recipes || [];
  const skills = (baseCatalog?.skills || []).map(skill => {
    const detail = detailForSkill(skill);
    const skillRecipes = recipes.filter(recipe => canonical(recipe.primarySkill) === canonical(skill.name));
    const relatedRequirements = recipes.filter(recipe => (recipe.requirements || []).some(req => canonical(req.skill) === canonical(skill.name)) && canonical(recipe.primarySkill) !== canonical(skill.name));
    return { ...skill, ...detail, recipes: skillRecipes, relatedRequirements };
  });
  return {
    version: baseCatalog?.version || 0,
    sourceDocument: baseCatalog?.sourceDocument || SOURCE_DOCUMENT,
    skills,
    topics: TOPICS
  };
}

module.exports = { SOURCE_DOCUMENT, LIMITED_WORKER_SKILLS, DETAILS, TOPICS, detailForSkill, buildCompendiumCatalog };
