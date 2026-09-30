// Analyst review queue, audit log and GeoJSON export with provenance.
import { MODEL_LABEL } from "./ai.js";
import { layerName } from "./tiles.js";

export const APP_VERSION = "DRISHTI-Δ web demo 0.9";
const KEY = "drishti-review-v1";
const ANALYST = "NOVA analyst (demo)";

// The one candidate released by the Beta pipeline on real Sentinel-2 L2A data.
const BETA = {
  id: "beta-jewar-t0384", source: "beta", name: "Jewar · tile t0384_0384", type: "Vegetation cleared", typeKey: "clear",
  center: [77.5947, 28.1812], bbox: null,
  evidence: {
    sensor: "Sentinel-2 L2A (14 real dates)", window: "2023-10-06 → 2024-05-18", change_type: "clearance", confidence: 0.56,
    ndvi: "0.211 → 0.161 (Δ −0.05)", ndbi_change: -0.033, persistence: "3 of the recent observations",
    method: "PCM: peer conformal p-value → CUSUM → BH-FDR gate → persistence ≥ 3", scan: "80 tiles × 14 dates, 1 candidate released",
  },
  status: "open", note: "", created: "2024-05-18T00:00:00Z",
};

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.items) return s; } catch {}
  return { items: [BETA], log: [{ t: new Date().toISOString(), who: "system", what: "Beta candidate loaded: Jewar t0384_0384" }] };
}
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const subs = new Set();
export const onChange = (f) => subs.add(f);
const emit = () => { save(); subs.forEach((f) => f(S)); };

export const items = () => S.items;
export const log = () => S.log;
export const openCount = () => S.items.filter((i) => i.status === "open").length;

export function addCandidate(site, region, res, idx) {
  const id = `web-${site ? site.id : "view"}-${res.years[0]}-${res.years[res.years.length - 1]}-${idx + 1}-${region.center.map((v) => v.toFixed(3)).join("_")}`;
  if (S.items.some((i) => i.id === id)) return false;
  S.items.unshift({
    id, source: "web", name: `${site ? site.name : "Current view"} · region ${idx + 1}`, type: region.typeLabel, typeKey: region.type,
    center: region.center, bbox: region.bbox,
    evidence: {
      imagery: `EOX ${res.years.map(layerName)[0]} … ${layerName(res.years[res.years.length - 1])}`,
      years: `${res.years[0]} → ${res.years[res.years.length - 1]} (${res.years.length} annual composites)`,
      onset_year: region.onsetYear, area_km2: +region.areaKm2.toFixed(3), q_value: +region.q.toExponential(2), p_combined: +region.pComb.toExponential(2),
      persistence_years: region.persistence, peer_z: +region.z.toFixed(2),
      greenness_vari: `${region.vBefore.toFixed(3)} → ${region.vAfter.toFixed(3)}`, brightness: `${region.bBefore.toFixed(3)} → ${region.bAfter.toFixed(3)}`,
      method: `PCM-lite: ${res.params.grid} peer cells, baseline ${res.params.baseline} yr, CUSUM k=${res.params.k} h=${res.params.h}, Fisher over last ${Math.min(3, res.years.length - res.params.baseline)} yr, BH-FDR q=${res.params.q}, persistence ≥ ${Math.min(3, res.years.length - res.params.baseline)}`,
    },
    status: "open", note: "", created: new Date().toISOString(),
  });
  S.log.unshift({ t: new Date().toISOString(), who: "system", what: `Queued ${site ? site.name : "view"} region ${idx + 1} (${region.typeLabel})` });
  emit(); return true;
}

export function decide(id, status, note) {
  const it = S.items.find((i) => i.id === id); if (!it) return;
  it.status = status; it.note = note ?? it.note; it.decided = new Date().toISOString(); it.analyst = ANALYST;
  const verb = { confirmed: "Confirmed", rejected: "Rejected", follow: "Marked for field follow-up", open: "Re-opened" }[status];
  S.log.unshift({ t: it.decided, who: ANALYST, what: `${verb}: ${it.name}${it.note ? ` · “${it.note}”` : ""}` });
  emit();
}
export function reset() { try { localStorage.removeItem(KEY); } catch {} S = load(); emit(); }

export function exportGeoJSON() {
  const [w, s, e, n] = [0, 1, 2, 3];
  const gj = {
    type: "FeatureCollection",
    name: "drishti_delta_change_events",
    provenance: {
      generator: APP_VERSION, exported_at: new Date().toISOString(), analyst: ANALYST,
      imagery: "Sentinel-2 cloudless annual mosaics by EOX IT Services GmbH (contains modified Copernicus Sentinel data), s2maps.eu",
      embedding_model: MODEL_LABEL, crs: "EPSG:4326",
    },
    features: S.items.map((i) => ({
      type: "Feature",
      properties: { id: i.id, name: i.name, source: i.source === "beta" ? "DRISHTI-Δ Beta pipeline" : "web demo PCM-lite", change_type: i.type,
        decision: i.status, note: i.note, decided_at: i.decided || null, analyst: i.analyst || null, created_at: i.created, ...i.evidence },
      geometry: i.bbox
        ? { type: "Polygon", coordinates: [[[i.bbox[w], i.bbox[s]], [i.bbox[e], i.bbox[s]], [i.bbox[e], i.bbox[n]], [i.bbox[w], i.bbox[n]], [i.bbox[w], i.bbox[s]]]] }
        : { type: "Point", coordinates: i.center },
    })),
    audit_log: S.log,
  };
  download(new Blob([JSON.stringify(gj, null, 2)], { type: "application/geo+json" }), `drishti_delta_events_${new Date().toISOString().slice(0, 10)}.geojson`);
}
export function download(blob, name) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
