export const normalizePercentMod = (raw, fallback = 100) => {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback / 100;
  // If the value looks like an already-normalized multiplier (<= 10), use it directly.
  if (n <= 10) return n;
  return n / 100;
};

export const buildCharacterXpMod = ({ classMod, raceMod, deityMod }) => {
  const c = normalizePercentMod(classMod);
  const r = normalizePercentMod(raceMod);
  const d = normalizePercentMod(deityMod);
  return c * r * d;
};

export const toHundredScale = (raw, fallback = 100) => {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
};
