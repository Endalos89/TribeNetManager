const path = require('path');

const DIRECTIONS = new Set(['N', 'NE', 'SE', 'S', 'SW', 'NW']);
const KNOWLEDGE_RANK = { attempted: 1, observed: 2, scouted: 3, visited: 4 };

const TERRAIN_ALIASES = new Map([
  ['UNKNOWN', 'UNKNOWN'],
  ['ALPS', 'ALPS'],
  ['ARID', 'AR'], ['AR', 'AR'],
  ['BRUSH HILL', 'BH'], ['BRUSH HILLS', 'BH'], ['BH', 'BH'],
  ['BRUSH', 'BR'], ['BR', 'BR'],
  ['CONIFER HILL', 'CH'], ['CONIFER HILLS', 'CH'], ['CH', 'CH'],
  ['DESERT', 'DE'], ['DE', 'DE'],
  ['DECIDUOUS', 'D'], ['D', 'D'],
  ['DECIDUOUS HILL', 'DH'], ['DECIDUOUS HILLS', 'DH'], ['DH', 'DH'],
  ['GRASSY HILL', 'GH'], ['GRASSY HILLS', 'GH'], ['GH', 'GH'],
  ['GRASSY HILL PLATEAU', 'GHP'], ['GHP', 'GHP'],
  ['HIGH MOUNTAIN', 'HSM'], ['HIGH MOUNTAINS', 'HSM'], ['HSM', 'HSM'],
  ['JUNGLE', 'JG'], ['JG', 'JG'],
  ['JUNGLE HILL', 'JH'], ['JUNGLE HILLS', 'JH'], ['JH', 'JH'],
  ['LAKE', 'L'], ['L', 'L'],
  ['LOW ARID MOUNTAIN', 'LAM'], ['LOW ARID MOUNTAINS', 'LAM'], ['LAM', 'LAM'],
  ['LOW CONIFER MOUNTAIN', 'LCM'], ['LOW CONIFER MOUNTAINS', 'LCM'], ['LOW CONIFER MNTS', 'LCM'], ['LCM', 'LCM'],
  ['LOW JUNGLE MOUNTAIN', 'LJM'], ['LOW JUNGLE MOUNTAINS', 'LJM'], ['LJM', 'LJM'],
  ['LOW SNOWY MOUNTAIN', 'LSM'], ['LOW SNOWY MOUNTAINS', 'LSM'], ['LSM', 'LSM'],
  ['LOW VOLCANIC MOUNTAIN', 'LVM'], ['LOW VOLCANIC MOUNTAINS', 'LVM'], ['LVM', 'LVM'],
  ['OCEAN', 'O'], ['O', 'O'],
  ['PLATEAU PRAIRIE', 'PP'], ['PP', 'PP'],
  ['PLATEAU GRASSY HILL', 'PGH'], ['PLATEAU GRASSY HILLS', 'PGH'], ['PGH', 'PGH'],
  ['POLAR ICE', 'PI'], ['PI', 'PI'],
  ['PRAIRIE', 'PR'], ['PR', 'PR'],
  ['PRAIRIE PLATEAU', 'PPR'], ['PPR', 'PPR'],
  ['ROCKY HILL', 'RH'], ['ROCKY HILLS', 'RH'], ['RH', 'RH'],
  ['SNOW HILL', 'SH'], ['SNOW HILLS', 'SH'], ['SH', 'SH'],
  ['SWAMP', 'SW'], ['SW', 'SW'],
  ['TUNDRA', 'TU'], ['TU', 'TU']
]);

const SECTION_NAMES = new Set(['Humans', 'Animals', 'Minerals', 'War Equipment', 'Finished Goods', 'Raw Materials', 'Ships']);
const UNIT_HEADER_RE = /^(Tribe|Element|Fleet|Garrison)\s+([^,\s]+).*?Current Hex\s*=\s*([^,]+),\s*\(Previous Hex\s*=\s*([^\)]+)\)/i;

function normalizeTerrain(value) {
  if (!value) return 'UNKNOWN';
  const key = String(value).trim().replace(/\s+/g, ' ').toUpperCase();
  return TERRAIN_ALIASES.get(key) || key;
}

function normalizeCoordinate(value) {
  if (!value) return null;
  const compact = String(value).trim().toUpperCase().replace(/\s+/g, '');
  if (compact === 'N/A' || compact === 'NA') return null;
  return /^[A-Z][A-P]\d{4}$/.test(compact) ? compact : null;
}

function parseCoordinate(input) {
  const coordinate = normalizeCoordinate(input);
  if (!coordinate) return null;
  const match = coordinate.match(/^([A-Z])([A-P])(\d{2})(\d{2})$/);
  if (!match) return null;
  const mapRow = match[1].charCodeAt(0) - 65;
  const mapCol = match[2].charCodeAt(0) - 65;
  const hexCol = Number(match[3]);
  const hexRow = Number(match[4]);
  if (hexCol < 1 || hexCol > 30 || hexRow < 1 || hexRow > 21) return null;
  return {
    coordinate,
    mapRow,
    mapCol,
    hexCol,
    hexRow,
    globalCol: mapCol * 30 + hexCol - 1,
    globalRow: mapRow * 21 + hexRow - 1
  };
}

function coordinateFor(globalCol, globalRow) {
  if (globalCol < 0 || globalRow < 0 || globalCol >= 16 * 30 || globalRow >= 26 * 21) return null;
  const mapCol = Math.floor(globalCol / 30);
  const mapRow = Math.floor(globalRow / 21);
  const hexCol = globalCol % 30 + 1;
  const hexRow = globalRow % 21 + 1;
  return `${String.fromCharCode(65 + mapRow)}${String.fromCharCode(65 + mapCol)}${String(hexCol).padStart(2, '0')}${String(hexRow).padStart(2, '0')}`;
}

function stepCoordinate(coordinate, direction) {
  const parsed = typeof coordinate === 'string' ? parseCoordinate(coordinate) : coordinate;
  if (!parsed || !DIRECTIONS.has(direction)) return null;
  let c = parsed.globalCol;
  let r = parsed.globalRow;
  const odd = c % 2 === 1;
  if (direction === 'N') r -= 1;
  else if (direction === 'S') r += 1;
  else if (direction === 'NE') { c += 1; r += odd ? 0 : -1; }
  else if (direction === 'SE') { c += 1; r += odd ? 1 : 0; }
  else if (direction === 'NW') { c -= 1; r += odd ? 0 : -1; }
  else if (direction === 'SW') { c -= 1; r += odd ? 1 : 0; }
  return coordinateFor(c, r);
}

function turnSort(turnKey) {
  const match = String(turnKey || '').match(/(\d+)\D+(\d+)/);
  return match ? Number(match[1]) * 1000 + Number(match[2]) : 0;
}

function splitLines(rawText) {
  return String(rawText || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean);
}

function parseNumber(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePackedInventory(line) {
  const result = {};
  const text = String(line || '').trim();
  if (!text || /^None$/i.test(text)) return result;

  // Results DOCX reports use tab stops to place several label/value pairs on one line,
  // e.g. "Cattle\t532\tGoat\t3924\tHorse\t387". Parse that structure first.
  const tabParts = text.split(/\t+/).map(part => part.trim()).filter(Boolean);
  if (tabParts.length >= 2) {
    for (let i = 0; i + 1 < tabParts.length; i += 2) {
      const key = tabParts[i].replace(/\s+/g, ' ').trim();
      const value = parseNumber(tabParts[i + 1]);
      if (key && value != null) result[key] = value;
    }
    if (Object.keys(result).length) return result;
  }

  // Fallback for reports/text fixtures where the tab layout has been flattened.
  const re = /([A-Za-z][A-Za-z0-9\/.'’() -]*?)\s*(-?\d[\d,]*(?:\.\d+)?)(?=\s*[A-Z]|$)/g;
  let match;
  while ((match = re.exec(text))) {
    const key = match[1].trim().replace(/\s+/g, ' ');
    const value = parseNumber(match[2]);
    if (key && value != null) result[key] = value;
  }
  return result;
}

function parseSkills(line) {
  const skills = {};
  for (const part of String(line || '').split(',')) {
    const match = part.trim().match(/^(.+?)\s+(-?\d+(?:\.\d+)?)$/);
    if (match) skills[match[1].trim()] = Number(match[2]);
  }
  return skills;
}

function addKnowledge(knowledgeMap, entry) {
  if (!entry?.coordinate) return;
  const existing = knowledgeMap.get(entry.coordinate);
  const incoming = {
    coordinate: entry.coordinate,
    terrain: normalizeTerrain(entry.terrain),
    knowledgeLevel: entry.knowledgeLevel || 'observed',
    reason: entry.reason || '',
    sourceUnit: entry.sourceUnit || null,
    scoutId: entry.scoutId || null,
    observedUnits: Array.from(new Set(entry.observedUnits || [])),
    evidence: entry.evidence ? [entry.evidence] : []
  };
  if (!existing) {
    knowledgeMap.set(entry.coordinate, incoming);
    return;
  }
  const mergedUnits = new Set([...(existing.observedUnits || []), ...(incoming.observedUnits || [])]);
  const mergedEvidence = [...(existing.evidence || []), ...(incoming.evidence || [])];
  const oldRank = KNOWLEDGE_RANK[existing.knowledgeLevel] || 0;
  const newRank = KNOWLEDGE_RANK[incoming.knowledgeLevel] || 0;
  if (newRank > oldRank) {
    knowledgeMap.set(entry.coordinate, { ...incoming, observedUnits: [...mergedUnits], evidence: mergedEvidence });
  } else {
    existing.observedUnits = [...mergedUnits];
    existing.evidence = mergedEvidence;
    if ((!existing.terrain || existing.terrain === 'UNKNOWN') && incoming.terrain !== 'UNKNOWN') existing.terrain = incoming.terrain;
    if (!existing.reason && incoming.reason) existing.reason = incoming.reason;
  }
}

function parseRouteKnowledge(rawLine, startCoordinate, knowledgeMap, options = {}) {
  if (!startCoordinate || !rawLine) return startCoordinate;
  const sourceUnit = options.sourceUnit || null;
  const scoutId = options.scoutId || null;
  const movementLevel = options.movementLevel || 'scouted';
  let routeText = String(rawLine);
  routeText = routeText.replace(/^.*?:\s*(?:Scout\s*)?/i, '');
  routeText = routeText.replace(/^Move\s+/i, '');
  const failMatch = routeText.match(/Not enough M\.P'?s to move to\s+(N|NE|SE|S|SW|NW)\s+into\s+([^,]+)/i);
  const patrolledMatch = routeText.match(/Patrolled and found\s+([A-Za-z0-9]+)/i);
  const beforeFailure = routeText.split(/Not enough M\.P'?s/i)[0];
  const normalized = beforeFailure.replace(/\\/g, ',');
  const tokens = normalized.split(',').map(x => x.trim()).filter(Boolean);
  let current = startCoordinate;
  for (const token of tokens) {
    let match = token.match(/^(N|NE|SE|S|SW|NW)-([A-Za-z]+)$/i);
    if (match) {
      const direction = match[1].toUpperCase();
      const next = stepCoordinate(current, direction);
      if (next) {
        current = next;
        addKnowledge(knowledgeMap, {
          coordinate: current,
          terrain: match[2],
          knowledgeLevel: movementLevel,
          sourceUnit,
          scoutId,
          reason: movementLevel === 'visited' ? 'Unit moved through this hex' : 'Scout entered this hex',
          evidence: token
        });
      }
      continue;
    }
    match = token.match(/^([A-Za-z]+)\s+(N|NE|SE|S|SW|NW)$/i);
    if (match) {
      const terrain = normalizeTerrain(match[1]);
      if (terrain !== match[1].toUpperCase() || TERRAIN_ALIASES.has(match[1].toUpperCase())) {
        const observed = stepCoordinate(current, match[2].toUpperCase());
        if (observed) {
          addKnowledge(knowledgeMap, {
            coordinate: observed,
            terrain,
            knowledgeLevel: 'observed',
            sourceUnit,
            scoutId,
            reason: 'Observed from an adjacent hex',
            evidence: token
          });
        }
        continue;
      }
    }
    match = token.match(/^see\s+([A-Za-z0-9]+)/i);
    if (match) {
      addKnowledge(knowledgeMap, {
        coordinate: current,
        terrain: 'UNKNOWN',
        knowledgeLevel: movementLevel,
        sourceUnit,
        scoutId,
        observedUnits: [match[1]],
        reason: `Observed unit ${match[1]}`,
        evidence: token
      });
    }
  }
  if (failMatch) {
    const attempted = stepCoordinate(current, failMatch[1].toUpperCase());
    if (attempted) {
      addKnowledge(knowledgeMap, {
        coordinate: attempted,
        terrain: failMatch[2],
        knowledgeLevel: 'attempted',
        sourceUnit,
        scoutId,
        reason: 'Scout did not have enough movement points to enter this hex',
        evidence: failMatch[0]
      });
    }
  }
  if (patrolledMatch) {
    addKnowledge(knowledgeMap, {
      coordinate: current,
      terrain: 'UNKNOWN',
      knowledgeLevel: movementLevel,
      sourceUnit,
      scoutId,
      observedUnits: [patrolledMatch[1]],
      reason: `Patrolled and found ${patrolledMatch[1]}`,
      evidence: patrolledMatch[0]
    });
  }
  return current;
}

function parseUnitSection(lines, startIndex, reportTurn, knowledgeMap) {
  const header = lines[startIndex].match(UNIT_HEADER_RE);
  if (!header) return { unit: null, nextIndex: startIndex + 1, events: [] };
  const unitType = header[1][0].toUpperCase() + header[1].slice(1).toLowerCase();
  const unitCode = header[2];
  const currentHex = normalizeCoordinate(header[3]);
  const previousHex = normalizeCoordinate(header[4]);
  const unit = {
    unitType,
    unitCode,
    currentHex,
    previousHex,
    turnKey: reportTurn.turnKey,
    statusTerrain: 'UNKNOWN',
    statusNotes: '',
    people: {},
    resources: {},
    skills: {},
    morale: null,
    weight: null,
    walkingCapacity: null,
    mountedCapacity: null,
    movementWeight: null,
    movementWalkingCapacity: null,
    movementMountedCapacity: null,
    movement: null,
    scouts: []
  };
  const events = [];
  let i = startIndex + 1;
  let currentSection = null;
  let skillsPending = false;
  while (i < lines.length && !UNIT_HEADER_RE.test(lines[i])) {
    const line = lines[i];
    const turnMatch = line.match(/^Current Turn\s+([^\s,]+)/i);
    if (turnMatch) { unit.turnKey = turnMatch[1]; i += 1; continue; }
    if (/Activities/i.test(line)) {
      events.push({ unitCode, eventType: 'activities', message: line });
      i += 1;
      continue;
    }
    const movementCapacity = line.match(/^Movement Weight:\s*([\d,.-]+)\s+Walking Capacity:\s*([\d,.-]+)\s+Mounted Capacity:\s*([\d,.-]+)/i);
    if (movementCapacity) {
      unit.movementWeight = parseNumber(movementCapacity[1]);
      unit.movementWalkingCapacity = parseNumber(movementCapacity[2]);
      unit.movementMountedCapacity = parseNumber(movementCapacity[3]);
      i += 1;
      continue;
    }
    const movementMatch = line.match(/^(?:Tribe|Element|Fleet|Garrison)?\s*Movement:\s*(.+)$/i);
    if (movementMatch) {
      unit.movement = movementMatch[1].trim();
      events.push({ unitCode, eventType: 'movement', message: line });
      i += 1;
      continue;
    }
    const scoutMatch = line.match(/^Scout\s+(\d+):\s*(.+)$/i);
    if (scoutMatch) {
      const scout = { id: Number(scoutMatch[1]), report: scoutMatch[2].trim(), raw: line };
      unit.scouts.push(scout);
      events.push({ unitCode, eventType: 'scout', message: line, details: { scoutId: scout.id } });
      i += 1;
      continue;
    }
    const escapedCode = unitCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const statusMatch = line.match(new RegExp(`^${escapedCode}\\s+Status:\\s*([^,]+)(?:,\\s*(.*))?$`, 'i'));
    if (statusMatch) {
      unit.statusTerrain = normalizeTerrain(statusMatch[1]);
      unit.statusNotes = (statusMatch[2] || '').trim();
      i += 1;
      continue;
    }
    if (SECTION_NAMES.has(line)) {
      currentSection = line;
      unit.resources[currentSection] ||= {};
      skillsPending = false;
      i += 1;
      continue;
    }
    if (/^Skills\s*:/i.test(line)) {
      currentSection = null;
      skillsPending = true;
      const inline = line.replace(/^Skills\s*:\s*/i, '').trim();
      if (inline) unit.skills = { ...unit.skills, ...parseSkills(inline) };
      i += 1;
      continue;
    }
    if (skillsPending && /^(?:[A-Za-z][A-Za-z0-9&/.' -]*\s+-?\d+(?:\.\d+)?\s*,?\s*)+$/.test(line)) {
      unit.skills = { ...unit.skills, ...parseSkills(line) };
      skillsPending = false;
      i += 1;
      continue;
    }
    let match = line.match(/^Morale\s*:\s*([\d,.-]+)/i);
    if (match) { unit.morale = parseNumber(match[1]); currentSection = null; i += 1; continue; }
    match = line.match(/^Weight\s*:\s*([\d,.-]+)/i);
    if (match) { unit.weight = parseNumber(match[1]); currentSection = null; i += 1; continue; }
    match = line.match(/^Walking CC\s*:\s*([\d,.-]+)/i);
    if (match) { unit.walkingCapacity = parseNumber(match[1]); currentSection = null; i += 1; continue; }
    match = line.match(/^Mounted CC\s*:\s*([\d,.-]+)/i);
    if (match) { unit.mountedCapacity = parseNumber(match[1]); currentSection = null; i += 1; continue; }
    if (currentSection) {
      const packed = parsePackedInventory(line);
      if (Object.keys(packed).length) {
        Object.assign(unit.resources[currentSection], packed);
        if (currentSection === 'Humans') Object.assign(unit.people, packed);
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  if (currentHex) {
    addKnowledge(knowledgeMap, {
      coordinate: currentHex,
      terrain: unit.statusTerrain,
      knowledgeLevel: 'visited',
      sourceUnit: unitCode,
      reason: `${unitType} ${unitCode} occupied this hex`,
      evidence: `${unitCode} Status: ${unit.statusTerrain}`
    });
  }
  if (unit.movement) {
    const origin = previousHex || currentHex;
    if (origin) parseRouteKnowledge(unit.movement, origin, knowledgeMap, { sourceUnit: unitCode, movementLevel: 'visited' });
  }
  for (const scout of unit.scouts) {
    if (currentHex) parseRouteKnowledge(scout.raw, currentHex, knowledgeMap, { sourceUnit: unitCode, scoutId: scout.id, movementLevel: 'scouted' });
  }
  return { unit, nextIndex: i, events };
}

function parseResultText(rawText, sourceFile = 'Results.docx') {
  const lines = splitLines(rawText);
  const turnLine = lines.find(line => /^Current Turn\s+/i.test(line));
  if (!turnLine) throw new Error('Could not find a Current Turn line in this results report.');
  const turnMatch = turnLine.match(/^Current Turn\s+([^\s,]+)(?:\s+\(#?(\d+)\))?,?\s*([^,]*)?,?\s*(.*)$/i);
  const turnKey = turnMatch?.[1];
  if (!turnKey) throw new Error('Could not determine the turn key from this results report.');
  const nextTurnMatch = turnLine.match(/Next Turn\s+([^\s,]+)/i);
  const report = {
    turnKey,
    turnSort: turnSort(turnKey),
    sourceFile: path.basename(sourceFile || 'Results.docx'),
    metadata: {
      sequence: turnMatch?.[2] ? Number(turnMatch[2]) : null,
      season: (turnMatch?.[3] || '').trim() || null,
      weatherAndNextTurn: (turnMatch?.[4] || '').trim() || null,
      nextTurn: nextTurnMatch?.[1] || null
    },
    units: [],
    events: [],
    hexKnowledge: []
  };
  const knowledgeMap = new Map();
  let i = 0;
  while (i < lines.length) {
    if (UNIT_HEADER_RE.test(lines[i])) {
      const parsed = parseUnitSection(lines, i, report, knowledgeMap);
      if (parsed.unit) report.units.push(parsed.unit);
      report.events.push(...parsed.events);
      i = parsed.nextIndex;
    } else {
      i += 1;
    }
  }
  if (!report.units.length) throw new Error('No Tribe, Element, Fleet or Garrison sections were found in this results report.');
  report.hexKnowledge = [...knowledgeMap.values()];
  return report;
}

async function parseResultDocument(filePath) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return parseResultText(result.value, filePath);
}

module.exports = {
  parseResultDocument,
  parseResultText,
  parseCoordinate,
  coordinateFor,
  stepCoordinate,
  normalizeTerrain,
  turnSort,
  parsePackedInventory
};
