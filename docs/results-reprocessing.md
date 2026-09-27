# Results report reprocessing

TribeNet Manager keeps the parsed results database separate from the original Word results reports.

## Import behaviour

When a `.docx` results report is imported, the report is parsed and a local source copy is stored under the application's persistent data directory. The saved source is keyed by turn, so importing a corrected report for the same turn replaces both the parsed snapshot and the retained source report for that turn.

These source copies live outside the installed application directory and therefore survive application updates.

## Reprocess All Reports

The Tribe Manager includes a **Reprocess All Reports** action. It:

1. creates a results database backup;
2. reads each retained source report in turn order;
3. runs the current results parser over the source report;
4. replaces the parsed snapshot for that turn;
5. reports successful turns, failures, and turns without a retained source.

Reprocessing never needs the user's original file location after the first archived import.

## Legacy imports

Reports imported before source archiving was introduced do not have a retained `.docx` copy. Those turns require one one-time re-import. Once re-imported, subsequent parser changes can be applied using **Reprocess All Reports** without selecting the files again.
