# Group C Skill Audit

Final reconciliation for the Compendium skill-dossier rollout.

## Authoritative sources

- TribeNet Mandate TN3 Revision N02.2 (July 16 2026), especially section 12.2 Skill Groups.
- TribeNet Research List, April 11 2026.

The Mandate rule is important: skills that merely remain in the Excel Orders valid-skill list are not current Skill Attempts unless they are listed in the current Mandate skill table or are introduced as new Research skills.

## Current Group C set

### Mandate N02.2 table — 24 skills

1. Archaeology
2. Architecture
3. Alchemy
4. Apiarism
5. Art
6. Banking
7. Baking
8. Brick Making
9. Cooking
10. Dance
11. Distilling
12. Engineering
13. Farming
14. Glasswork
15. Literacy
16. Maintain Boats
17. Milling
18. Music
19. Refining
20. Research
21. Sanitation
22. Seeking
23. Shipbuilding
24. Stonework

### Explicit Research-unlocked Group C skills — 6 skills

1. Apiology — unlocked by Apiology I in the Apiarism research chain.
2. Agriculture — unlocked by Agriculture I in the Farming research chain.
3. Cheesemaking — created by Dairy Cattle research.
4. Geology — unlocked by Geology I in the Mining research chain.
5. Ranger — unlocked by Ranger I in the Scouting research chain.
6. Bush Lore — unlocked by Bush Lore I in the Seeking research chain.

**Final current Group C total: 30 skills.**

## Research-access skills

Apiology, Agriculture, Geology, Ranger and Bush Lore are progression/access skills. Their skill levels exist to unlock the later IV+ research chains; their published benefits are delivered by the associated research topics to Apiarism, Farming, Mining, Scouting or Seeking respectively. They must not be given invented worker/output activities.

Cheesemaking is different: it is a Research-created production skill with a normal worker-capacity model and its own Milk-to-Cheese conversion.

## Not restored as current Group C Skill Attempts

- **Design** — N02.2 says it is gone for the time being and it is not in the current Group C table.
- **Furniture** — N02.2 says it is gone for the time being and it is not in the current Group C table.
- **Astronomy** — N02.2 calls it research-only, but it is not in the current Group C table and the current Research List does not explicitly introduce it as a new Group C skill.

These may still appear in historic data or old valid-skill lists. That is not sufficient to make them current Skill Attempts.

## Regression requirement

`tests/skill-overhaul-category-c5-final.test.js` loads all five Group C dossier batches and asserts the exact 30-skill set. It also asserts that Design, Furniture and Astronomy are not accidentally restored as current Group C dossiers.

Any future rules update that changes Group C should update this audit, the dossier data and the exact-set regression together.
