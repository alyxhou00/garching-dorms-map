// Loads data/dorms.json and fills in derived fields.
import { U6_STOPS } from "./u6.js";
import { metres } from "./util.js";

export async function loadData(url = "data/dorms.json") {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}: ${res.status}`);
  const data = await res.json();
  const areas = new Map(data.areas.map(a => [a.id, a]));

  data.dorms.forEach(d => {
    // shared rules, e.g. every STWM dorm applies the same way
    const t = d.template && data.templates[d.template];
    if (t) {
      d.how ??= t.how;
      d.when ??= t.when;
      d.chips = [t.chip, ...(d.chips || [])];
    }
    d.areaInfo = areas.get(d.area);
    // nearest U6 station in a straight line (used for the "far" pill)
    d.u6 = U6_STOPS.reduce((best, [n, lng, lat]) => {
      const m = metres(d.lng, d.lat, lng, lat);
      return !best || m < best.m ? { n, m } : best;
    }, null);
  });
  return data;
}
