const path = require('path');

const DIRECTIONS = new Set(['N', 'NE', 'SE', 'S', 'SW', 'NW']);
const KNOWLEDGE_RANK = { attempted: 1, observed: 2, scouted: 3, visited: 4 };
const RESOURCE_ALIASES = new Map([
  ['COAL', 'Coal'], ['COPPER', 'Copper'], ['COPPER ORE', 'Copper Ore'],
  ['DIAMOND', 'Diamond'], ['GOLD', 'Gold'], ['IRON', 'Iron'], ['IRON ORE', 'Iron Ore'],
  ['JADE', 'Jade'], ['KAOLIN', 'Kaolin'], ['LEAD', 'Lead'], ['LEAD ORE', 'Lead Ore'],
  ['LIMESTONE', 'Limestone'], ['NICKEL', 'Nickel'], ['NICKEL ORE', 'Nickel Ore'],
  ['RUBIES', 'Rubies'], ['SALT', 'Salt'], ['SILVER', 'Silver'], ['SULPHUR', 'Sulphur'],
  ['TIN', 'Tin'], ['TIN ORE', 'Tin Ore'], ['VANADIUM', 'Vanadium'], ['VANADIUM ORE', 'Vanadium Ore'],
  ['ZINC', 'Zinc'], ['ZINC ORE', 'Zinc Ore']
]);

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

function normalizeResource(value) {
  if (!value) return null;
  const key = String(value).trim().replace(/\s+/g, ' ').toUpperCase();
  return RESOURCE_ALIASES.get(key) || null;
}

function resourcesFromText(value) {
  const text = String(value || '');
  const resources = [];
  for (const match of text.matchAll(/\b(?:find|found)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/gi)) {
    const resource = normalizeResource(match[1]);
    if (resource) resources.push(resource);
  }
  for (const [key, resource] of RESOURCE_ALIASES) {
    const pattern = new RegExp(`(?:^|[,;])\\s*${key.replace(/ /g, '\\s+')}\\s*(?=[,;]|$)`, 'i');
    if (pattern.test(text)) resources.push(resource);
  }
  return [...new Set(resources)];
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
  if (!cleaned) return null;
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

function parseScoutTransport(text) {
  const value = String(text || '');
  const numberAfter = pattern => {
    const match = value.match(pattern);
    return match ? parseNumber(match[1]) : 0;
  };
  return {
    noOfScouts: numberAfter(/([\d,]+)\s+(?:scouts?|riders?)/i),
    noOfHorses: numberAfter(/([\d,]+)\s+horses?/i),
    noOfCarts: numberAfter(/([\d,]+)\s+(?:carts?|wagons?)/i)
  };
}

function parseScoutOutcome(text) {
  const value = String(text || '').replace(/[’]/g, "'");
  const movementFailure = value.match(/Not enough M\.P'?s to move to\s+(N|NE|SE|S|SW|NW)\s+into\s+([^,]+)/i);
  if (movementFailure) return { blockedReason: 'insufficient-movement', blockedDirection: movementFailure[1].toUpperCase(), blockedTerrain: normalizeTerrain(movementFailure[2]) };
  const oceanFailure = value.match(/Can't Move on Ocean to\s+(N|NE|SE|S|SW|NW)\s+of HEX/i);
  if (oceanFailure) return { blockedReason: 'ocean', blockedDirection: oceanFailure[1].toUpperCase(), blockedTerrain: 'O' };
  return { blockedReason: null, blockedDirection: null, blockedTerrain: null };
}

function splitActivityParts(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') depth = Math.max(0, depth - 1);
    else if (text[i] === ',' && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (text.slice(start).trim()) parts.push(text.slice(start).trim());
  return parts;
}

function parseItemAmounts(value) {
  const amounts = [];
  for (const part of splitActivityParts(value)) {
    const match = part.match(/^([\d,]+)\s+(.+?)$/);
    if (match) amounts.push({ item: match[2].trim(), quantity: parseNumber(match[1]) });
  }
  return amounts;
}

function parseNamedItemAmounts(value) {
  const amounts = [];
  for (const part of splitActivityParts(value)) {
    const match = part.match(/^(.+?)\s+([\d,]+)$/);
    if (match) amounts.push({ item: match[1].trim(), quantity: parseNumber(match[2]) });
  }
  return amounts;
}

function parseActivityLine(line) {
  const text = String(line || '').trim();
  const finalMatch = text.match(/^Final Activities:\s*Provs eaten:\s*(.*)$/i);
  if (finalMatch) return {
    category: 'final',
    actions: [{ type: 'consumption', label: 'Provisions eaten', items: parseItemAmounts(finalMatch[1]) }]
  };
  const body = text.replace(/^Tribe Activities,?\s*/i, '')
    .replace(/([\d,]+\s+[A-Za-z/]+)\s+(?=\d+\s+people\b)/g, '$1, ');
  const actions = [];
  for (const part of splitActivityParts(body)) {
    let match = part.match(/^(\d+)\s+people\s+(caught|hunted|stripped)\s+([\d,]+)\s+(.+)$/i);
    if (match) {
      actions.push({ type: match[2].toLowerCase(), label: match[2], workers: parseNumber(match[1]), items: [{ item: match[4].trim(), quantity: parseNumber(match[3]) }] });
      continue;
    }
    match = part.match(/^(\d+)\s+people\s+furried\s*\((.*)\)$/i);
    if (match) {
      actions.push({ type: 'furriering', label: 'Furriering', workers: parseNumber(match[1]), items: parseItemAmounts(match[2]) });
      continue;
    }
    match = part.match(/^(\d+)\s+people\s+made\s+([\d,]+)\s+(.+?)(?:\s*\(using\s+(.*)\))?$/i);
    if (match) {
      actions.push({ type: 'crafting', label: 'Crafting', workers: parseNumber(match[1]), items: [{ item: match[3].trim(), quantity: parseNumber(match[2]) }], inputs: parseItemAmounts(match[4] || '') });
      continue;
    }
    match = part.match(/^(\d+)\s+people\s+(Skin\\gut\\bone)\s+([\d,]+)\s+(.+)$/i);
    if (match) {
      actions.push({ type: 'animal-processing', label: match[2], workers: parseNumber(match[1]), items: [{ item: match[4].trim(), quantity: parseNumber(match[3]) }] });
      continue;
    }
    match = part.match(/^Skins\s+(Cured|Tanned)\s+([\d,]+)(?:\s*\(using\s+(.*)\))?$/i);
    if (match) {
      actions.push({ type: match[1].toLowerCase(), label: `Skins ${match[1]}`, items: [{ item: 'Skin', quantity: parseNumber(match[2]) }], inputs: parseItemAmounts(match[3] || '') });
      continue;
    }
    match = part.match(/^B\/axe\s+([\d,]+)$/i);
    if (match) {
      actions.push({ type: 'production', label: 'B/axe made', items: [{ item: 'B/axe', quantity: parseNumber(match[1]) }] });
      continue;
    }
    match = part.match(/^([\d,]+)\s+herders\s+allocated$/i);
    if (match) { actions.push({ type: 'herding', label: 'Herders allocated', quantity: parseNumber(match[1]) }); continue; }
    match = part.match(/^([\d,]+)\s+actual herders required$/i);
    if (match) { actions.push({ type: 'herding', label: 'Actual herders required', quantity: parseNumber(match[1]) }); continue; }
    match = part.match(/^Bred\s*\((.*)\)$/i);
    if (match) { actions.push({ type: 'breeding', label: 'Bred', items: parseNamedItemAmounts(match[1]) }); continue; }
    if (/^No Breeding Performed$/i.test(part)) { actions.push({ type: 'breeding', label: 'No breeding performed' }); continue; }
    if (part) actions.push({ type: 'other', label: part });
  }
  return { category: 'activities', actions };
}

function parseHtmlTables(html) {
  const tables = [];
  for (const tableMatch of String(html || '').matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = [];
    for (const rowMatch of tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => cell[1]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(?:p|div|li)>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .trim());
      if (cells.length) rows.push(cells);
    }
    tables.push(rows);
  }
  return tables;
}

function transferStatus(requested, actual) {
  if (actual == null) return 'unreported';
  if (requested == null) return 'reported';
  if (actual === requested) return 'complete';
  if (actual === 0) return 'failed';
  return 'partial';
}

function parseTransferTable(tables = []) {
  const rows = tables.find(table => table[0]?.map(value => value.toLowerCase()).join('|').includes('from|to|item|requested|actual|message')) || [];
  return rows.slice(1).map(cells => ({
    from: cells[0] || '',
    to: cells[1] || '',
    item: cells[2] || '',
    requested: parseNumber(cells[3]),
    actual: parseNumber(cells[4]),
    message: cells[5] || ''
  })).filter(row => row.from || row.to || row.item);
}

function parseAuctionSummary(lines, transfers, homeUnitCode) {
  const auctions = [];
  for (const line of lines) {
    const match = line.match(/^(Transfer to|Receive from) Auction:\s*(.*)$/i);
    if (!match) continue;
    const direction = /^Transfer to/i.test(match[1]) ? 'to-auction' : 'from-auction';
    const prefix = match[2].split(/,\s*(?:To|from)\s+[A-Za-z0-9]+:/i)[0];
    for (const part of splitActivityParts(prefix)) {
      const itemMatch = part.match(/^([\d,]+)\s+(.+)$/);
      if (!itemMatch) continue;
      const quantity = parseNumber(itemMatch[1]);
      const item = itemMatch[2].trim();
      const outgoing = direction === 'to-auction';
      const transferIndex = transfers.findIndex(row => row.auctionSummaryIndex == null && row.item.toUpperCase() === item.toUpperCase() && row.requested === quantity &&
        (outgoing ? row.from === homeUnitCode : row.to === homeUnitCode));
      const transfer = transferIndex >= 0 ? transfers[transferIndex] : null;
      if (transfer) transfer.auctionSummaryIndex = auctions.length;
      auctions.push({
        direction,
        item,
        reportedAmount: quantity,
        actualAmount: transfer?.actual ?? null,
        status: transferStatus(quantity, transfer?.actual ?? null),
        transfer: transfer ? { from: transfer.from, to: transfer.to, message: transfer.message } : null
      });
    }
  }
  return auctions;
}

function parseHeaderMetadata(lines, turnMatch, turnLine, tables) {
  const nextTurnMatch = turnLine.match(/Next Turn\s+([^\s,(]+)(?:\s+\(#?(\d+)\))?(?:,\s*([^\s,]+))?/i);
  const financialMatch = lines.find(line => /^Received:/i.test(line))?.match(/^Received:\s*\$?\s*([\d,.]+),\s*Cost:\s*\$?\s*([\d,.]+)\s*Credit:\s*\$?\s*([\d,.]+)/i);
  const desiredLine = lines.find(line => /^Desired Commodities:/i.test(line)) || '';
  const desiredCommodities = [...desiredLine.matchAll(/\(\d+\)\s*([^,]+)/g)].map(match => match[1].trim());
  const goodsLine = lines.find(line => /^Goods Tribe:/i.test(line)) || '';
  const homeHeader = lines.find(line => /^Tribe\s+[^,]+,/.test(line));
  const homeCode = homeHeader?.match(/^Tribe\s+([^,\s]+)/)?.[1] || null;
  const transfers = parseTransferTable(tables);
  const auctions = parseAuctionSummary(lines, transfers, homeCode);
  const settlementsTable = tables.find(table => table[0]?.map(value => value.toLowerCase()).join('|').includes('hex code|name|note|type|subtype')) || [];
  const settlements = settlementsTable.slice(1).map(cells => ({
    hexCode: cells[0] || '', name: cells[1] || '', note: cells[2] || '', type: cells[3] || '', subtype: cells[4] || ''
  })).filter(row => Object.values(row).some(Boolean));
  const notices = lines.filter(line => /^Skills Teacher\b/i.test(line) || /^Warning:/i.test(line));
  const nextTurnDate = nextTurnMatch?.[3] || null;
  return {
    sequence: turnMatch?.[2] ? Number(turnMatch[2]) : null,
    season: (turnMatch?.[3] || '').trim() || null,
    weatherAndNextTurn: (turnMatch?.[4] || '').trim() || null,
    weather: (turnMatch?.[4] || '').split(/\s+Next Turn\b/i)[0].replace(/\t/g, ' ').trim() || null,
    nextTurn: nextTurnMatch?.[1] || null,
    nextTurnSequence: nextTurnMatch?.[2] ? Number(nextTurnMatch[2]) : null,
    nextTurnDate,
    finances: financialMatch ? { received: parseNumber(financialMatch[1]), cost: parseNumber(financialMatch[2]), credit: parseNumber(financialMatch[3]) } : null,
    goodsTribe: goodsLine.replace(/^Goods Tribe:\s*/i, '').trim() || null,
    desiredCommodities,
    auctions,
    transfers: transfers.map((row, index) => ({
      from: row.from, to: row.to, item: row.item, requested: row.requested, actual: row.actual,
      status: transferStatus(row.requested, row.actual), message: row.message,
      type: auctions[row.auctionSummaryIndex] ? 'auction' : 'unit-transfer'
    })),
    notices,
    settlements
  };
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
    resources: Array.from(new Set(entry.resources || [])),
    evidence: entry.evidence ? [entry.evidence] : []
  };
  if (!existing) {
    knowledgeMap.set(entry.coordinate, incoming);
    return;
  }
  const mergedUnits = new Set([...(existing.observedUnits || []), ...(incoming.observedUnits || [])]);
  const mergedResources = new Set([...(existing.resources || []), ...(incoming.resources || [])]);
  const mergedEvidence = [...(existing.evidence || []), ...(incoming.evidence || [])];
  const oldRank = KNOWLEDGE_RANK[existing.knowledgeLevel] || 0;
  const newRank = KNOWLEDGE_RANK[incoming.knowledgeLevel] || 0;
  if (newRank > oldRank) {
    knowledgeMap.set(entry.coordinate, { ...incoming, observedUnits: [...mergedUnits], resources: [...mergedResources], evidence: mergedEvidence });
  } else {
    existing.observedUnits = [...mergedUnits];
    existing.resources = [...mergedResources];
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
  // Word reports sometimes use a curly apostrophe in “M.P’s”. Normalize it
  // before applying the route/failure grammar so partial scouts are retained.
  let routeText = String(rawLine).replace(/[’]/g, "'");
  routeText = routeText.replace(/^.*?:\s*(?:Scout\s*)?/i, '');
  routeText = routeText.replace(/^Move\s+/i, '');
  const failMatch = routeText.match(/Not enough M\.P'?s to move to\s+(N|NE|SE|S|SW|NW)\s+into\s+([^,]+)/i);
  const patrolledMatch = routeText.match(/Patrolled and found\s+([A-Za-z0-9]+)/i);
  const beforeFailure = routeText.split(/(?:Not enough M\.P'?s|Can't Move on Ocean)/i)[0];
  const normalized = beforeFailure.replace(/\\/g, ',');
  const tokens = normalized.split(',').map(x => x.trim()).filter(Boolean);
  let current = startCoordinate;
  let observationTerrain = null;
  for (const token of tokens) {
    let match = token.match(/^(N|NE|SE|S|SW|NW)-([A-Za-z]+)$/i);
    if (match) {
      const direction = match[1].toUpperCase();
      const next = stepCoordinate(current, direction);
      if (next) {
        current = next;
        observationTerrain = null;
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
          observationTerrain = terrain;
        }
        continue;
      }
    }
    match = token.match(/^(N|NE|SE|S|SW|NW)$/i);
    if (match && observationTerrain) {
      const observed = stepCoordinate(current, match[1].toUpperCase());
      if (observed) addKnowledge(knowledgeMap, {
        coordinate: observed,
        terrain: observationTerrain,
        knowledgeLevel: 'observed',
        sourceUnit,
        scoutId,
        reason: 'Observed from an adjacent hex',
        evidence: `${observationTerrain} ${match[1].toUpperCase()}`
      });
      continue;
    }
    const resourceMatch = token.match(/^find\s+(.+)$/i);
    if (resourceMatch) {
      const resource = normalizeResource(resourceMatch[1]);
      if (resource) addKnowledge(knowledgeMap, {
        coordinate: current,
        terrain: 'UNKNOWN',
        knowledgeLevel: movementLevel,
        sourceUnit,
        scoutId,
        resources: [resource],
        reason: `Found ${resource}`,
        evidence: token
      });
      continue;
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
      events.push({ unitCode, eventType: /^Final Activities/i.test(line) ? 'final activities' : 'activities', message: line, details: parseActivityLine(line) });
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
      const report = scoutMatch[2].trim();
      const scout = { id: Number(scoutMatch[1]), report, raw: line, ...parseScoutTransport(report), ...parseScoutOutcome(report) };
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
    const statusResources = resourcesFromText(unit.statusNotes);
    if (statusResources.length) addKnowledge(knowledgeMap, {
      coordinate: currentHex,
      terrain: unit.statusTerrain,
      knowledgeLevel: 'visited',
      sourceUnit: unitCode,
      resources: statusResources,
      reason: `${unitType} ${unitCode} reported resources here`,
      evidence: unit.statusNotes
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

function parseResultText(rawText, sourceFile = 'Results.docx', tables = []) {
  const lines = splitLines(rawText);
  const turnLine = lines.find(line => /^Current Turn\s+/i.test(line));
  if (!turnLine) throw new Error('Could not find a Current Turn line in this results report.');
  const turnMatch = turnLine.match(/^Current Turn\s+([^\s,]+)(?:\s+\(#?(\d+)\))?,?\s*([^,]*)?,?\s*(.*)$/i);
  const turnKey = turnMatch?.[1];
  if (!turnKey) throw new Error('Could not determine the turn key from this results report.');
  const report = {
    turnKey,
    turnSort: turnSort(turnKey),
    sourceFile: path.basename(sourceFile || 'Results.docx'),
    metadata: parseHeaderMetadata(lines, turnMatch, turnLine, tables),
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
  const [result, html] = await Promise.all([
    mammoth.extractRawText({ path: filePath }),
    mammoth.convertToHtml({ path: filePath })
  ]);
  return parseResultText(result.value, filePath, parseHtmlTables(html.value));
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
