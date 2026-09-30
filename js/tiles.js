// EOX Sentinel-2 cloudless annual mosaics (one cloud-free composite per year, 10 m).
// All requests go through the same-origin /eox proxy (vercel.json rewrite) so the pixels can be read by canvas and CLIP.
export const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
export const LATEST = 2025;

const params = new URLSearchParams(location.search);
const BASE = params.has("direct") ? "https://tiles.maps.eox.at" : `${location.origin}/eox`;

export const layerName = (y) => (y === 2016 ? "s2cloudless_3857" : `s2cloudless-${y}_3857`);
export const tileTemplate = (y) => `${BASE}/wmts/1.0.0/${layerName(y)}/default/g/{z}/{y}/{x}.jpg`;
export const labelTemplate = () => `${BASE}/wmts/1.0.0/overlay_bright_3857/default/g/{z}/{y}/{x}.png`;

export const ATTRIBUTION =
  'Imagery: <a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless by EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data) · Labels © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

// ---------- Web Mercator helpers ----------
const TS = 256;
export function lonLatToWorld(lon, lat, z) {
  const n = TS * 2 ** z;
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}
export function worldToLonLat(px, py, z) {
  const n = TS * 2 ** z;
  const lon = (px / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / n))) * 180) / Math.PI;
  return [lon, lat];
}
export const metersPerPixel = (lat, z) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

// ---------- tile cache ----------
const cache = new Map();
const MAX = 900;
let active = 0;
const queue = [];
function slot() {
  return new Promise((res) => { if (active < 8) { active++; res(); } else queue.push(res); });
}
function release() { active--; const n = queue.shift(); if (n) { active++; n(); } }

export function fetchTile(year, z, x, y) {
  const n = 2 ** z; x = ((x % n) + n) % n;
  if (y < 0 || y >= n) return Promise.resolve(null);
  const key = `${year}/${z}/${x}/${y}`;
  if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  const url = tileTemplate(year).replace("{z}", z).replace("{y}", y).replace("{x}", x);
  const p = (async () => {
    await slot();
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`tile ${r.status}`);
      return await createImageBitmap(await r.blob());
    } catch (e) { cache.delete(key); return null; } finally { release(); }
  })();
  cache.set(key, p);
  if (cache.size > MAX) cache.delete(cache.keys().next().value);
  return p;
}

// A square patch of `size` px centred on lon/lat at zoom z, for one year. Returns {canvas, bounds:[w,s,e,n]}.
export async function patch(year, lat, lon, z, size = 448) {
  const [cx, cy] = lonLatToWorld(lon, lat, z);
  const x0 = Math.round(cx - size / 2), y0 = Math.round(cy - size / 2);
  const tx0 = Math.floor(x0 / TS), ty0 = Math.floor(y0 / TS);
  const tx1 = Math.floor((x0 + size - 1) / TS), ty1 = Math.floor((y0 + size - 1) / TS);
  const cv = new OffscreenCanvas(size, size);
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#223"; ctx.fillRect(0, 0, size, size);
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    jobs.push(fetchTile(year, z, tx, ty).then((bm) => { if (bm) ctx.drawImage(bm, tx * TS - x0, ty * TS - y0); return !!bm; }));
  }
  const ok = await Promise.all(jobs);
  const [w, n] = worldToLonLat(x0, y0, z), [e, s] = worldToLonLat(x0 + size, y0 + size, z);
  return { canvas: cv, bounds: [w, s, e, n], ok: ok.every(Boolean), z, year };
}

export function thumbURL(canvas, px = 160) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  c.getContext("2d").drawImage(canvas, 0, 0, px, px);
  return c.toDataURL("image/jpeg", 0.85);
}

export async function canvasToBlob(canvas, type = "image/png") {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type });
  return new Promise((r) => canvas.toBlob(r, type));
}

// Pick a zoom for semantic patches: ~4 to 9 km across, close to Sentinel-2's native 10 m.
export const patchZoom = (z) => Math.max(11, Math.min(14, Math.round(z)));
