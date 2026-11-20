// The map: base style, U6 line and stations, dorm markers and clustering.
/* global maplibregl */
import { U6_COLOR, U6_LINE, U6_STOPS } from "./u6.js";
import { reduceMotion, isNarrow } from "./util.js";

export const COL = { stwm: "var(--stwm)", eswm: "var(--eswm)", priv: "var(--priv)" };
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const dark = matchMedia("(prefers-color-scheme: dark)");

/** Space the open panel takes up, so the map can keep things visible next to it. */
export const panelPadding = () => isNarrow() ? { bottom: innerHeight * .56 } : { right: 380 };

export function createMap(state) {
  const map = new maplibregl.Map({
    container: "map", style: dark.matches ? STYLE_DARK : STYLE_LIGHT,
    bounds: [[11.642, 48.2485], [11.664, 48.2605]], fitBoundsOptions: { padding: { top: 60, bottom: 60, left: 60, right: 400 } },
    attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

  // dark tiles sometimes fail; fall back to the light style once
  let fellBack = false;
  map.on("error", () => { if (!fellBack && dark.matches && !map.isStyleLoaded()) { fellBack = true; map.setStyle(STYLE_LIGHT); } });
  dark.addEventListener("change", () => map.setStyle(dark.matches ? STYLE_DARK : STYLE_LIGHT));

  map.on("style.load", () => addU6(map));
  addStations(map);
  state.map = map;
  return map;
}

function addU6(map) {
  if (map.getSource("u6")) return;
  map.addSource("u6", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: U6_LINE } } });
  const layout = { "line-cap": "round", "line-join": "round" };
  map.addLayer({ id: "u6-casing", type: "line", source: "u6", layout,
    paint: { "line-color": dark.matches ? "#15171a" : "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 9], "line-opacity": .9 } });
  map.addLayer({ id: "u6-line", type: "line", source: "u6", layout,
    paint: { "line-color": U6_COLOR, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 16, 5] } });
}

function addStations(map) {
  U6_STOPS.forEach(([n, lng, lat]) => {
    const el = document.createElement("div");
    el.className = "stn";
    el.innerHTML = '<span class="stn-in"><span class="u" aria-hidden="true">U</span><span class="s"></span></span>';
    el.querySelector(".s").textContent = n;
    new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
  });
  // hide station names when zoomed out
  const labelZoom = () => document.body.classList.toggle("far", map.getZoom() < 12.6);
  map.on("zoom", labelZoom); labelZoom();
}

/** One label marker per dorm. The marker root stays unstyled so MapLibre can position it. */
export function addDormMarkers(state, onSelect) {
  const { map, dorms } = state;
  state.markers = dorms.map((d, i) => {
    const root = document.createElement("div");
    root.className = `mk st-${d.areaInfo.style}`;
    const inner = document.createElement("span");
    inner.className = "mk-in"; inner.tabIndex = 0;
    inner.setAttribute("role", "button");
    inner.style.setProperty("--c", COL[d.ch]);
    inner.textContent = d.short;
    if (d.parts && d.parts.length > 1 && !d.partsLabel) {
      const b = document.createElement("span"); b.className = "pc"; b.textContent = d.parts.length;
      b.title = `Made up of ${d.parts.length} parts`; inner.appendChild(b);
    }
    inner.setAttribute("aria-label", d.name + (d.parts ? `, made up of ${d.parts.length} parts` : ""));
    inner.addEventListener("click", () => onSelect(i, false));
    inner.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(i, true); } });
    root.appendChild(inner);
    return new maplibregl.Marker({ element: root, anchor: "bottom" }).setLngLat([d.lng, d.lat]).addTo(map);
  });
  setupClustering(state);
}

/** Labels that would overlap on screen collapse into a count bubble; click it to zoom in. */
function setupClustering(state) {
  const { map, dorms, markers } = state;
  const pool = [];
  const widthOf = i => {
    const el = markers[i].getElement().firstChild;
    if (!el._w || el._w < 10) el._w = el.offsetWidth || (dorms[i].short.length * 7 + 28);
    return el._w;
  };
  const centre = ids => [ids.reduce((s, i) => s + dorms[i].lng, 0) / ids.length, ids.reduce((s, i) => s + dorms[i].lat, 0) / ids.length];

  function recluster() {
    // 1. greedy grouping by screen overlap; the open dorm always stays on its own
    const groups = [];
    dorms.forEach((d, i) => {
      const p = map.project([d.lng, d.lat]), w = widthOf(i);
      if (state.panelOpen && i === state.cur) { groups.push({ m: [i], keep: true }); return; }
      const g = groups.find(g => !g.keep && Math.abs(g.p.x - p.x) < (g.w + w) / 2 + 6 && Math.abs(g.p.y - p.y) < 30);
      if (g) { g.m.push(i); g.w = Math.max(g.w, w); } else groups.push({ p, w, m: [i] });
    });
    // 2. merge groups whose labels or bubbles would still overlap, until stable
    const geo = g => g.m.length === 1
      ? { p: g.p || map.project([dorms[g.m[0]].lng, dorms[g.m[0]].lat]), w: g.w || widthOf(g.m[0]) }
      : { p: map.project(centre(g.m)), w: 34 };
    for (let pass = 0, merged = true; merged && pass < 6; pass++) {
      merged = false;
      for (let a = 0; a < groups.length && !merged; a++) for (let b = a + 1; b < groups.length && !merged; b++) {
        if (groups[a].keep || groups[b].keep) continue;
        const A = geo(groups[a]), B = geo(groups[b]);
        if (Math.abs(A.p.x - B.p.x) < (A.w + B.w) / 2 + 6 && Math.abs(A.p.y - B.p.y) < 32) {
          groups[a].m.push(...groups[b].m); groups[a].p = null; groups[a].w = null; groups.splice(b, 1); merged = true;
        }
      }
    }
    // 3. show singles, draw a bubble per group
    let used = 0;
    groups.forEach(g => {
      if (g.m.length === 1) { markers[g.m[0]].getElement().style.display = ""; return; }
      g.m.forEach(i => markers[i].getElement().style.display = "none");
      const c = pool[used] || makeBubble();
      c.members = g.m;
      c.marker.setLngLat(centre(g.m));
      c.el.style.display = "";
      c.b.textContent = g.m.length;
      const names = g.m.map(i => dorms[i].short);
      c.b.title = names.join(" · ");
      c.b.setAttribute("aria-label", `${g.m.length} dorms here: ${names.join(", ")}. Zoom in`);
      c.b.style.setProperty("--c", COL[dorms[g.m[0]].ch]);
      c.el.classList.toggle("away", g.m.every(i => dorms[i].areaInfo.style !== "solid"));
      used++;
    });
    for (let k = used; k < pool.length; k++) pool[k].el.style.display = "none";
  }

  function makeBubble() {
    const el = document.createElement("div"); el.className = "cl";
    const b = document.createElement("button"); b.type = "button"; b.className = "cl-in"; el.appendChild(b);
    const c = { el, b, members: [], marker: new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([0, 0]).addTo(map) };
    b.addEventListener("click", () => {
      const pad = isNarrow() ? { top: 80, bottom: innerHeight * .58, left: 60, right: 60 } : { top: 120, bottom: 120, left: 120, right: 460 };
      map.fitBounds(bounds(c.members.map(i => dorms[i])), { padding: pad, maxZoom: Math.max(map.getZoom() + 2, 17.5), duration: reduceMotion ? 0 : 700 });
    });
    pool.push(c);
    return c;
  }

  let raf = 0;
  state.recluster = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; recluster(); }); };
  map.on("move", state.recluster); map.on("load", state.recluster);
  addEventListener("resize", state.recluster);
  if (document.fonts) document.fonts.ready.then(() => { markers.forEach(m => m.getElement().firstChild._w = 0); state.recluster(); });
}

const bounds = pts => [[Math.min(...pts.map(p => p.lng)), Math.min(...pts.map(p => p.lat))], [Math.max(...pts.map(p => p.lng)), Math.max(...pts.map(p => p.lat))]];

/** Zoom so that every dorm passing the filter is in view. */
export function fitDorms(state, filter) {
  const pad = isNarrow() ? { top: 40, bottom: innerHeight * .58, left: 30, right: 30 } : { top: 60, bottom: 60, left: 60, right: 400 };
  state.map.fitBounds(bounds(state.dorms.filter(filter)), { padding: pad, maxZoom: 15, duration: reduceMotion ? 0 : 900 });
}
