// DRISHTI-Δ web demo: UI controller.
import * as M from "./map.js";
import * as AI from "./ai.js";
import { SITES, CAT, VOCAB, VOCAB_SHORT, EXAMPLES, SAMPLE_PLACES } from "./catalog.js";
import { parse, matchSite, looksLikePlace } from "./parser.js";
import { YEARS, LATEST, patch, patchZoom, thumbURL, canvasToBlob } from "./tiles.js";
import { analyse, PARAMS } from "./change.js";
import { lineChart } from "./charts.js";
import * as RV from "./review.js";
import { openAbout, closeAbout, JOURNEY } from "./about.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const body = $("#panelBody");
const S = { view: "search", target: null, results: null, before: 2019, after: LATEST, change: null, lapse: false, searchId: 0 };
const fmtLat = (lat, lon) => `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ helpers
function toast(msg, ms = 3200) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), ms); }
function enterApp() { if (document.body.classList.contains("home")) { document.body.classList.remove("home"); M.stopSpin(); } }
function setView(v) {
  S.view = v; enterApp();
  $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  if (v !== "change") { stopLapse(); M.compareOff(); }
  if (v !== "search") M.clearResults();
  if (v !== "change") { M.clearChange(); M.showFocus(null); }
}
function setStep(i) {
  $$("#journey .st").forEach((el, j) => { el.classList.toggle("done", j < i); el.classList.toggle("now", j === i); });
  const [n, d] = JOURNEY[i];
  $("#jcap").innerHTML = `<span>Step ${i + 1} of 9 · <b>${n}</b> · ${d}</span><span>${JOURNEY[i][2] === "dem" ? "change analysis" : i >= 7 ? "analyst" : "semantic retrieval"}</span>`;
}
function target() { return S.target; }
const tName = (t) => (t.site ? t.site.name : t.name);
const tLatLon = (t) => (t.site ? [t.site.lat, t.site.lon] : [t.lat, t.lon]);
const tZoom = (t) => (t.site ? t.site.z : t.z || 12.5);
const hav = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const softmax = (xs, s = 100) => { const m = Math.max(...xs), e = xs.map((x) => Math.exp((x - m) * s)), z = e.reduce((a, b) => a + b, 0); return e.map((v) => v / z); };

async function setThumb(el, site, year) {
  try { const c = await AI.siteThumb(site, year); el.style.backgroundImage = `url(${thumbURL(c, 168)})`; } catch {}
}

// ------------------------------------------------------------------ AI status
async function aiOk() { try { await AI.ready(); return true; } catch { return false; } }
const aiDown = () => `<div class="evid" style="background:#FDEEDC;border-color:#F6C79A"><b style="color:#1F497D">The AI model could not be downloaded.</b>
  <div class="note">It loads from huggingface.co the first time (about 150 MB). Check the internet connection, then retry. Place search, the slider, time-lapse and change detection work without it.</div>
  <button class="btn small navy" onclick="window.__drishti.retryAI()">Retry</button></div>`;
const KW = (s) => `${s.name} ${s.place} ${s.tags.join(" ")} ${s.story} ${CAT[s.cat].label}`.toLowerCase();
function keywordScore(site, concept) {
  const words = concept.toLowerCase().split(/\W+/).filter((w) => w.length > 2).map((w) => w.replace(/s$/, ""));
  const t = KW(site); return words.reduce((a, w) => a + (t.includes(w) ? 1 : 0), 0) / Math.max(1, words.length);
}
function waitingUI(msg = "Preparing the AI") {
  return `<div class="note" id="wait"><b>${msg}…</b> <span id="waitTxt"></span></div><div class="progress"><i id="waitBar"></i></div>`;
}
AI.onStatus((st) => {
  const pill = $("#aiPill"), txt = $("#aiText");
  pill.classList.toggle("ready", st.phase === "ready"); pill.classList.toggle("error", st.phase === "error");
  let t = "AI: starting", w = "", pct = 0;
  if (st.phase === "loading") { pct = st.progress; t = `AI model ${Math.round(pct * 100)}%`; w = `downloading the CLIP model (about 150 MB, only once) · ${Math.round(pct * 100)}%`; }
  if (st.phase === "indexing") { pct = st.total ? st.indexed / st.total : 0; t = `Indexing ${st.indexed}/${st.total}`; w = `embedding archive tiles ${st.indexed} of ${st.total}`; }
  if (st.phase === "ready") { pct = 1; t = `AI ready · ${st.total} tiles`; }
  if (st.phase === "error") { t = "AI unavailable"; w = st.error; }
  txt.textContent = t;
  if ($("#waitTxt")) { $("#waitTxt").textContent = w; $("#waitBar").style.width = `${Math.round(pct * 100)}%`; }
  if (st.phase === "ready" && $("#cExplainBtn")) $("#cExplainBtn").click();
});

// ------------------------------------------------------------------ search box + suggestions
const CONCEPT_WORDS = /airport|runway|solar|panel|farm|crop|field|forest|tree|jungle|city|urban|town|building|lake|river|water|reservoir|desert|dune|sand|snow|glacier|ice|mangrove|wetland|port|dock|ship|harbour|harbor|mine|quarry|bridge|dam|salt|construction|clear|road|highway|coast|beach|mountain|hill|industrial|factory|green|barren|flood|new|built|garden|plantation|park|stadium|lagoon|delta|marsh|canal|railway|orchard|greenhouse|pond|island|valley|landslide|burn|fire/i;
const placey = (q) => (looksLikePlace(q) || q.trim().split(/\s+/).length <= 2) && !CONCEPT_WORDS.test(q);
function suggestions(q) {
  const t = q.trim().toLowerCase(); if (!t) return [];
  const out = [];
  SITES.filter((s) => `${s.name} ${s.place} ${s.state}`.toLowerCase().includes(t)).slice(0, 4)
    .forEach((s) => out.push({ kind: "site", site: s, label: s.name, sub: `${s.place}, ${s.state}` }));
  if (t.length >= 2) {
    const arch = { kind: "archive", label: `Search the archive for “${q.trim()}”`, sub: "text search" };
    const geo = { kind: "place", label: `Go to “${q.trim()}”`, sub: "place" };
    if (placey(q)) out.push(geo, arch); else out.push(arch, geo);
  }
  return out;
}
function bindSearch(box) {
  const input = $("input", box), sug = $(".suggest", box);
  let items = [], act = 0;
  const close = () => { sug.hidden = true; };
  const draw = () => {
    items = suggestions(input.value); act = 0;
    if (!items.length) return close();
    const exact = items.findIndex((i) => i.kind === "site" && i.site.name.toLowerCase() === input.value.trim().toLowerCase());
    act = exact >= 0 ? exact : items.findIndex((i) => i.kind !== "site") >= 0 && !items.some((i) => i.kind === "site" && i.site.place.toLowerCase() === input.value.trim().toLowerCase()) ? items.findIndex((i) => i.kind !== "site") : 0;
    sug.innerHTML = items.map((it, i) => {
      const ico = it.kind === "site" ? `<span class="s-ico" style="background:${CAT[it.site.cat].color}">●</span>` : it.kind === "archive" ? `<span class="s-ico" style="background:#F28C28">✦</span>` : `<span class="s-ico" style="background:#1F497D">⌖</span>`;
      return `<button data-i="${i}" class="${i === act ? "act" : ""}">${ico}<span>${esc(it.label)}</span><small>${esc(it.sub)}</small></button>`;
    }).join("");
    sug.hidden = false;
  };
  const choose = (it) => {
    close(); const q = input.value.trim(); if (!q) return;
    syncInputs(q);
    if (!it) return runQuery(q);
    if (it.kind === "site") { syncInputs(it.site.name); openChange({ site: it.site }); }
    else if (it.kind === "place") goPlace(q);
    else runQuery(q, { forceArchive: true });
  };
  input.addEventListener("input", draw);
  input.addEventListener("focus", draw);
  input.addEventListener("blur", () => setTimeout(close, 150));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (sug.hidden) return; e.preventDefault(); act = (act + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; $$("button", sug).forEach((b, i) => b.classList.toggle("act", i === act)); }
    if (e.key === "Enter") { e.preventDefault(); choose(sug.hidden ? null : items[act]); input.blur(); }
    if (e.key === "Escape") close();
  });
  sug.addEventListener("mousedown", (e) => { const b = e.target.closest("button"); if (b) { e.preventDefault(); choose(items[+b.dataset.i]); input.blur(); } });
  $(".img-btn", box).addEventListener("click", () => $("#fileInput").click());
  const go = $(".go", box); if (go) go.addEventListener("click", () => choose(null));
}
function syncInputs(q) { $$(".searchbox input").forEach((i) => (i.value = q)); }

// ------------------------------------------------------------------ query routing
async function runQuery(q, { forceArchive = false } = {}) {
  const p = parse(q);
  setView("search"); setStep(0);
  if (!forceArchive) {
    if (p.mode === "place" && p.place.type === "site") return openChange({ site: p.place.site });
    if (p.mode === "place" && p.place.type === "state") return showState(p.place.name);
    if (p.mode === "place" && p.place.type === "geo") return goPlace(p.place.name);
    if (!p.place && !p.change && placey(q)) return goPlace(q);
  }
  if (!p.concept) p.concept = q;
  return archiveSearch(p);
}

function chipsHTML(p) {
  const mode = p.mode === "sgr" ? "semantic change (SGR)" : "retrieval";
  const time = p.mode === "sgr" ? `${p.from ?? 2017} → ${p.to ?? LATEST}` : p.from ? (p.from === p.to ? `${p.from}` : `${p.from} → ${p.to}`) : "any year";
  return `<div class="chips">
    <span class="chip c-concept"><b>Concept</b>${esc(p.concept)}</span>
    <span class="chip c-place"><b>Place</b>${p.place ? esc(p.place.name) : "anywhere"}</span>
    <span class="chip c-time"><b>Time</b>${time}</span>
    <span class="chip c-mode"><b>Mode</b>${mode}</span></div>`;
}

async function placeFilter(p) {
  if (!p.place) return { sites: SITES };
  if (p.place.type === "state") {
    const ss = SITES.filter((s) => s.state === p.place.name);
    return { sites: ss, fly: centroid(ss, 6) };
  }
  if (p.place.type === "site") {
    const s0 = p.place.site;
    return { sites: SITES.filter((s) => hav(s.lat, s.lon, s0.lat, s0.lon) < 450), fly: { lat: s0.lat, lon: s0.lon, z: 7 } };
  }
  const g = await geocode(p.place.name);
  if (!g) return { sites: SITES };
  const near = SITES.map((s) => [s, hav(s.lat, s.lon, g.lat, g.lon)]).sort((a, b) => a[1] - b[1]);
  const within = near.filter((x) => x[1] < 450).map((x) => x[0]);
  return { sites: within.length >= 2 ? within : near.slice(0, 6).map((x) => x[0]), fly: { lat: g.lat, lon: g.lon, z: 6.5 } };
}
const centroid = (ss, z) => ({ lat: ss.reduce((a, s) => a + s.lat, 0) / ss.length, lon: ss.reduce((a, s) => a + s.lon, 0) / ss.length, z });

async function archiveSearch(p) {
  const id = ++S.searchId;
  M.showFocus(null); M.clearChange();
  body.innerHTML = `<div class="h">Your question, understood</div>${chipsHTML(p)}
    <div class="note">${p.mode === "sgr" ? "Ranked by <b>semantic gain</b>: how much more each place looks like your concept in the later year than in the earlier year." : "Ranked by how closely each archive tile matches the <b>meaning</b> of your words (CLIP similarity)."}</div>
    <div id="resArea">${AI.status.phase !== "ready" ? waitingUI() : ""}${"<div class='skel'></div>".repeat(4)}</div>`;
  setStep(1);
  const pf = await placeFilter(p);
  if (pf.fly) M.flyTo({ ...pf.fly, pitch: 0 });
  const ok = await aiOk(); if (id !== S.searchId) return;
  setStep(2);
  if (!ok) {
    const rs = pf.sites.map((s) => ({ site: s, score: keywordScore(s, p.concept), year: p.to ?? LATEST, y0: p.from ?? 2017, y1: p.to ?? LATEST, simA: 0, simB: 0 }))
      .filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
    S.results = { p: { ...p, mode: "retrieve" }, results: rs, floor: 0, kind: "text", fallback: true };
    renderResults(); setStep(3); if (rs.length) selectResult(0, true); return;
  }
  const q = await AI.embedQuery(p.concept);
  let results;
  if (p.mode === "sgr") {
    const y0 = p.from ?? 2017, y1 = p.to ?? LATEST;
    const area = $("#resArea");
    if (area) area.insertAdjacentHTML("afterbegin", `<div class="note" id="sgrp">Embedding ${y0} and ${y1} mosaics… <span></span></div>`);
    let n = 0;
    results = [];
    for (const s of pf.sites) {
      const [a, b] = await Promise.all([AI.siteEmbedding(s, y0), AI.siteEmbedding(s, y1)]);
      const sa = AI.dot(a, q), sb = AI.dot(b, q);
      results.push({ site: s, score: sb - sa, simA: sa, simB: sb, year: y1, y0, y1 });
      const sp = $("#sgrp span"); if (sp) sp.textContent = `${++n}/${pf.sites.length}`;
      if (id !== S.searchId) return;
    }
  } else {
    results = [];
    for (const s of pf.sites) {
      const ys = p.from ? [...new Set([p.from, p.to])] : AI.indexYears(s);
      let best = -1, by = ys[0];
      for (const y of ys) { const e = await AI.siteEmbedding(s, y); const v = AI.dot(e, q); if (v > best) { best = v; by = y; } }
      results.push({ site: s, score: best, year: by });
    }
  }
  if (id !== S.searchId) return;
  results.sort((a, b) => b.score - a.score);
  const floor = p.mode === "sgr" ? 0 : median(results.map((r) => r.score));
  results = results.slice(0, 8);
  S.results = { p, results, floor, kind: "text" };
  renderResults();
  setStep(3);
  if (results.length) selectResult(0, true);
}

function renderResults() {
  const { p, results, kind, qimg } = S.results;
  const head = kind === "text"
    ? `<div class="h">Your question, understood</div>${chipsHTML(p)}<div class="note">${p.mode === "sgr" ? "Ranked by <b>semantic gain</b> = similarity(after, query) − similarity(before, query)." : "Ranked by CLIP similarity between your words and each archive tile."}</div>`
    : `<div class="h">Search by example image</div><div class="qimg"><img src="${qimg}" alt="query"><div><b>${esc(S.results.label || "Your image")}</b><div class="note" style="margin:2px 0 0">Places whose imagery looks most like this one (image → image, same CLIP space).</div></div></div>`;
  const maxG = p && p.mode === "sgr" ? Math.max(1e-6, ...results.map((r) => r.score)) : 1;
  const floor = S.results.floor ?? Math.min(...results.map((r) => r.score)) - 0.01;
  const fb = S.results.fallback;
  body.innerHTML = `${head}${fb ? aiDown() : ""}<div class="h">Top matches ${fb ? '<span class="tag t-pla">keyword fallback</span>' : '<span class="tag t-web">live · CLIP in browser</span>'}</div>
    ${fb && !results.length ? '<div class="empty">No place in the catalogue mentions these words. Retry the AI for meaning-based search.</div>' : ""}
    ${results.map((r, i) => {
      const s = r.site, sgr = p && p.mode === "sgr";
      const pct = sgr ? Math.max(3, (100 * Math.max(0, r.score)) / maxG) : Math.max(4, (100 * (r.score - floor)) / Math.max(1e-6, results[0].score - floor));
      return `<div class="card" data-i="${i}">
        <div class="thumb" data-thumb="${i}"><span class="rank">${i + 1}</span><span class="yr">${sgr ? `${r.y0}→${r.y1}` : r.year}</span></div>
        <div class="body"><div class="name">${esc(s.name)}</div><div class="where">${esc(s.place)}, ${esc(s.state)} · ${CAT[s.cat].label}</div>
          <div class="bar ${sgr ? "gain" : ""}"><i data-w="${pct.toFixed(1)}"></i></div>
          <div class="scoreline">${sgr ? `<span>gain <b>${r.score >= 0 ? "+" : ""}${r.score.toFixed(3)}</b></span><span>${r.simA.toFixed(3)} → ${r.simB.toFixed(3)}</span>` : fb ? `<span>keyword overlap <b>${Math.round(r.score * 100)}%</b></span><span></span>` : `<span>similarity <b>${r.score.toFixed(3)}</b></span><span>${i === 0 ? "best match" : `${(r.score - results[0].score).toFixed(3)} vs #1`}</span>`}</div>
          <div class="acts"><button class="btn small primary" data-a="compare">Compare years</button><button class="btn small soft" data-a="similar">Similar places</button></div></div></div>`;
    }).join("")}
    <div class="note" style="margin-top:10px;${fb ? "display:none" : ""}">Index: ${SITES.length} places × ${[...new Set(SITES.flatMap(AI.indexYears))].length} years of Sentinel-2 cloudless mosaics. Model: ${AI.MODEL_LABEL}.</div>`;
  requestAnimationFrame(() => $$(".bar i[data-w]", body).forEach((b) => (b.style.width = b.dataset.w + "%")));
  results.forEach((r, i) => setThumb($(`[data-thumb="${i}"]`, body), r.site, r.year));
  $$(".card", body).forEach((c) => c.addEventListener("click", (e) => {
    const i = +c.dataset.i, a = e.target.closest("[data-a]");
    if (a && a.dataset.a === "compare") { const r = results[i]; openChange({ site: r.site }, p && p.mode === "sgr" ? [r.y0, r.y1] : null); return; }
    if (a && a.dataset.a === "similar") { similarToSite(results[i].site); return; }
    selectResult(i);
  }));
  M.setResultMarkers(results, (r, i) => selectResult(i));
}
function selectResult(i, auto = false) {
  const r = S.results.results[i]; if (!r) return;
  $$(".card", body).forEach((c) => c.classList.toggle("sel", +c.dataset.i === i));
  M.highlightResult(i);
  M.setYear(r.year);
  M.flyTo({ lat: r.site.lat, lon: r.site.lon, z: r.site.z, pitch: 42, bearing: -12 });
  if (!auto) setStep(3);
}

// ------------------------------------------------------------------ image search
async function imageSearch(canvas, label, exclude = null) {
  setView("search"); setStep(0);
  const id = ++S.searchId;
  const qimg = thumbURL(canvas, 160);
  body.innerHTML = `<div class="h">Search by example image</div><div class="qimg"><img src="${qimg}" alt=""><div><b>${esc(label)}</b></div></div>
    <div id="resArea">${AI.status.phase !== "ready" ? waitingUI() : ""}${"<div class='skel'></div>".repeat(4)}</div>`;
  M.showFocus(null); M.clearChange();
  if (!(await aiOk())) { if (id === S.searchId) $("#resArea").innerHTML = aiDown(); return; }
  if (id !== S.searchId) return;
  setStep(2);
  const q = await AI.embedImageCanvas(canvas);
  const results = [];
  for (const s of SITES) {
    if (exclude && hav(s.lat, s.lon, exclude[0], exclude[1]) < 4) continue;
    let best = -1, by = LATEST;
    for (const y of AI.indexYears(s)) { const v = AI.dot(await AI.siteEmbedding(s, y), q); if (v > best) { best = v; by = y; } }
    results.push({ site: s, score: best, year: by });
  }
  if (id !== S.searchId) return;
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 8);
  S.results = { p: null, results: top, floor: median(results.map((r) => r.score)), kind: "image", qimg, label };
  renderResults(); setStep(3);
  selectResult(0, true);
}
async function fileToCanvas(file) {
  const bm = await createImageBitmap(file);
  const s = Math.min(bm.width, bm.height), c = document.createElement("canvas"); c.width = c.height = 448;
  c.getContext("2d").drawImage(bm, (bm.width - s) / 2, (bm.height - s) / 2, s, s, 0, 0, 448, 448);
  return c;
}
async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return toast("Please choose an image file (PNG or JPG).");
  syncInputs("");
  imageSearch(await fileToCanvas(file), file.name);
}
async function viewCanvas() {
  const c = M.map.getCenter();
  const p = await patch(M.year(), c.lat, c.lng, patchZoom(M.map.getZoom()), 448);
  return { canvas: p.canvas, lat: c.lat, lon: c.lng, bounds: p.bounds };
}
async function similarToView() {
  if (M.map.getZoom() < 8) return toast("Zoom in on a place first (the view is used as the example image).");
  const v = await viewCanvas();
  M.showFocus(v.bounds);
  imageSearch(v.canvas, `This view (${M.year()}), ${fmtLat(v.lat, v.lon)}`, [v.lat, v.lon]);
}
async function similarToSite(site) {
  const p = await patch(LATEST, site.lat, site.lon, patchZoom(site.z), 448);
  imageSearch(p.canvas, `${site.name} (${LATEST})`, [site.lat, site.lon]);
}
async function saveView() {
  if (M.map.getZoom() < 8) return toast("Zoom in on a place first, then save the view.");
  const v = await viewCanvas();
  const name = (S.target ? tName(S.target) : "view").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  RV.download(await canvasToBlob(v.canvas), `drishti_${name}_${M.year()}.png`);
  M.showFocus(v.bounds);
  toast("Saved. Use the image button in the search bar to search with it.");
}

// ------------------------------------------------------------------ places
async function geocode(q) {
  const s = matchSite(q); if (s) return { lat: s.lat, lon: s.lon, name: s.name, site: s };
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
    const j = await r.json(); if (!j.length) return null;
    const g = j[0], bb = g.boundingbox.map(Number);
    return { lat: +g.lat, lon: +g.lon, name: g.display_name.split(",").slice(0, 3).join(","), bbox: [bb[2], bb[0], bb[3], bb[1]], type: g.type };
  } catch { return null; }
}
async function goPlace(q) {
  setView("search"); setStep(0);
  body.innerHTML = `<div class="h">Finding place</div><div class="skel"></div>`;
  const g = await geocode(q);
  if (!g) { body.innerHTML = `<div class="empty"><div class="big">⌖</div>No place called “${esc(q)}” was found.<br>Try a city, district or landmark, or search the archive by meaning.</div>`; return; }
  if (g.site) return openChange({ site: g.site });
  const span = g.bbox ? Math.max(g.bbox[2] - g.bbox[0], g.bbox[3] - g.bbox[1]) : 0.1;
  const z = Math.max(9, Math.min(13.5, Math.log2(360 / Math.max(span, 0.02)) - 0.6));
  S.target = { name: g.name, lat: g.lat, lon: g.lon, z };
  M.flyTo({ lat: g.lat, lon: g.lon, z, pitch: 35, bearing: -8 });
  M.clearResults();
  const near = SITES.map((s) => [s, hav(s.lat, s.lon, g.lat, g.lon)]).sort((a, b) => a[1] - b[1]).slice(0, 3);
  body.innerHTML = `<div class="h">Place</div><div class="title">${esc(g.name)}</div><div class="meta">${fmtLat(g.lat, g.lon)}</div>
    <div class="row wrap" style="margin-top:14px"><button class="btn primary" id="pCompare">Compare years here</button><button class="btn soft" id="pSimilar">Find similar places</button></div>
    <div class="row" style="margin-top:8px"><button class="btn soft" id="pSave">Save view as image</button><button class="btn soft" id="pExplain">What does the AI see?</button></div>
    <div id="pOut"></div>
    <div class="h">Nearest indexed places</div>${near.map(([s, d]) => `<div class="card" data-site="${s.id}"><div class="thumb" data-t="${s.id}"></div><div class="body"><div class="name">${esc(s.name)}</div><div class="where">${Math.round(d)} km away · ${CAT[s.cat].label}</div></div></div>`).join("")}`;
  near.forEach(([s]) => setThumb($(`[data-t="${s.id}"]`, body), s, LATEST));
  $$("[data-site]", body).forEach((c) => c.addEventListener("click", () => openChange({ site: SITES.find((s) => s.id === c.dataset.site) })));
  $("#pCompare").onclick = () => openChange(S.target);
  $("#pSimilar").onclick = () => setTimeout(similarToView, 50);
  $("#pSave").onclick = saveView;
  $("#pExplain").onclick = async () => { $("#pOut").innerHTML = waitingUI("Reading the view"); $("#pOut").innerHTML = await explainHTML(S.target, [LATEST]); };
  setStep(3);
}
function showState(name) {
  setView("search"); setStep(1);
  const ss = SITES.filter((s) => s.state === name);
  M.flyTo({ ...centroid(ss, 6) });
  S.results = null;
  const list = ss.map((s) => ({ site: s, score: 0, year: LATEST }));
  body.innerHTML = `<div class="h">${esc(name)}</div><div class="note">${ss.length} indexed places. Add a concept to search inside the state, for example “solar park in ${esc(name)}”.</div>` +
    ss.map((s, i) => `<div class="card" data-site="${s.id}"><div class="thumb" data-t="${s.id}"><span class="rank">${i + 1}</span></div><div class="body"><div class="name">${esc(s.name)}</div><div class="where">${esc(s.place)} · ${CAT[s.cat].label}</div><div class="note" style="margin:4px 0 0">${esc(s.story)}</div></div></div>`).join("");
  ss.forEach((s) => setThumb($(`[data-t="${s.id}"]`, body), s, LATEST));
  $$("[data-site]", body).forEach((c) => c.addEventListener("click", () => openChange({ site: SITES.find((s) => s.id === c.dataset.site) })));
  M.setResultMarkers(list, (r) => openChange({ site: r.site }));
}

// ------------------------------------------------------------------ explain (zero-shot labels)
async function vocabEmb() { return AI.embedTexts(VOCAB.map((v) => `a satellite image of ${v}`)); }
async function embFor(t, y) { const [lat, lon] = tLatLon(t); return t.site ? AI.siteEmbedding(t.site, y) : AI.pointEmbedding(lat, lon, tZoom(t), y); }
async function explainHTML(t, years) {
  if (!(await aiOk())) return aiDown();
  const V = await vocabEmb();
  const cols = [];
  for (const y of years) {
    const e = await embFor(t, y);
    const pr = softmax(V.map((v) => AI.dot(v, e)));
    const top = pr.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]).slice(0, 3);
    cols.push({ y, top });
  }
  const col = (c, cls) => `<div class="col ${cls}"><h5>${c.y}</h5>${c.top.map(([p, i]) => `<div class="lb">${VOCAB_SHORT[i]} <b style="float:right">${Math.round(p * 100)}%</b><div class="bar"><i style="width:${Math.max(4, p * 100)}%"></i></div></div>`).join("")}</div>`;
  const sent = cols.length === 2 ? `<div class="note">The model reads this place as <b>${VOCAB_SHORT[cols[0].top[0][1]]}</b> in ${cols[0].y} and <b>${VOCAB_SHORT[cols[1].top[0][1]]}</b> in ${cols[1].y}.</div>` : "";
  return `<div class="lbls" style="${cols.length === 1 ? "grid-template-columns:1fr" : ""}">${cols.map((c, i) => col(c, i ? "after" : "before")).join("")}</div>${sent}`;
}

// ------------------------------------------------------------------ change view
const STORIES = ["jewar", "navimumbai", "mopa", "atalsetu", "bhadla", "pavagada", "vizhinjam", "polavaram", "jharia"];
function renderChangeEmpty() {
  setStep(4);
  body.innerHTML = `<div class="h">Change stories</div><div class="note">Pick a place to open the before / after slider, or pan anywhere and press the compare button on the right.</div>` +
    STORIES.map((id) => SITES.find((s) => s.id === id)).map((s) => `<div class="card" data-site="${s.id}"><div class="thumb" data-t="${s.id}"><span class="yr">${s.before}→${s.after}</span></div><div class="body"><div class="name">${esc(s.name)}</div><div class="where">${esc(s.place)}, ${esc(s.state)}</div><div class="note" style="margin:4px 0 0">${esc(s.story)}</div></div></div>`).join("");
  STORIES.forEach((id) => { const s = SITES.find((x) => x.id === id); setThumb($(`[data-t="${id}"]`, body), s, s.after); });
  $$("[data-site]", body).forEach((c) => c.addEventListener("click", () => openChange({ site: SITES.find((s) => s.id === c.dataset.site) })));
}

async function openChange(t, years = null) {
  setView("change");
  S.target = t; S.change = null;
  const s = t.site;
  S.before = years ? years[0] : s ? s.before : 2019;
  S.after = years ? years[1] : s ? s.after : LATEST;
  if (S.after - S.before < 3) S.before = Math.max(YEARS[0], S.after - 5);
  M.clearResults(); M.clearChange(); M.showFocus(null);
  const [lat, lon] = tLatLon(t);
  fillYearSelects();
  M.setYear(S.after);
  M.compareOn(S.before);
  renderChange();
  setStep(4);
  await M.flyTo({ lat, lon, z: tZoom(t), pitch: 0, bearing: 0 });
  if (S.target === t) M.sweepSwipe();
}
function fillYearSelects() {
  const o = (sel, v, dis) => (sel.innerHTML = YEARS.map((y) => `<option value="${y}" ${y === v ? "selected" : ""}>${y}</option>`).join(""));
  o($("#selBefore"), S.before); o($("#selAfter"), S.after);
}
function renderChange() {
  const t = S.target; if (!t) return renderChangeEmpty();
  const s = t.site, [lat, lon] = tLatLon(t);
  const concept0 = s ? s.tags[0] : "construction";
  body.innerHTML = `
    <div class="h">Change analysis</div>
    <div class="title">${esc(tName(t))}</div>
    <div class="meta">${s ? `${esc(s.place)}, ${esc(s.state)} · ` : ""}${fmtLat(lat, lon)}</div>
    ${s ? `<div class="note">${esc(s.story)}</div>` : ""}
    <div class="note">Drag the orange handle on the map. Left shows <b style="color:#1F497D">${S.before}</b>, right shows <b style="color:#D9761A">${S.after}</b>. Change the years from the pills at the top.</div>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="cDetect">Detect change (PCM)</button><button class="btn navy" id="cLapse">${S.lapse ? "■ Stop" : "▶ Time-lapse"}</button></div>
    <div id="cOut"></div>
    <div class="h">What the AI sees <span class="tag t-web">zero-shot CLIP</span></div>
    <div id="cExplain">${AI.status.phase === "ready" ? '<div class="skel" style="height:90px"></div>' : '<button class="btn soft small" id="cExplainBtn">Explain the change</button>'}</div>
    <div class="h">Semantic gain over the years <span class="tag t-web">SGR</span></div>
    <div class="inline-input"><input id="sgrQ" value="${esc(concept0)}" aria-label="Concept"><button class="btn small navy" id="sgrGo">Plot</button></div>
    <div id="sgrOut"><div class="note">How strongly each year's image matches the concept. gain = similarity(${S.after}) − similarity(${S.before}).</div></div>
    ${s && s.beta ? betaCard() : ""}`;
  $("#cDetect").onclick = runDetect;
  $("#cLapse").onclick = () => (S.lapse ? stopLapse() : startLapse());
  $("#sgrGo").onclick = () => runSGR($("#sgrQ").value.trim());
  $("#sgrQ").addEventListener("keydown", (e) => { if (e.key === "Enter") runSGR($("#sgrQ").value.trim()); });
  const ex = async () => { const el = $("#cExplain"); el.innerHTML = waitingUI("Reading both years") + '<div class="skel" style="height:90px"></div>'; const h = await explainHTML(t, [S.before, S.after]); if (S.target === t) { el.innerHTML = h; } };
  if ($("#cExplainBtn")) $("#cExplainBtn").onclick = ex; else ex();
}
function betaCard() {
  return `<div class="evid"><div class="h" style="margin-top:0">Beta pipeline evidence <span class="tag t-dem">Demonstrated</span></div>
    <div class="note" style="margin-top:0">Real Sentinel-2 L2A run: 80 tiles × 14 dates, 1 candidate passed every PCM threshold.</div>
    <div class="chipsimg">${["2019-04-30", "2022-10-16", "2024-10-30"].map((d, i) => `<figure class="${i === 2 ? "hl" : ""}"><img src="samples/jewar_${d}.png" alt="">${d}</figure>`).join("")}</div>
    <table class="rec"><tr><td>Tile, location</td><td>t0384_0384 · 28.1812°N, 77.5947°E</td></tr><tr><td>Onset window</td><td>2023-10-06 → 2024-05-18</td></tr>
    <tr><td>Change type</td><td>clearance</td></tr><tr><td>Confidence</td><td>0.56</td></tr><tr><td>NDVI</td><td>0.211 → 0.161 (Δ −0.05)</td></tr>
    <tr><td>NDBI change</td><td>−0.033</td></tr><tr><td>Method</td><td>PCM; persisted in 3 recent observations</td></tr></table></div>`;
}

async function runDetect() {
  const t = S.target; if (!t) return;
  stopLapse();
  const out = $("#cOut"), btn = $("#cDetect");
  if (S.after - S.before < 3) { out.innerHTML = `<div class="note" style="color:#B42318">Pick a window of at least 4 years (for example ${S.after - 5} → ${S.after}). PCM needs a baseline plus 3 later observations.</div>`; return; }
  btn.disabled = true; btn.textContent = "Detecting…";
  out.innerHTML = `<div class="note">Reading ${S.after - S.before + 1} annual mosaics, scoring 1,024 cells against their peers…</div><div class="progress"><i id="detBar"></i></div>`;
  const c = M.map.getCenter();
  try {
    const res = await analyse({ lat: c.lat, lon: c.lng, z: M.map.getZoom(), from: S.before, to: S.after, onProgress: (f) => { const b = $("#detBar"); if (b) b.style.width = `${Math.round(f * 100)}%`; } });
    if (S.target !== t) return;
    S.change = res;
    M.showFocus(res.bounds);
    M.showHeat(res.heat, res.bounds);
    M.showRegions(res.regions);
    setStep(6);
    renderDetect(res);
  } catch (e) {
    out.innerHTML = `<div class="note" style="color:#B42318">${esc(e.message)}</div>`;
  } finally { btn.disabled = false; btn.textContent = "Detect change (PCM)"; }
}
function renderDetect(res) {
  const out = $("#cOut"), t = S.target;
  const km = res.regions.reduce((a, r) => a + r.areaKm2, 0);
  out.innerHTML = `
    <div class="h">Result <span class="tag t-web">PCM-lite · live</span></div>
    <div class="stats"><div class="stat"><b>${res.cells.toLocaleString()}</b><span>cells tested</span></div><div class="stat"><b>${res.flagged}</b><span>passed FDR + persistence</span></div><div class="stat"><b>${km.toFixed(2)}</b><span>km² flagged</span></div></div>
    <div class="toggles"><label><input type="checkbox" id="tHeat" checked> Change heatmap</label><label><input type="checkbox" id="tReg" checked> Flagged regions</label></div>
    <div class="legend"><span><i style="background:#F28C28"></i>vegetation cleared</span><span><i style="background:#E55323"></i>new built / bare</span><span><i style="background:#2E9E57"></i>greening</span><span><i style="background:#4F81BD"></i>water / darker</span></div>
    ${res.regions.length ? res.regions.map((r, i) => `
      <div class="region" style="border-left-color:${{ clear: "#F28C28", build: "#E55323", green: "#2E9E57", dark: "#4F81BD", other: "#8064A2" }[r.type]}">
        <div class="top"><span class="num">${i + 1}</span><span class="ty">${r.typeLabel}</span><span class="tag t-des" style="margin-left:auto">onset ${r.onsetYear}</span></div>
        <dl class="kv"><dt>Area</dt><dd>${r.areaKm2.toFixed(2)} km²</dd><dt>q-value (BH-FDR)</dt><dd>${r.q.toExponential(1)}</dd><dt>Persistence</dt><dd>${r.persistence} of ${res.years.length - res.params.baseline} later years</dd>
        <dt>Greenness (VARI)</dt><dd>${r.vBefore.toFixed(3)} → ${r.vAfter.toFixed(3)}</dd><dt>Brightness</dt><dd>${r.bBefore.toFixed(3)} → ${r.bAfter.toFixed(3)}</dd></dl>
        ${lineChart({ years: res.years, series: [{ values: r.series.map((x) => x.v), color: "#2E9E57" }, { values: r.series.map((x) => x.b), color: "#F28C28" }], marks: [{ year: r.onsetYear, label: "onset", color: "#1F497D" }], h: 120 })}
        <div class="legend" style="margin-top:0"><span><i style="background:#2E9E57"></i>greenness</span><span><i style="background:#F28C28"></i>brightness</span></div>
        <div class="row" style="margin-top:8px"><button class="btn small soft" data-zoom="${i}">Zoom to region</button><button class="btn small primary" data-rev="${i}">Send to review</button></div>
      </div>`).join("") : `<div class="note"><b>No region passed every gate</b> (FDR q ≤ ${PARAMS.q}, persistence over ${Math.min(3, res.years.length - res.params.baseline)} later years, effect size). ${res.changedPct > 2 ? "The heatmap shows raw differences, but they did not persist long enough, so PCM holds them back: this is how false alarms are controlled. Move <b>After</b> to a later year or widen the window." : "The scene is stable against its peers. Try another place, a wider window or zoom out."}</div>`}
    <div class="note">Method: ${res.params.grid} cells over ${res.years[0]} to ${res.years[res.years.length - 1]} · baseline ${res.baselineYears.join(", ")} · peer-normalised scores on each date → conformal p-values → CUSUM onset → Fisher over the last years → Benjamini-Hochberg q ≤ ${PARAMS.q} → persistence. Uses RGB greenness (VARI) and brightness from the annual mosaics; the Beta pipeline uses NDVI and NDBI on every Sentinel-2 L2A date.</div>`;
  $("#tHeat").onchange = (e) => M.heatVisible(e.target.checked);
  $("#tReg").onchange = (e) => M.regionsVisible(e.target.checked);
  $$("[data-zoom]", out).forEach((b) => (b.onclick = () => { const r = res.regions[+b.dataset.zoom]; M.fitBounds([r.bbox[0] - 0.01, r.bbox[1] - 0.01, r.bbox[2] + 0.01, r.bbox[3] + 0.01]); }));
  $$("[data-rev]", out).forEach((b) => (b.onclick = () => {
    const ok = RV.addCandidate(t.site, res.regions[+b.dataset.rev], res, +b.dataset.rev);
    b.textContent = ok ? "✓ In review queue" : "Already queued"; b.disabled = true; setStep(7);
    toast(ok ? "Added to the review queue." : "This region is already in the queue.");
  }));
}

async function runSGR(concept) {
  const t = S.target; if (!t || !concept) return;
  const out = $("#sgrOut");
  out.innerHTML = waitingUI("Embedding all ten years") + '<div class="skel" style="height:120px"></div>';
  if (!(await aiOk())) { out.innerHTML = aiDown(); return; }
  const q = await AI.embedQuery(concept);
  const vals = [];
  for (const y of YEARS) { vals.push(AI.dot(await embFor(t, y), q)); if ($("#waitTxt")) $("#waitTxt").textContent = `${y}`; }
  if (S.target !== t) return;
  const ia = YEARS.indexOf(S.before), ib = YEARS.indexOf(S.after), gain = vals[ib] - vals[ia];
  let jump = 1; for (let i = 2; i < vals.length; i++) if (vals[i] - vals[i - 1] > vals[jump] - vals[jump - 1]) jump = i;
  out.innerHTML = lineChart({ years: YEARS, series: [{ values: vals, color: "#4F81BD", highlight: [S.before, S.after] }], band: [S.before, S.after], h: 140, fmt: (v) => v.toFixed(3) }) +
    `<div class="stats" style="grid-template-columns:1fr 1fr;margin-top:6px"><div class="stat"><b style="color:${gain >= 0 ? "#D9761A" : "#1F497D"}">${gain >= 0 ? "+" : ""}${gain.toFixed(3)}</b><span>gain ${S.before} → ${S.after}</span></div><div class="stat"><b>${YEARS[jump - 1]}→${YEARS[jump]}</b><span>biggest one-year jump</span></div></div>
    <div class="note">Similarity of each year's image to “${esc(concept)}”. A rising curve means the place is becoming more like the concept.</div>`;
}

// time-lapse
let lapseTimer = null;
async function startLapse() {
  if (!S.target) return;
  S.lapse = true; $("#cLapse").textContent = "■ Stop";
  M.compareOff(); M.heatVisible(false);
  const ys = YEARS; M.prepareLapse(ys);
  const box = $("#lapse"); box.hidden = false; $("#lapseYear").textContent = "loading…"; $("#lapseFill").style.width = "0";
  await sleep(1500);
  let i = 0;
  const tick = () => {
    if (!S.lapse) return;
    const y = ys[i]; M.lapseShow(y, ys); $("#lapseYear").textContent = y; $("#lapseFill").style.width = `${((i + 1) / ys.length) * 100}%`;
    i = (i + 1) % ys.length; lapseTimer = setTimeout(tick, i === 0 ? 2600 : 1300);
  };
  tick();
}
function stopLapse() {
  if (!S.lapse) return;
  S.lapse = false; clearTimeout(lapseTimer); $("#lapse").hidden = true;
  M.endLapse(S.after, YEARS);
  if ($("#cLapse")) $("#cLapse").textContent = "▶ Time-lapse";
  if (S.view === "change" && S.target) { M.compareOn(S.before); if ($("#tHeat") && $("#tHeat").checked) M.heatVisible(true); }
}

// ------------------------------------------------------------------ discover
function kmeans(X, k, iters = 25) {
  let s = 12345; const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const C = [X[Math.floor(r() * X.length)]];
  while (C.length < k) {
    const d = X.map((x) => Math.min(...C.map((c) => 1 - AI.dot(x, c))) ** 2), tot = d.reduce((a, b) => a + b, 0);
    let u = r() * tot, i = 0; while (u > d[i] && i < d.length - 1) { u -= d[i]; i++; } C.push(X[i]);
  }
  let A = [];
  for (let it = 0; it < iters; it++) {
    A = X.map((x) => { let b = 0, bv = -9; C.forEach((c, j) => { const v = AI.dot(x, c); if (v > bv) { bv = v; b = j; } }); return b; });
    for (let j = 0; j < k; j++) {
      const m = X.filter((_, i) => A[i] === j); if (!m.length) continue;
      const v = new Float32Array(X[0].length); m.forEach((x) => x.forEach((a, i) => (v[i] += a)));
      let n = Math.hypot(...v) || 1; C[j] = v.map((a) => a / n);
    }
  }
  return { A, C };
}
async function renderDiscover() {
  setStep(3);
  body.innerHTML = `<div class="h">Discover <span class="tag t-web">unsupervised</span></div>
    <div class="note">The archive grouped by what the imagery looks like, with no labels given: k-means on the ${LATEST} CLIP embeddings, each group named by its closest description.</div>
    <div class="row" style="margin:8px 0 4px"><button class="btn navy" id="dSim">Find places like the current view</button></div>
    <div id="dOut">${AI.status.phase !== "ready" ? waitingUI() : ""}<div class="skel"></div><div class="skel"></div></div>`;
  $("#dSim").onclick = similarToView;
  if (!(await aiOk())) { $("#dOut").innerHTML = aiDown(); return; }
  if (S.view !== "discover") return;
  const X = [], ids = [];
  for (const s of SITES) { X.push(await AI.siteEmbedding(s, LATEST)); ids.push(s); }
  const k = 6, { A, C } = kmeans(X, k);
  const V = await vocabEmb();
  const COLS = ["#F28C28", "#4F81BD", "#2E9E57", "#8064A2", "#1F497D", "#A0764B"];
  const groups = [...Array(k).keys()].map((j) => ({ j, members: ids.filter((_, i) => A[i] === j) }))
    .filter((g) => g.members.length).sort((a, b) => b.members.length - a.members.length);
  // name each group by its closest description, never reusing a name
  const pairs = groups.flatMap((g, gi) => V.map((v, vi) => [AI.dot(v, C[g.j]), gi, vi])).sort((a, b) => b[0] - a[0]);
  const usedV = new Set(), named = new Set();
  for (const [, gi, vi] of pairs) { if (named.has(gi) || usedV.has(vi)) continue; groups[gi].name = VOCAB_SHORT[vi]; named.add(gi); usedV.add(vi); }
  if (S.view !== "discover") return;
  $("#dOut").innerHTML = groups.map((g, n) => `<div class="cluster" style="border-left:5px solid ${COLS[n % 6]}"><div class="ch"><i style="background:${COLS[n % 6]}"></i>${g.name}<small>${g.members.length} place${g.members.length > 1 ? "s" : ""}</small></div>
    <div class="mem">${g.members.map((s) => `<button data-site="${s.id}" title="${esc(s.name)}"><span>${esc(s.place)}</span></button>`).join("")}</div></div>`).join("");
  $$("#dOut [data-site]").forEach((b) => { const s = SITES.find((x) => x.id === b.dataset.site); setThumb(b, s, LATEST); b.onclick = () => openChange({ site: s }); });
}

// ------------------------------------------------------------------ review
function renderReview() {
  setStep(7);
  const its = RV.items();
  const stTag = { open: ["Open", "st-open"], confirmed: ["Confirmed", "st-confirmed"], rejected: ["Rejected", "st-rejected"], follow: ["Follow-up", "st-follow"] };
  body.innerHTML = `<div class="h">Review queue <span class="tag t-web">analyst in the loop</span></div>
    <div class="note">Every flagged change is confirmed or rejected by an analyst, with a note. Each decision is logged and travels with the export.</div>
    ${its.map((i) => `<div class="rv" data-id="${i.id}"><div class="top"><span class="name">${esc(i.name)}</span><span class="tag ${stTag[i.status][1]} st">${stTag[i.status][0]}</span></div>
      <div class="meta">${esc(i.type)} · ${i.source === "beta" ? "Beta pipeline, Sentinel-2 L2A" : "web demo, PCM-lite"}</div>
      <table class="rec" style="margin-top:6px">${Object.entries(i.evidence).slice(0, 7).map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td>${esc(v)}</td></tr>`).join("")}</table>
      <textarea placeholder="Analyst note (optional)">${esc(i.note || "")}</textarea>
      <div class="row"><button class="btn small green" data-d="confirmed">Confirm</button><button class="btn small red" data-d="rejected">Reject</button><button class="btn small soft" data-d="follow">Follow-up</button><button class="btn small soft" data-go="1" title="Show on map">Map</button></div></div>`).join("")}
    <div class="row" style="margin-top:6px"><button class="btn primary" id="rvExport">Export GeoJSON with provenance</button></div>
    <div class="h">Audit log</div><div class="log">${RV.log().slice(0, 14).map((l) => `<div><b>${new Date(l.t).toLocaleString()}</b> · ${esc(l.who)}<br>${esc(l.what)}</div>`).join("")}</div>
    <div style="margin-top:12px"><button class="btn small soft" id="rvReset">Reset demo queue</button></div>`;
  $$(".rv", body).forEach((el) => {
    const id = el.dataset.id;
    $$("[data-d]", el).forEach((b) => (b.onclick = () => { RV.decide(id, b.dataset.d, $("textarea", el).value.trim()); toast(`Decision logged: ${b.textContent}`); }));
    $("[data-go]", el).onclick = () => { const it = RV.items().find((x) => x.id === id); M.flyTo({ lat: it.center[1], lon: it.center[0], z: 13.5 }); if (it.bbox) M.showFocus(it.bbox); };
  });
  $("#rvExport").onclick = () => { RV.exportGeoJSON(); setStep(8); toast("GeoJSON downloaded. It opens directly in QGIS."); };
  $("#rvReset").onclick = () => RV.reset();
}
RV.onChange(() => { $("#reviewCount").textContent = RV.openCount() || ""; if (S.view === "review") renderReview(); });

// ------------------------------------------------------------------ search landing
function renderSearchHome() {
  setStep(0);
  body.innerHTML = `<div class="h">Ask the archive</div>
    <div class="note">Describe what you are looking for, with a place or years if you like. Add “new” or “built” to search for what a place <i>became</i>.</div>
    <div class="chips" style="margin:10px 0">${EXAMPLES.map((e) => `<button class="chip" data-q="${esc(e.q)}" style="cursor:pointer">${esc(e.q)}</button>`).join("")}</div>
    <div class="h">Search with an image</div>
    <div class="note">Click an image to search with it, or use the image button in the search bar with your own file.</div>
    <div class="cluster"><div class="mem">${["2019-04-30", "2024-10-30"].map((d) => `<button data-sample="samples/jewar_${d}.png" style="width:84px;height:84px;background-image:url(samples/jewar_${d}.png)"><span>Jewar ${d.slice(0, 4)}</span></button>`).join("")}</div></div>
    <div class="h">Places to save as query images</div>
    <div class="note">These are not in the index, so the search has to find look-alikes. Fly there, press <b>Save view as image</b> on the right, then search with the file.</div>
    ${SAMPLE_PLACES.map((p, i) => `<div class="card" data-sp="${i}"><div class="body"><div class="name">${esc(p.name)}</div><div class="where">expect: ${esc(p.expect)}</div></div><button class="btn small soft">Fly there</button></div>`).join("")}
    <div class="h">Presenter warm-up</div>
    <div class="note">Embeds every place for all 10 years so change queries and gain curves answer instantly. Run once before a demo; results are cached in this browser.</div>
    <button class="btn soft small" id="warmAll">Pre-embed all 10 years</button> <span class="meta" id="warmTxt"></span>`;
  $$("[data-q]", body).forEach((b) => (b.onclick = () => { syncInputs(b.dataset.q); runQuery(b.dataset.q); }));
  $$("[data-sample]", body).forEach((b) => (b.onclick = async () => { const r = await fetch(b.dataset.sample); const f = new File([await r.blob()], b.dataset.sample.split("/").pop(), { type: "image/png" }); handleFile(f); }));
  $("#warmAll").onclick = async () => {
    const b = $("#warmAll"); b.disabled = true;
    if (!(await aiOk())) { b.disabled = false; return toast("AI model unavailable, check the connection."); } let n = 0; const all = SITES.length * YEARS.length;
    for (const s of SITES) for (const y of YEARS) { await AI.siteEmbedding(s, y); if ($("#warmTxt")) $("#warmTxt").textContent = `${++n} / ${all}`; }
    if ($("#warmTxt")) $("#warmTxt").textContent = "done, archive fully embedded"; toast("Archive fully embedded for all 10 years.");
  };
  $$("[data-sp]", body).forEach((c) => (c.onclick = () => { const p = SAMPLE_PLACES[+c.dataset.sp]; S.target = { name: p.name, lat: p.lat, lon: p.lon, z: p.z }; M.flyTo({ lat: p.lat, lon: p.lon, z: p.z }); toast("Now press “Save view as image” on the right."); }));
}

// ------------------------------------------------------------------ wiring
function init() {
  $("#journey").innerHTML = JOURNEY.map(([n, d]) => `<div class="st" title="${n}: ${d}"></div>`).join("");
  $("#examples").innerHTML = EXAMPLES.map((e) => `<button data-q="${esc(e.q)}">${esc(e.q)}<small>${e.hint}</small></button>`).join("");
  $("#factSites").textContent = SITES.length;
  $$("#examples button").forEach((b) => (b.onclick = () => { syncInputs(b.dataset.q); runQuery(b.dataset.q); }));
  bindSearch($("#heroSearch")); bindSearch($("#panelSearch"));
  $("#fileInput").addEventListener("change", (e) => { handleFile(e.target.files[0]); e.target.value = ""; });
  $$("#tabs button").forEach((b) => (b.onclick = () => {
    const v = b.dataset.view; setView(v);
    if (v === "search") S.results ? renderResults() : renderSearchHome();
    if (v === "change") { if (S.target) openChange(S.target, [S.before, S.after]); else renderChangeEmpty(); }
    if (v === "discover") renderDiscover();
    if (v === "review") renderReview();
  }));
  $("#brandHome").onclick = (e) => { e.preventDefault(); stopLapse(); M.compareOff(); M.clearChange(); M.showFocus(null); M.clearResults(); document.body.classList.add("home"); M.setYear(LATEST); M.goHome(); };
  $("#howBtn").onclick = () => openAbout();
  $("#aiPill").onclick = () => openAbout("scope");
  $("#modalClose").onclick = closeAbout;
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeAbout(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeAbout(); });
  $$("#tools button").forEach((b) => (b.onclick = () => {
    const t = b.dataset.tool;
    if (t === "home") $("#brandHome").click();
    if (t === "labels") b.classList.toggle("on", M.toggleLabels());
    if (t === "similar") similarToView();
    if (t === "save") saveView();
    if (t === "compare") { const c = M.map.getCenter(); if (M.map.getZoom() < 8) return toast("Zoom in on a place first."); openChange({ name: "Current view", lat: c.lat, lon: c.lng, z: Math.max(12, M.map.getZoom()) }); }
  }));
  $("#selBefore").onchange = (e) => { S.before = +e.target.value; if (S.before >= S.after) { S.after = Math.min(LATEST, S.before + 1); fillYearSelects(); M.setYear(S.after); } M.setBeforeYear(S.before); refreshChangeText(); };
  $("#selAfter").onchange = (e) => { S.after = +e.target.value; if (S.after <= S.before) { S.before = Math.max(YEARS[0], S.after - 1); fillYearSelects(); M.setBeforeYear(S.before); } M.setYear(S.after); refreshChangeText(); };
  // drag and drop anywhere
  let dc = 0;
  addEventListener("dragenter", (e) => { if ([...e.dataTransfer.types].includes("Files")) { dc++; $("#drop").hidden = false; } });
  addEventListener("dragleave", () => { if (--dc <= 0) { dc = 0; $("#drop").hidden = true; } });
  addEventListener("dragover", (e) => e.preventDefault());
  addEventListener("drop", (e) => { e.preventDefault(); dc = 0; $("#drop").hidden = true; const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
  M.initSwipe();
  renderSearchHome();
  $("#reviewCount").textContent = RV.openCount() || "";
}
function refreshChangeText() {
  if (S.view !== "change") return;
  M.clearChange(); S.change = null;
  const out = $("#cOut"); if (out) out.innerHTML = "";
  renderChange();
}

init();
M.initMap().then(() => {
  M.setSiteMarkers(SITES, (s) => openChange({ site: s }));
  M.startSpin();
  // warm the AI in the background so the first search is instant
  setTimeout(() => AI.buildIndex().catch((e) => console.warn(e)), 1200);
  window.__drishti.retryAI = () => { toast("Retrying the AI download…"); AI.retry().then(() => toast("AI ready.")).catch(() => toast("Still unavailable. Check the connection.")); };
  const q = new URLSearchParams(location.search).get("q");
  if (q) { syncInputs(q); runQuery(q); }
});
window.__drishti = { S, M, AI };
