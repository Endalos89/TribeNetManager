const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const {
  CATALOG_VERSION,
  SOURCE_DOCUMENT,
  SKILLS,
  RECIPES,
  canonical,
  resolveSkillDefinition
} = require('./mandate-catalog');

class MandateCatalogDatabase {
  constructor(userDataPath) {
    const dataDir = path.join(userDataPath, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    this.dbPath = path.join(dataDir, 'mandate-catalog.sqlite');
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migrate();
    this.seed();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS catalog_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mandate_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        shortname TEXT,
        skill_group TEXT,
        section TEXT NOT NULL,
        source_document TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mandate_skill_aliases (
        skill_id INTEGER NOT NULL REFERENCES mandate_skills(id) ON DELETE CASCADE,
        alias TEXT NOT NULL,
        canonical_alias TEXT NOT NULL UNIQUE
      );
      CREATE INDEX IF NOT EXISTS idx_mandate_alias_skill ON mandate_skill_aliases(skill_id);

      CREATE TABLE IF NOT EXISTS mandate_recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        activity_code TEXT NOT NULL,
        primary_skill TEXT NOT NULL,
        skill_level REAL NOT NULL DEFAULT 0,
        people REAL NOT NULL DEFAULT 0,
        section TEXT NOT NULL,
        output_item TEXT,
        output_quantity REAL,
        distinction TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        source_document TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mandate_recipe_skill ON mandate_recipes(primary_skill, skill_level, name);

      CREATE TABLE IF NOT EXISTS mandate_recipe_requirements (
        recipe_id INTEGER NOT NULL REFERENCES mandate_recipes(id) ON DELETE CASCADE,
        skill_name TEXT NOT NULL,
        level REAL NOT NULL,
        PRIMARY KEY(recipe_id, skill_name)
      );

      CREATE TABLE IF NOT EXISTS mandate_recipe_inputs (
        recipe_id INTEGER NOT NULL REFERENCES mandate_recipes(id) ON DELETE CASCADE,
        item TEXT NOT NULL,
        quantity REAL NOT NULL,
        optional INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(recipe_id, item)
      );

      CREATE TABLE IF NOT EXISTS mandate_recipe_facilities (
        recipe_id INTEGER NOT NULL REFERENCES mandate_recipes(id) ON DELETE CASCADE,
        facility TEXT NOT NULL,
        PRIMARY KEY(recipe_id, facility)
      );

      CREATE TABLE IF NOT EXISTS mandate_recipe_conditions (
        recipe_id INTEGER NOT NULL REFERENCES mandate_recipes(id) ON DELETE CASCADE,
        condition_text TEXT NOT NULL,
        PRIMARY KEY(recipe_id, condition_text)
      );
    `);
  }

  seed() {
    const stored = this.db.prepare("SELECT value FROM catalog_metadata WHERE key='catalog_version'").get();
    if (Number(stored?.value || 0) === CATALOG_VERSION) return;

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db.exec(`
        DELETE FROM mandate_recipe_conditions;
        DELETE FROM mandate_recipe_facilities;
        DELETE FROM mandate_recipe_inputs;
        DELETE FROM mandate_recipe_requirements;
        DELETE FROM mandate_recipes;
        DELETE FROM mandate_skill_aliases;
        DELETE FROM mandate_skills;
      `);

      const insertSkill = this.db.prepare(`
        INSERT INTO mandate_skills(name, shortname, skill_group, section, source_document)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertAlias = this.db.prepare(`
        INSERT OR IGNORE INTO mandate_skill_aliases(skill_id, alias, canonical_alias) VALUES (?, ?, ?)
      `);

      for (const skill of SKILLS) {
        const result = insertSkill.run(skill.name, skill.shortname || null, skill.group || null, skill.section || '12.2', SOURCE_DOCUMENT);
        const skillId = Number(result.lastInsertRowid);
        const aliases = new Set([skill.name, skill.shortname].filter(Boolean));
        for (const alias of aliases) insertAlias.run(skillId, alias, canonical(alias));
      }

      // Store every alias that resolves through the canonical Mandate catalogue, including compatibility aliases.
      const aliasCandidates = [
        'Weapon','Weapon Making','Weaponmaking','Siege','Siege Equipment Making','Brickmaking','Bricks',
        'Boat Maintenance','Maintenance','Woodworking','Religion','Atheism'
      ];
      for (const alias of aliasCandidates) {
        const def = resolveSkillDefinition(alias);
        if (!def) continue;
        const row = this.db.prepare('SELECT id FROM mandate_skills WHERE name=?').get(def.name);
        if (row) insertAlias.run(Number(row.id), alias, canonical(alias));
      }

      const insertRecipe = this.db.prepare(`
        INSERT INTO mandate_recipes(
          recipe_key, name, activity_code, primary_skill, skill_level, people, section,
          output_item, output_quantity, distinction, notes, source_document
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertRequirement = this.db.prepare(`INSERT INTO mandate_recipe_requirements(recipe_id, skill_name, level) VALUES (?, ?, ?)`);
      const insertInput = this.db.prepare(`INSERT INTO mandate_recipe_inputs(recipe_id, item, quantity, optional) VALUES (?, ?, ?, ?)`);
      const insertFacility = this.db.prepare(`INSERT INTO mandate_recipe_facilities(recipe_id, facility) VALUES (?, ?)`);
      const insertCondition = this.db.prepare(`INSERT INTO mandate_recipe_conditions(recipe_id, condition_text) VALUES (?, ?)`);

      for (const item of RECIPES) {
        const result = insertRecipe.run(
          item.key, item.name, item.activityCode, item.primarySkill, Number(item.skillLevel || 0), Number(item.people || 0), item.section,
          item.output?.item || null, item.output?.quantity == null ? null : Number(item.output.quantity), item.distinction || '', item.notes || '', SOURCE_DOCUMENT
        );
        const recipeId = Number(result.lastInsertRowid);
        insertRequirement.run(recipeId, item.primarySkill, Number(item.skillLevel || 0));
        for (const requirement of item.requirements || []) insertRequirement.run(recipeId, requirement.skill, Number(requirement.level || 0));
        for (const resource of item.inputs || []) insertInput.run(recipeId, resource.item, Number(resource.quantity || 0), resource.optional ? 1 : 0);
        for (const facility of item.facilities || []) insertFacility.run(recipeId, facility);
        for (const condition of item.conditions || []) insertCondition.run(recipeId, condition);
      }

      this.db.prepare(`
        INSERT INTO catalog_metadata(key, value) VALUES ('catalog_version', ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
      `).run(String(CATALOG_VERSION));
      this.db.prepare(`
        INSERT INTO catalog_metadata(key, value) VALUES ('source_document', ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
      `).run(SOURCE_DOCUMENT);
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  listSkills() {
    return this.db.prepare(`
      SELECT id, name, shortname, skill_group AS skillGroup, section, source_document AS sourceDocument
      FROM mandate_skills ORDER BY name
    `).all().map(row => ({
      ...row,
      aliases: this.db.prepare('SELECT alias FROM mandate_skill_aliases WHERE skill_id=? ORDER BY alias').all(row.id).map(x => x.alias)
    }));
  }

  resolveSkill(value) {
    const key = canonical(value);
    if (!key) return null;
    return this.db.prepare(`
      SELECT s.id, s.name, s.shortname, s.skill_group AS skillGroup, s.section, s.source_document AS sourceDocument
      FROM mandate_skill_aliases a
      JOIN mandate_skills s ON s.id=a.skill_id
      WHERE a.canonical_alias=?
    `).get(key) || null;
  }

  recipeRowsForSkill(value) {
    const skill = this.resolveSkill(value);
    if (!skill) return [];
    return this.db.prepare(`
      SELECT id, recipe_key AS recipeKey, name, activity_code AS activityCode, primary_skill AS primarySkill,
             skill_level AS skillLevel, people, section, output_item AS outputItem, output_quantity AS outputQuantity,
             distinction, notes, source_document AS sourceDocument
      FROM mandate_recipes WHERE primary_skill=? ORDER BY skill_level, name
    `).all(skill.name).map(row => this.hydrateRecipe(row));
  }

  hydrateRecipe(row) {
    const id = Number(row.id);
    return {
      ...row,
      requirements: this.db.prepare('SELECT skill_name AS skill, level FROM mandate_recipe_requirements WHERE recipe_id=? ORDER BY skill_name').all(id),
      inputs: this.db.prepare('SELECT item, quantity, optional FROM mandate_recipe_inputs WHERE recipe_id=? ORDER BY rowid').all(id).map(x => ({ ...x, optional: Boolean(x.optional) })),
      facilities: this.db.prepare('SELECT facility FROM mandate_recipe_facilities WHERE recipe_id=? ORDER BY rowid').all(id).map(x => x.facility),
      conditions: this.db.prepare('SELECT condition_text AS conditionText FROM mandate_recipe_conditions WHERE recipe_id=? ORDER BY rowid').all(id).map(x => x.conditionText)
    };
  }

  getCatalog() {
    const recipes = this.db.prepare(`
      SELECT id, recipe_key AS recipeKey, name, activity_code AS activityCode, primary_skill AS primarySkill,
             skill_level AS skillLevel, people, section, output_item AS outputItem, output_quantity AS outputQuantity,
             distinction, notes, source_document AS sourceDocument
      FROM mandate_recipes ORDER BY primary_skill, skill_level, name
    `).all().map(row => this.hydrateRecipe(row));
    return {
      version: CATALOG_VERSION,
      sourceDocument: SOURCE_DOCUMENT,
      skills: this.listSkills(),
      recipes
    };
  }

  close() {
    if (this.db) this.db.close();
  }
}

module.exports = { MandateCatalogDatabase };
