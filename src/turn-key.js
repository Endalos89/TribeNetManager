function canonicalTurnKey(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d+)[-_](\d+)$/);
  if (!match) return text || null;
  return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
}

function inferTurnKeyFromFilename(filename) {
  const base = String(filename || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  const patterns = [
    /(?:^|_)(\d{3})[_-](\d{1,2})(?:_|$)/,
    /(?:^|\s)(\d{3})[-_](\d{1,2})(?:\s|$)/
  ];
  for (const pattern of patterns) {
    const match = base.match(pattern);
    if (match) return canonicalTurnKey(`${match[1]}-${match[2]}`);
  }
  return canonicalTurnKey(base);
}

// Manual blank Orders uploads are authoritative for the turn being opened.
// A filename such as 0485_906_08_Orders.xlsx must not be assigned to the
// previously selected Mapper turn (e.g. 906-07). Do not guess on ambiguity.
function inferOrdersTemplateTurnKey(filename) {
  const base = String(filename || '').replace(/^.*[\\\\/]/, '').replace(/\.[^.]+$/, '');
  const candidates = new Set();
  for (const match of base.matchAll(/(?:^|[^0-9])(\d{3})[-_\s]+(\d{1,2})(?=[^0-9]|$)/g)) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) candidates.add(canonicalTurnKey(`${match[1]}-${month}`));
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

function sameTurnKey(a, b) {
  const left = canonicalTurnKey(a);
  const right = canonicalTurnKey(b);
  return Boolean(left && right && left === right);
}

function previousTurnKey(value) {
  const key = canonicalTurnKey(value);
  const match = String(key || '').match(/^(\d+)-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return month === 1
    ? `${String(year - 1).padStart(match[1].length, '0')}-12`
    : `${match[1]}-${String(month - 1).padStart(2, '0')}`;
}

module.exports = { canonicalTurnKey, inferTurnKeyFromFilename, inferOrdersTemplateTurnKey, sameTurnKey, previousTurnKey };
