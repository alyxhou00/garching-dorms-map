// The floating detail panel for one dorm, with its pager.
/* global maplibregl */
import { $, el, fmtDist, walkMinutes, fmtMinutes, reduceMotion } from "./util.js";
import { COL, panelPadding } from "./map.js";

const FAR_M = 1200; // straight-line distance from which a dorm gets the "walk to the U6" pill

const ROOM = {
  studio: ["Studio", "own kitchen · own bath"],
  part: ["Room + own bath", "shared kitchen"],
  wg: ["WG room", "kitchen and bath shared in the flat"],
  room: ["Corridor room", "shared kitchen and bath on the floor"],
  unk: ["Not confirmed", ""]
};

const WALK_ICON = '<svg width="11" height="13" viewBox="0 0 11 13" aria-hidden="true"><circle cx="6" cy="1.8" r="1.6" fill="currentColor"/><path d="M5.2 4.2 3.4 7.6M5.2 4.2l1.1 3.6 2.4 1.4M5.8 7.8 4.6 12M6.3 7.8l1.9 4.2M5.2 4.2 7.8 5.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>';

export function setupPanel(state) {
  let partMarkers = [];
  const clearParts = () => { partMarkers.forEach(m => m.remove()); partMarkers = []; };

  function show(i, fly) {
    const { dorms, markers, map } = state;
    state.cur = (i + dorms.length) % dorms.length;
    state.panelOpen = true;
    const d = dorms[state.cur];
    const walk = { m: d.walk.m, st: d.walk.station, min: walkMinutes(d.walk.m) };

    const panel = $("panel");
    panel.hidden = false;
    panel.style.setProperty("--c", COL[d.ch]);
    $("p-op").textContent = `${d.op} · ${d.areaInfo.label}`;
    $("p-name").textContent = d.name;
    $("p-meta").textContent = `${d.rating} · ${d.street}`;
    renderU6Row(d, walk);
    const dest = d.name + ", " + d.street + (/\d{5}/.test(d.street) ? "" : ", " + d.areaInfo.town);
    $("p-dir").href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=transit`;
    $("p-web").href = d.url;

    const chips = d.chips.slice();
    if (d.u6.m > FAR_M) chips.push(["far", `Walk to the U6 · ${fmtMinutes(walk.min)}`]);
    $("p-chips").replaceChildren(...chips.map(([k, tx]) => el("span", "chip " + k, tx)));
    $("p-how").textContent = d.how; $("p-when").textContent = d.when;
    $("p-rent").textContent = d.rent; $("p-wait").textContent = d.wait;
    $("p-note").textContent = d.note;

    renderRooms(d);
    renderConn(d, walk);
    clearParts();
    renderParts(d);
    renderReviews(d);

    $("count").textContent = `${state.cur + 1} of ${dorms.length}`;
    markers.forEach((m, j) => m.getElement().classList.toggle("on", j === state.cur));
    if (fly) map.flyTo({ center: [d.lng, d.lat], zoom: Math.max(map.getZoom(), 15.5), padding: panelPadding(), duration: reduceMotion ? 0 : 800 });
    state.recluster();
  }

  function renderU6Row(d, walk) {
    const u = el("span", "u", "U"); u.setAttribute("aria-hidden", "true");
    let text;
    if (d.conn) {
      const via = d.conn.steps.filter(s => s.kind !== "walk").map(s => (s.kind === "bus" ? "Bus " : "") + s.line).join(" + ");
      text = `U6 ${d.conn.station} via ${via} · ≈ ${d.conn.door} min`;
    } else text = `U6 ${walk.st} · ${fmtMinutes(walk.min)} walk (${fmtDist(walk.m)})`;
    $("p-u6").replaceChildren(u, el("span", null, text));
  }

  function renderRooms(d) {
    $("p-rooms").replaceChildren(...(d.rooms || []).map(({ kind, note }) => {
      const head = el("div", "rt-head");
      head.append(el("span", "rt " + kind, ROOM[kind][0]));
      if (ROOM[kind][1]) head.append(el("span", "rt-k", ROOM[kind][1]));
      const li = el("li"); li.append(head);
      if (note) li.append(el("div", "rt-n", note));
      return li;
    }));
  }

  function badge(kind, line) {
    if (kind === "walk") { const b = el("span", "bd walk"); b.setAttribute("aria-label", "Walk"); b.innerHTML = WALK_ICON; return b; }
    return el("span", "bd " + kind, kind === "bus" ? "Bus " + line : line);
  }
  function step(kind, line, text, time) {
    const li = el("li", kind === "u6" ? "cn-end" : null); li.append(badge(kind, line));
    const b = el("div", "cn-t"); b.append(el("span", null, text)); if (time) b.append(el("span", "cn-time", time));
    li.append(b); return li;
  }

  function renderConn(d, walk) {
    const rows = d.conn
      ? d.conn.steps.map(s => step(s.kind, s.line, s.text, s.time))
      : [step("walk", null, `to U6 ${walk.st}`, `${fmtMinutes(walk.min)} · ${fmtDist(walk.m)} on foot`)];
    rows.push(step("u6", "U6", `${d.conn ? d.conn.station : walk.st} → Garching-Forschungszentrum`));
    $("p-conn").replaceChildren(...rows);

    const sum = [];
    if (d.conn) {
      sum.push(`≈ ${d.conn.door} min from the door to the U6 with a good connection.`);
      sum.push(`Walking all the way instead: ${fmtMinutes(walk.min)} to U6 ${walk.st} (${fmtDist(walk.m)}).`);
      if (d.conn.alt) sum.push(d.conn.alt);
    } else if (d.walkAlt) sum.push(d.walkAlt);
    if (d.areaInfo.connNote) sum.push(d.areaInfo.connNote);
    $("p-conn-alt").textContent = sum.join(" ");
    $("p-campus").textContent = d.campus ? `≈ ${d.campus} min door to door to Garching-Forschungszentrum` : "";
  }

  function renderParts(d) {
    const box = $("p-parts");
    if (!d.parts || !d.parts.length) { box.hidden = true; return; }
    box.hidden = false;
    $("p-parts-label").textContent = d.partsLabel || (d.parts.length > 1 ? `Made up of ${d.parts.length} parts` : "Made up of");
    $("p-parts-list").replaceChildren(...d.parts.map(p => {
      const li = el("li");
      const name = el(p.lng ? "button" : "span", "pt-name", p.name);
      if (p.lng) {
        name.type = "button"; name.title = "Show on map";
        name.addEventListener("click", () => state.map.flyTo({ center: [p.lng, p.lat], zoom: 17, padding: panelPadding(), duration: reduceMotion ? 0 : 700 }));
        const dot = el("div", "pt");
        dot.innerHTML = '<span class="pt-dot"></span><span class="pt-label"></span>';
        dot.querySelector(".pt-label").textContent = p.name;
        dot.style.setProperty("--c", COL[d.ch]);
        partMarkers.push(new maplibregl.Marker({ element: dot, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(state.map));
      }
      li.append(name);
      if (p.note) li.append(el("span", "pt-note", p.note));
      return li;
    }));
  }

  function renderReviews(d) {
    const fill = (id, arr, empty) => $(id).replaceChildren(...(arr.length ? arr.map(x => el("li", null, x)) : [el("li", "none", empty)]));
    fill("p-good", d.rev.good, "Nothing mentioned");
    fill("p-bad", d.rev.bad, "Nothing mentioned");
    fill("p-other", d.other || [], "Nothing found outside Google Maps");
    const r = /([\d.]+) ★ \((\d+)\)/.exec(d.rating || "");
    $("p-basis").textContent = "Google Maps: " + (r ? `${r[1]} / 5 from ${r[2]} ratings · ` : "") + d.rev.basis.replace(/ \(of \d+ ratings\)/, "") + " Read Nov 2026.";
  }

  function close() {
    $("panel").hidden = true; state.panelOpen = false; clearParts();
    state.markers.forEach(m => m.getElement().classList.remove("on"));
    state.recluster();
  }

  $("prev").addEventListener("click", () => show(state.cur - 1, true));
  $("next").addEventListener("click", () => show(state.cur + 1, true));
  $("close").addEventListener("click", close);
  return show;
}
