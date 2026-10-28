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

module.exports = { canonicalTurnKey, inferTurnKeyFromFilename, sameTurnKey, previousTurnKey };
