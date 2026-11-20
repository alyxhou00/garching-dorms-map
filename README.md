# Garching student dorms map

Interactive map of student dorms (Studentenwohnheime) along the U6 (Garching to Münchner Freiheit) and nearby areas, with how to apply, rent, waiting times and review summaries.

Live page: https://alyxhou00.github.io/garching-dorms-map/

Basemap: OpenFreeMap, © OpenMapTiles, data © OpenStreetMap contributors. U6 track from OpenStreetMap.

---

### How to add a dorm

Add one object to `dorms` in [`data/dorms.json`](data/dorms.json), copying an existing entry. You need at least `short` (map label), `name`, `area` (an `id` from `areas`), `ch` (`stwm`, `eswm` or `priv`), `lng`/`lat`, `chips`, `how`, `when`, `rent`, `wait`, `walk` and `rev`. STWM dorms can use `"template": "stwm"` instead of `how` and `when`. A new area only needs one entry in `areas`.

Code: `index.html` (layout), `css/style.css`, `js/` (`map.js` map and markers, `panel.js` detail panel, `data.js` loading). The old single-file version is on the `single-file-v1` branch.

---

**Some personal comments:**
- Add functionalities for finding WGs in the future. Any (unofficial) APIs? 
- Preferred location for a WG: Garching, Ismaning, (Unterföhring), M Schwabing-Freimann?

**Other towns nearby:**

| From | Time | How |
|---|---|---|
| Neufahrn b FS | 20 min | bus 690, straight to campus, every 20 min |
| Ismaning | 24–30 min | bus 230 or X202, then U6; or X205 straight to campus |
| Eching | 29 min | bus 695 to Garching-Hochbrück, then U6 (bus 690 straight to campus takes 42 min) |
| Oberschleißheim | 30–31 min | bus 292, then U6; or X201 straight to campus |
| Unterföhring | 31 min | bus X205, straight to campus |
| Unterschleißheim | 34 min | bus 219 to Garching-Hochbrück (every 10 min), then U6 |


