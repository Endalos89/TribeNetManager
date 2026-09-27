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

module.exports = { canonicalTurnKey, inferTurnKeyFromFilename, sameTurnKey };
