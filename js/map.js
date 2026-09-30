// Map layer: MapLibre globe with Sentinel-2 annual mosaics, a synced "before" map for the swipe, overlays and markers.
import { tileTemplate, labelTemplate, ATTRIBUTION, LATEST } from "./tiles.js";
import { CAT } from "./catalog.js";

const ml = window.maplibregl;
export let map, before;
let curYear = LATEST, beforeYear = 2019, labelsOn = true, spinning = false, userBusy = false, resumeT;
const HOME = { center: [80, 19], bearing: 0, pitch: 0 };

function style() {
  return {
    version: 8,
    projection: { type: "globe" },
    sky: {
      "sky-color": "#0B1F3A", "horizon-color": "#9CC3E6", "fog-color": "#E4ECF6",
      "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
    },
    sources: {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": "#0E2A4A" } }],
  };
}

function addYear(m, y, visible) {
  const id = `s2-${y}`;
  if (m.getSource(id)) return id;
  m.addSource(id, { type: "raster", tiles: [tileTemplate(y)], tileSize: 256, maxzoom: 15 });
  (m._years ||= new Set()).add(y);
  m.addLayer({ id, type: "raster", source: id, layout: { visibility: visible ? "visible" : "none" },
    paint: { "raster-fade-duration": 250, "raster-opacity": 1, "raster-opacity-transition": { duration: 600 } } }, under(m));
  return id;
}
const under = (m) => (m.getLayer("heat") ? "heat" : m.getLayer("labels") ? "labels" : undefined);
function addLabels(m) {
  m.addSource("labels", { type: "raster", tiles: [labelTemplate()], tileSize: 256, maxzoom: 16 });
  m.addLayer({ id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.92 }, layout: { visibility: labelsOn ? "visible" : "none" } });
}

export const homeZoom = () => Math.max(1.1, Math.min(2.9, Math.log2((0.8 * innerHeight * Math.PI) / 512)));
const homePad = () => ({ top: 0, left: 0, right: 0, bottom: innerWidth > 860 ? Math.round(innerHeight * 0.22) : 0 });

export function initMap() {
  map = new ml.Map({
    container: "map", style: style(), center: HOME.center, zoom: homeZoom(), maxZoom: 16.5, minZoom: 0.8,
    attributionControl: false, fadeDuration: 150, canvasContextAttributes: { antialias: true },
  });
  map.setPadding(homePad());
  map.addControl(new ml.AttributionControl({ compact: true, customAttribution: ATTRIBUTION }), "bottom-right");
  map.addControl(new ml.NavigationControl({ visualizePitch: true }), "bottom-right");
  map.addControl(new ml.ScaleControl({ maxWidth: 110 }), "bottom-left");
  const coords = document.getElementById("coords");
  map.on("mousemove", (e) => { coords.textContent = `${e.lngLat.lat.toFixed(4)}°N  ${e.lngLat.lng.toFixed(4)}°E  ·  z${map.getZoom().toFixed(1)}`; });
  const busy = () => { userBusy = true; clearTimeout(resumeT); };
  const idle = () => { clearTimeout(resumeT); resumeT = setTimeout(() => (userBusy = false), 3500); };
  map.on("mousedown", busy); map.on("touchstart", busy); map.on("wheel", () => { busy(); idle(); });
  map.on("mouseup", idle); map.on("touchend", idle);
  return new Promise((res) => map.on("load", () => {
    addLabels(map); addYear(map, curYear, true);
    map.addSource("focus", { type: "geojson", data: fc([]) });
    map.addLayer({ id: "focus-line", type: "line", source: "focus", paint: { "line-color": "#ffffff", "line-width": 2.5, "line-opacity": 0.95 } });
    map.addSource("regions", { type: "geojson", data: fc([]) });
    map.addLayer({ id: "regions-fill", type: "fill", source: "regions", paint: { "fill-color": "#F28C28", "fill-opacity": 0.12 } });
    map.addLayer({ id: "regions-line", type: "line", source: "regions", paint: { "line-color": "#F28C28", "line-width": 3 } });
    res(map);
  }));
}

const fc = (features) => ({ type: "FeatureCollection", features });
const rect = ([w, s, e, n], props = {}) => ({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } });

// ---------- camera ----------
export function padding() {
  if (document.body.classList.contains("home")) return homePad();
  if (innerWidth <= 860) return { top: 150, bottom: Math.round(innerHeight * 0.46) + 10, left: 10, right: 50 };
  const pw = document.getElementById("panel").offsetWidth;
  return { top: 70, bottom: 10, left: pw + 30, right: 60 };
}
export function flyTo({ lat, lon, z = 12, pitch = 0, bearing = 0, duration }) {
  stopSpin();
  return new Promise((res) => {
    map.once("moveend", () => res());
    map.flyTo({ center: [lon, lat], zoom: z, pitch, bearing, padding: padding(), speed: 0.9, curve: 1.5, essential: true, ...(duration ? { duration } : {}) });
  });
}
export function fitBounds(b) {
  stopSpin();
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: padding(), maxZoom: 14, duration: 3500, essential: true });
}
export function goHome() {
  map.flyTo({ ...HOME, zoom: homeZoom(), padding: homePad(), speed: 1.1, curve: 1.3, essential: true });
  map.once("moveend", () => startSpin());
}
export function startSpin() {
  if (spinning) return; spinning = true;
  let last = performance.now();
  const step = (t) => {
    if (!spinning) return;
    const dt = Math.min(64, t - last); last = t;
    if (!userBusy && !map.isMoving() && map.getZoom() < 4) { const c = map.getCenter(); map.setCenter([c.lng + dt * 0.0022, c.lat]); }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
export function stopSpin() { spinning = false; }

// ---------- years ----------
export function setYear(y, { fade = false } = {}) {
  if (y === curYear) return;
  const prev = curYear; curYear = y;
  const id = addYear(map, y, true);
  map.setLayoutProperty(id, "visibility", "visible");
  map.moveLayer(id, under(map));
  if (fade) {
    map.setPaintProperty(id, "raster-opacity", 0);
    requestAnimationFrame(() => map.setPaintProperty(id, "raster-opacity", 1));
    setTimeout(() => { if (curYear !== prev) map.setLayoutProperty(`s2-${prev}`, "visibility", "none"); }, 650);
  } else {
    map.setPaintProperty(id, "raster-opacity", 1);
    map.setLayoutProperty(`s2-${prev}`, "visibility", "none");
  }
}
export const year = () => curYear;

// time-lapse: load every year at opacity 0, then cross-fade through them
export function prepareLapse(years) {
  years.forEach((y) => {
    const id = addYear(map, y, true);
    map.setLayoutProperty(id, "visibility", "visible"); map.moveLayer(id, under(map));
    map.setPaintProperty(id, "raster-opacity", y === curYear ? 1 : 0);
  });
}
export function lapseShow(y, years) {
  map.moveLayer(`s2-${y}`, under(map));
  map.setPaintProperty(`s2-${y}`, "raster-opacity", 1);
  const prev = curYear; curYear = y;
  setTimeout(() => { years.forEach((yy) => { if (yy !== curYear) map.setPaintProperty(`s2-${yy}`, "raster-opacity", 0); }); }, 650);
  return prev;
}
export function endLapse(y, years) {
  curYear = y;
  years.forEach((yy) => { const id = `s2-${yy}`; map.setPaintProperty(id, "raster-opacity", 1); map.setLayoutProperty(id, "visibility", yy === y ? "visible" : "none"); });
}
export const beforeYr = () => beforeYear;

// ---------- compare / swipe ----------
let swipeX = null;
function syncBefore() { if (before) { before.setPadding(map.getPadding()); before.jumpTo({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }); } }
export function compareOn(by) {
  beforeYear = by;
  const el = document.getElementById("mapBefore");
  el.hidden = false;
  if (!before) {
    before = new ml.Map({ container: el, style: style(), interactive: false, attributionControl: false, center: map.getCenter(), zoom: map.getZoom(), fadeDuration: 150 });
    before.on("load", () => { addLabels(before); addYear(before, beforeYear, true); syncBefore(); });
    map.on("move", syncBefore);
  } else if (before.loaded()) setBeforeYear(by);
  syncBefore();
  const sw = document.getElementById("swipe"); sw.hidden = false;
  document.getElementById("yearPills").hidden = false;
  if (swipeX == null) { const p = padding(); swipeX = p.left + (innerWidth - p.left - p.right) / 2; }
  placeSwipe(swipeX);
  sw.classList.remove("hint"); void sw.offsetWidth; sw.classList.add("hint");
  requestAnimationFrame(() => before && before.resize());
}
export function setBeforeYear(y) {
  beforeYear = y;
  if (!before || !before.isStyleLoaded()) return;
  const id = addYear(before, y, true);
  [...before._years].filter((yy) => yy !== y).forEach((yy) => before.setLayoutProperty(`s2-${yy}`, "visibility", "none"));
  before.setLayoutProperty(id, "visibility", "visible"); before.moveLayer(id, under(before));
}
export function compareOff() {
  document.getElementById("mapBefore").hidden = true;
  document.getElementById("swipe").hidden = true;
  document.getElementById("yearPills").hidden = true;
}
export function placeSwipe(x) {
  const W = innerWidth; swipeX = Math.max(0, Math.min(W, x));
  document.getElementById("swipe").style.left = swipeX + "px";
  document.getElementById("mapBefore").style.clipPath = `inset(0 ${W - swipeX}px 0 0)`;
}
export function initSwipe() {
  const knob = document.querySelector(".swipe-knob");
  let drag = false;
  knob.addEventListener("pointerdown", (e) => { drag = true; knob.setPointerCapture(e.pointerId); document.getElementById("swipe").classList.remove("hint"); });
  knob.addEventListener("pointermove", (e) => { if (drag) placeSwipe(e.clientX); });
  knob.addEventListener("pointerup", () => (drag = false));
  knob.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") placeSwipe(swipeX - 30); if (e.key === "ArrowRight") placeSwipe(swipeX + 30); });
  addEventListener("resize", () => swipeX != null && placeSwipe(Math.min(swipeX, innerWidth)));
}
export function sweepSwipe() {
  // a short automatic sweep so the audience sees the change without anyone touching the slider
  const p = padding(), a = p.left + 30, b = innerWidth - p.right - 30, mid = (a + b) / 2, amp = (b - a) * 0.42;
  const t0 = performance.now(), D = 3200;
  const f = (t) => { const k = Math.min(1, (t - t0) / D); placeSwipe(mid - amp * Math.sin(2 * Math.PI * k)); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

// ---------- labels ----------
export function toggleLabels() {
  labelsOn = !labelsOn;
  [map, before].forEach((m) => m && m.getLayer("labels") && m.setLayoutProperty("labels", "visibility", labelsOn ? "visible" : "none"));
  return labelsOn;
}

// ---------- overlays ----------
export function showHeat(canvas, b) {
  const url = canvas.toDataURL ? canvas.toDataURL() : null;
  const coords = [[b[0], b[3]], [b[2], b[3]], [b[2], b[1]], [b[0], b[1]]];
  const set = (u) => {
    if (map.getSource("heat")) { map.getSource("heat").updateImage({ url: u, coordinates: coords }); map.setLayoutProperty("heat", "visibility", "visible"); }
    else { map.addSource("heat", { type: "image", url: u, coordinates: coords }); map.addLayer({ id: "heat", type: "raster", source: "heat", paint: { "raster-opacity": 0.9, "raster-resampling": "linear" } }, "labels"); }
  };
  if (url) set(url); else canvas.convertToBlob().then((bl) => set(URL.createObjectURL(bl)));
}
export function heatVisible(v) { if (map.getLayer("heat")) map.setLayoutProperty("heat", "visibility", v ? "visible" : "none"); }
export function showRegions(regs) {
  map.getSource("regions").setData(fc(regs.map((r, i) => rect(r.bbox, { i: i + 1 }))));
  regMarkers.forEach((m) => m.remove()); regMarkers = [];
  regs.forEach((r, i) => {
    const el = document.createElement("div"); el.className = "mk-reg"; el.textContent = i + 1;
    regMarkers.push(new ml.Marker({ element: el, anchor: "center" }).setLngLat([r.bbox[0], r.bbox[3]]).addTo(map));
  });
}
export function regionsVisible(v) {
  ["regions-fill", "regions-line"].forEach((l) => map.setLayoutProperty(l, "visibility", v ? "visible" : "none"));
  regMarkers.forEach((m) => (m.getElement().style.display = v ? "" : "none"));
}
export function clearChange() { showRegions([]); if (map.getLayer("heat")) map.setLayoutProperty("heat", "visibility", "none"); }
export function showFocus(b) { map.getSource("focus").setData(fc(b ? [rect(b)] : [])); }

// ---------- markers ----------
let siteMarkers = [], resMarkers = [], regMarkers = [];
export function setSiteMarkers(sites, onClick) {
  siteMarkers.forEach((m) => m.remove());
  siteMarkers = sites.map((s) => {
    const el = document.createElement("div"); el.innerHTML = `<div class="mk" style="background:${CAT[s.cat].color}"></div>`; el.title = s.name;
    el.addEventListener("click", (e) => { e.stopPropagation(); onClick(s); });
    return new ml.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(map);
  });
}
export function setResultMarkers(results, onClick) {
  resMarkers.forEach((m) => m.remove());
  resMarkers = results.map((r, i) => {
    const el = document.createElement("div"); el.title = r.site.name;
    el.innerHTML = `<div class="mk-res${i ? " alt" : ""}" style="animation-delay:${i * 80}ms"><span>${i + 1}</span></div>`;
    el.addEventListener("click", (e) => { e.stopPropagation(); onClick(r, i); });
    return new ml.Marker({ element: el, anchor: "bottom", offset: [0, -2] }).setLngLat([r.site.lon, r.site.lat]).addTo(map);
  });
}
export function highlightResult(i) { resMarkers.forEach((m, j) => m.getElement().firstChild.classList.toggle("alt", j !== i)); }
export function clearResults() { resMarkers.forEach((m) => m.remove()); resMarkers = []; }
