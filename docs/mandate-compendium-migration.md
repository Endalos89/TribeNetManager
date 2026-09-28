# Mandate → Compendium migration

The TribeNet Mandate migration is complete. All five review batches are now stored in the Compendium data set using TribeNet Mandate TN3 Revision N02.2 (16 July 2026) as the canonical source.

| Batch | Scope | Status |
| --- | --- | --- |
| 1 | §§1–12 — Core game & rules framework | Complete |
| 2 | §§13–14 — Activities & villages | Complete |
| 3 | §§15–19 — Trade, scouting & combat | Complete |
| 4 | §§20–27 — Naval & advanced systems | Complete |
| 5 | §§28–35 + Appendix A — Remaining references & final audit | Complete |

The final audit confirms 408 Mandate headings and subheadings across §§1–35 and Appendix A.

## Compendium reader

The completed data set is presented as one continuous Mandate document inside the Compendium. The Compendium navigation contains a single **Mandate** entry rather than migration-batch controls.

The Mandate reader:

- renders all 408 indexed headings/subheadings in source order;
- preserves the imported wording exactly in paragraphs and tables;
- provides a sticky bookmark tree with top-level sections and expandable subsections;
- highlights the current bookmark while scrolling;
- lets bookmark clicks jump directly to the corresponding section;
- converts explicit Mandate cross-references (for example, “section 13.4”, “§ 20.5.1”, or “Appendix A”) into in-document links without changing the displayed words;
- allows Compendium skill, entity, topic and search results to open the full Mandate directly at the relevant section.

The earlier Batch 1–5 progress cards and word-for-word reference modal are no longer part of the active Compendium interface. Their migration-era source files remain in the repository history, while the runtime now loads the complete Mandate data before the Compendium reader is initialized.
