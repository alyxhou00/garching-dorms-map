// Entry point: load the data, build the legend, map and panel.
import { $, el } from "./util.js";
import { loadData } from "./data.js";
import { createMap, addDormMarkers, fitDorms } from "./map.js";
import { setupPanel } from "./panel.js";

const state = { dorms: [], markers: [], cur: 0, panelOpen: true, recluster: () => {} };

function buildLegend(data) {
  const item = (swatch, text) => { const s = el("span"); s.append(swatch, text); return s; };
  const sw = (cls, color) => { const i = el("i", cls); if (color) i.style.setProperty("--c", color); return i; };

  const rows = Object.entries(data.channels).map(([id, c]) => item(sw("sw", `var(--${id})`), c.legend));
  const u = el("i", "ux", "U");
  const u6 = el("span"); u6.append(u, sw("sw u6"), "U6 line and stations"); rows.push(u6);
  const seen = new Set();
  data.areas.forEach(a => { if (!seen.has(a.style)) { seen.add(a.style); rows.push(item(sw(`sw ln ${a.style}`), a.legend)); } });
  rows.push(item(el("i", "clx", "3"), "Dorms too close together; click to zoom in"));
  $("legend-items").replaceChildren(...rows);

  const select = $("go-area");
  select.append(...data.areas.map(a => { const o = el("option", null, a.label); o.value = a.id; return o; }));
  select.addEventListener("change", e => {
    const v = e.target.value;
    fitDorms(state, v === "all" ? () => true : d => d.area === v);
  });
}

async function start() {
  const data = await loadData();
  state.dorms = data.dorms;
  buildLegend(data);
  createMap(state);
  const show = setupPanel(state);
  addDormMarkers(state, show);
  show(0, false);
  window.showDorm = show; // handy for testing in the console
}

start().catch(err => {
  console.error(err);
  $("panel").hidden = true;
  $("legend-items").textContent = "Could not load the dorm data.";
});
