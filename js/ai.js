// CLIP client: model loading, embedding cache (memory + IndexedDB) and the archive index.
import { SITES } from "./catalog.js";
import { patch, patchZoom, LATEST } from "./tiles.js";

const params = new URLSearchParams(location.search);
export const MOCK = params.has("mock");
export const MODEL_LABEL = MOCK ? "mock embeddings (UI test mode)" : "CLIP ViT-B/32 (8-bit) in your browser";
const VER = MOCK ? "mock1" : "clip32q8v1";

export const status = { phase: "idle", progress: 0, indexed: 0, total: 0, error: null, info: null };
const subs = new Set();
export const onStatus = (fn) => { subs.add(fn); fn(status); };
const emit = () => subs.forEach((f) => f(status));

// ---------------- worker RPC ----------------
let worker, seq = 0;
const pending = new Map();
const files = new Map();
let chain = Promise.resolve();
function rawCall(type, payload, transfer) {
  return new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, ...payload }, transfer);
  });
}
// ONNX sessions run one request at a time, so calls are queued.
function call(type, payload = {}, transfer = []) {
  const p = chain.then(() => rawCall(type, payload, transfer));
  chain = p.catch(() => {});
  return p;
}
function startWorker() {
  worker = new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "progress") {
      const p = m.p;
      if (p.status === "progress" && p.file) { files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 }); }
      if (p.status === "done" && p.file && files.has(p.file)) { const f = files.get(p.file); f.loaded = f.total; }
      let L = 0, T = 0; files.forEach((f) => { L += f.loaded; T += f.total; });
      status.progress = T ? L / T : 0; emit(); return;
    }
    const h = pending.get(m.id); if (!h) return; pending.delete(m.id);
    m.ok ? h.resolve(m.result) : h.reject(new Error(m.error));
  };
  worker.onerror = (e) => { status.phase = "error"; status.error = e.message || "worker failed"; emit(); };
}

// ---------------- IndexedDB ----------------
let dbp;
function db() {
  if (!dbp) dbp = new Promise((res) => {
    try {
      const r = indexedDB.open("drishti-delta", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("emb");
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
async function idbGet(k) { const d = await db(); if (!d) return null; return new Promise((res) => { const q = d.transaction("emb").objectStore("emb").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); }
async function idbPut(k, v) { const d = await db(); if (!d) return; try { d.transaction("emb", "readwrite").objectStore("emb").put(v, k); } catch {} }

// ---------------- mock embeddings (for offline UI testing only) ----------------
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1; }
let P = null;
function proj() { if (!P) { const r = rng(7); P = Array.from({ length: 512 }, () => Float32Array.from({ length: 192 }, r)); } return P; }
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 17);
function l2(v) { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map((x) => x / s); }
function mockImage(img) {
  const f = new Float32Array(192); const { data, w, h } = img;
  for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = (by * h) / 8 | 0; y < ((by + 1) * h) / 8; y += 4) for (let x = (bx * w) / 8 | 0; x < ((bx + 1) * w) / 8; x += 4) { const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    const k = (by * 8 + bx) * 3; f[k] = r / n / 255 - 0.4; f[k + 1] = g / n / 255 - 0.4; f[k + 2] = b / n / 255 - 0.4;
  }
  return l2(Float32Array.from(proj(), (row) => row.reduce((s, v, i) => s + v * f[i], 0)));
}
function mockText(t) {
  const v = new Float32Array(512);
  t.toLowerCase().split(/\W+/).filter(Boolean).forEach((w) => { const r = rng(hash(w)); for (let i = 0; i < 512; i++) v[i] += r(); });
  return l2(v);
}

// ---------------- public API ----------------
let initP = null;
export function init() {
  if (initP) return initP;
  status.phase = "loading"; emit();
  initP = (async () => {
    if (MOCK) {
      for (let i = 1; i <= 10; i++) { await new Promise((r) => setTimeout(r, 60)); status.progress = i / 10; emit(); }
      status.info = { model: "mock" };
    } else {
      startWorker();
      status.info = await call("init");
    }
    status.phase = "indexing"; status.progress = 1; emit();
  })().catch((e) => { status.phase = "error"; status.error = e.message; emit(); throw e; });
  return initP;
}

const mem = new Map();
const textMem = new Map();
const thumbs = new Map();

function toImageData(canvas, size = 224) {
  const c = new OffscreenCanvas(size, size);
  const x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  x.drawImage(canvas, 0, 0, size, size);
  return { data: x.getImageData(0, 0, size, size).data, w: size, h: size };
}

export async function embedImageCanvas(canvas) {
  await init();
  const img = toImageData(canvas);
  if (MOCK) return mockImage(img);
  const buf = img.data.buffer.slice(0);
  const [e] = await call("image", { images: [{ buf, w: img.w, h: img.h }] }, [buf]);
  return e;
}

export async function embedTexts(texts) {
  await init();
  const need = texts.filter((t) => !textMem.has(t));
  if (need.length) {
    const out = MOCK ? need.map(mockText) : await call("text", { texts: need });
    need.forEach((t, i) => textMem.set(t, out[i]));
  }
  return texts.map((t) => textMem.get(t));
}

// Prompt ensemble: average of a few phrasings, as in the CLIP paper.
export async function embedQuery(q) {
  const ps = [`a satellite image of ${q}`, `an aerial photo of ${q}`, `${q}, seen from space`];
  const es = await embedTexts(ps);
  const v = new Float32Array(es[0].length);
  es.forEach((e) => e.forEach((x, i) => (v[i] += x)));
  return l2(v);
}

export const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// Embedding of the archive patch for a site in a year (cached in memory and IndexedDB).
export async function siteEmbedding(site, year) {
  const z = patchZoom(site.z);
  const key = `${VER}|${site.id}|${year}|${z}`;
  if (mem.has(key)) return mem.get(key);
  let e = await idbGet(key);
  if (!e) {
    const p = await patch(year, site.lat, site.lon, z);
    e = await embedImageCanvas(p.canvas);
    idbPut(key, e);
    if (!thumbs.has(`${site.id}|${year}`)) thumbs.set(`${site.id}|${year}`, p.canvas);
  }
  mem.set(key, e);
  return e;
}

// Embedding of an arbitrary location (used for "similar to this view" and the SGR curve).
export async function pointEmbedding(lat, lon, z, year) {
  const zz = patchZoom(z);
  const key = `${VER}|pt|${lat.toFixed(4)}|${lon.toFixed(4)}|${year}|${zz}`;
  if (mem.has(key)) return mem.get(key);
  const p = await patch(year, lat, lon, zz);
  const e = await embedImageCanvas(p.canvas);
  mem.set(key, e);
  return e;
}

export async function siteThumb(site, year) {
  const k = `${site.id}|${year}`;
  if (!thumbs.has(k)) thumbs.set(k, (await patch(year, site.lat, site.lon, patchZoom(site.z))).canvas);
  return thumbs.get(k);
}

export const indexYears = (s) => [...new Set([s.before, s.after, LATEST])].sort();

let indexP = null;
export function buildIndex() {
  if (indexP) return indexP;
  indexP = (async () => {
    try { await init(); } catch (e) { indexP = null; throw e; }
    const jobs = SITES.flatMap((s) => indexYears(s).map((y) => [s, y]));
    status.total = jobs.length; status.indexed = 0; status.phase = "indexing"; emit();
    for (const [s, y] of jobs) {
      try { await siteEmbedding(s, y); } catch (e) { console.warn("index", s.id, y, e); }
      status.indexed++; emit();
    }
    status.phase = "ready"; emit();
  })();
  return indexP;
}
export const ready = () => buildIndex();
export function retry() {
  if (worker) { worker.terminate(); worker = null; }
  pending.clear(); files.clear(); chain = Promise.resolve();
  initP = null; indexP = null; status.error = null; status.progress = 0;
  return buildIndex();
}
