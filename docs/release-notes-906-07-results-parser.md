# 906-07 results report parser and map sightings

Release notes for the results report update merged in PR #160.

- Recognise the 906-07 activity wording for Hunting, Skin/Gut/Bone, woodcutting, curing, tanning and crafting, including worker limits and production inputs/outputs.
- Parse livestock herding allocations, breeding, straying and already-herded outcomes.
- Record per-unit Goods Tribe relationships, scouting group failure notices and transfer summary evidence without inventing successful transfer quantities.
- Record adjacent ocean observations and other units encountered in reports.
- Show scouted units from other tribes, such as `1468e1` at `PK1405`, on the map as last-seen observations, without adding them to the player's controlled unit roster.
- Correct results playback parsing for the newer activity wording and non-consumed hunting tools.

Regression coverage: `tests/results-resources.test.js`, `tests/results-start-state.test.js`, and `tests/results-playback.test.js`.

Pull request: https://github.com/Endalos89/TribeNetManager/pull/160
