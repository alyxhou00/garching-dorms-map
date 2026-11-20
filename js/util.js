// Small shared helpers.

export const $ = id => document.getElementById(id);

export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isNarrow = () => innerWidth <= 640;

/** Create an element with an optional class and text. */
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Straight-line distance in metres between two points. */
export function metres(aLng, aLat, bLng, bLat) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const fmtDist = m => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;

/** Walking minutes at about 80 m per minute, written as "12 min" or "1 h 39 min". */
export function walkMinutes(m) { return Math.max(1, Math.round(m / 80)); }
export function fmtMinutes(min) { return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`; }
