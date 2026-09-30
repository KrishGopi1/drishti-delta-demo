// "How it works" modal: everything on the deck, in one place, with honest status labels.
const TAG = { Demonstrated: "t-dem", Prototype: "t-pro", Designed: "t-des", Planned: "t-pla", "Live in this demo": "t-web" };
const tag = (s) => `<span class="tag ${TAG[s]}">${s}</span>`;

export const JOURNEY = [
  ["Ask", "text or image", "des", "Type a question or drop an example image"],
  ["Parse", "place + time", "des", "Concept, place and time chips"],
  ["Retrieve", "ranked tiles", "des", "CLIP ranks every archive tile"],
  ["Explore", "tiles on the map", "des", "Pins, fly-to, similar places"],
  ["Compare", "time series", "dem", "Before / after swipe, time-lapse"],
  ["Detect", "PCM + FDR", "dem", "PCM-lite on 10 annual mosaics"],
  ["Explain", "type, evidence", "dem", "Change type, onset, zero-shot labels"],
  ["Review", "confirm / reject", "des", "Decision + audit log"],
  ["Export", "GeoJSON, GPKG", "des", "GeoJSON with provenance"],
];

const TABS = {
  journey: ["Journey", () => `
    <h3>One question in, one dated and evidenced answer out</h3>
    <p>The analyst journey from the deck. Colours show status in the full system; the orange row shows what this web demo runs live.</p>
    <div class="grpbar"><div style="background:#E9EEF5;color:#1F497D">SEMANTIC RETRIEVAL · Designed</div><div style="background:#E6F4EA;color:#2E7D32">CHANGE ANALYSIS · Demonstrated on real Sentinel-2</div><div style="background:#E9EEF5;color:#1F497D">ANALYST · Designed</div></div>
    <div class="chev">${JOURNEY.map(([n, d, s]) => `<div class="c-${s}"><b>${n}</b><small>${d}</small></div>`).join("")}</div>
    <div class="webrow">${JOURNEY.map((j) => `<div>${j[3]}</div>`).join("")}</div>
    <h3>Today vs DRISHTI-Δ</h3>
    <div class="flow"><b style="width:90px">TODAY</b>${["Know which dataset", "Search tile, date, cloud", "Download scenes", "Pre-process and align", "Compare by eye", "Interpret and report"].map((t) => `<span>${t}</span>`).join("<em>›</em>")}</div>
    <div class="flow ours" style="margin-top:8px"><b style="width:90px;color:#F28C28">DRISHTI-Δ</b>
      <span style="background:#FDEEDC;border-color:#F28C28">Ask in plain language</span><em>›</em><span style="background:#E4ECF6;border-color:#4F81BD">Retrieve matching tiles</span><em>›</em>
      <span style="background:#E6F4EA;border-color:#2E9E57">Compare every date automatically</span><em>›</em><span style="background:#E9EEF5;border-color:#1F497D">Dated, typed, evidence-backed answer</span></div>`],

  arch: ["Architecture", () => `
    <h3>System architecture (production design)</h3>
    <div class="arch">
      <div class="users">
        <div class="box" style="background:#E4ECF6"><b>Analyst browser</b><small>Chrome, no coding</small></div>
        <div class="box" style="background:#E6F4EA"><b>GIS desktop</b><small>QGIS reads the exports</small></div>
      </div>
      <div class="onprem">
        <div class="lbl"><img src="assets/logos/docker-original.png" alt="">ON-PREMISE DEPLOYMENT (DOCKER, AIR-GAP READY)</div>
        <div class="box" style="background:#BDD7EE"><b>Web UI</b><small>Timeline · Before / after · Evidence card · Confirm / reject</small></div>
        <div class="box" style="background:#9DC3E6"><b>API · FastAPI</b><small>one endpoint per journey step</small></div>
        <div class="g4">
          <div class="box" style="background:#D6DEEB"><b>Query parser</b><small>concept · place · time</small></div>
          <div class="box" style="background:#FAD7B5"><b>Retrieval (SGR)</b><small>RemoteCLIP embeddings</small></div>
          <div class="box" style="background:#C6E8D2"><b>Change engine (PCM)</b><small>p-value · CUSUM · FDR</small></div>
          <div class="box" style="background:#DCD3EA"><b>Discovery</b><small>HDBSCAN similar sites</small></div>
        </div>
        <div class="g4">
          <div class="box" style="background:#C9D3E0"><b>Qdrant</b><small>vectors</small></div>
          <div class="box" style="background:#C9D3E0"><b>PostGIS</b><small>events, audit</small></div>
          <div class="box" style="background:#C9D3E0"><b>COG + STAC</b><small>imagery</small></div>
          <div class="box" style="background:#C9D3E0"><b>Model weights</b><small>local</small></div>
        </div>
        <div class="box" style="background:#D5EBD9"><b>Ingestion worker</b><small>Sentinel-2 L2A in · mask → align → tile → embed → upsert, no rebuild · S-1, Landsat, Bhuvan planned</small></div>
      </div>
    </div>
    <h3>How this web demo maps onto it</h3>
    <table class="cmp"><tr><th>Production component</th><th>In this demo</th></tr>
      <tr><td>RemoteCLIP embeddings on a GPU / CPU server</td><td>CLIP ViT-B/32 (8-bit ONNX) running in the browser through WebAssembly</td></tr>
      <tr><td>Qdrant vector index</td><td>In-memory cosine search, embeddings cached in the browser (IndexedDB)</td></tr>
      <tr><td>COG + STAC Sentinel-2 L2A scenes, all dates</td><td>EOX Sentinel-2 cloudless annual mosaics 2016 to 2025 (one composite per year)</td></tr>
      <tr><td>PCM on NDVI / NDBI per date</td><td>PCM-lite on visible greenness (VARI) and brightness per year, same statistics</td></tr>
      <tr><td>PostGIS events and audit</td><td>Review queue and audit log in the browser, exported as GeoJSON</td></tr>
      <tr><td>HDBSCAN discovery</td><td>k-means clusters named by zero-shot CLIP labels</td></tr></table>`],

  inno: ["Innovations", () => `
    <div class="inno">
      <div style="background:#FDEEDC;border-color:#F28C28"><h4>PCM · Peer-Conformal Monitoring ${tag("Demonstrated")}</h4>
        <p>Every tile is judged against its peers on the same date, so monsoon, haze and sensor shifts that hit everyone cancel out.</p>
        <div class="formula">p = (1 + #{peers with score ≥ mine}) / (n + 1)<br>S<sub>t</sub> = max(0, S<sub>t−1</sub> + s<sub>t</sub> − k)<br>release if BH-FDR q ≤ 0.05 and persists ≥ 3</div>
        <p style="font-size:13px">Live here: open any site, press <b>Detect change</b>.</p></div>
      <div style="background:#E6F4EA;border-color:#2E9E57"><h4>HEK · Harmonic Embedding Keys ${tag("Designed")}</h4>
        <p>A harmonic fit over each tile's embedding time series removes the seasonal cycle and leaves one stable key per tile-year.</p>
        <div class="formula">e(t) ≈ a₀ + Σ a<sub>k</sub>cos(2πkt/T) + b<sub>k</sub>sin(2πkt/T)<br>key(tile, year) = a₀</div>
        <p style="font-size:13px">In this demo the annual cloud-free mosaics play that role: one season-free image per year. Compare years, not seasons; far fewer vectors to index.</p>
        <div style="display:flex;gap:6px">${["2019-04-30", "2020-10-06", "2022-10-16"].map((d) => `<figure style="margin:0;flex:1;text-align:center;font-size:10.5px;color:#5E6B7A"><img src="samples/jewar_${d}.png" style="width:100%;border-radius:6px" alt="">${d}</figure>`).join("")}</div></div>
      <div style="background:#E4ECF6;border-color:#4F81BD"><h4>SGR · Semantic-Gain Retrieval ${tag("Designed")}</h4>
        <p>Search for what a place <i>became</i>, not what it is.</p>
        <div class="formula">gain = similarity(after, query) − similarity(before, query)</div>
        <p style="font-size:13px">Query “new construction”: Jewar, cropland that became construction, gets a high gain and ranks first. An old town, built-up in both years, gets a low gain.</p>
        <p style="font-size:13px">Live here: type <b>new airport built between 2018 and 2024</b>.</p></div>
    </div>`],

  evidence: ["Evidence", () => `
    <div class="g2">
      <div><h3>DRISHTI-Δ Beta on real Sentinel-2 ${tag("Demonstrated")}</h3>
        <div class="stats" style="margin-bottom:10px"><div class="stat"><b>80</b><span>tiles scanned</span></div><div class="stat"><b>14</b><span>real dates</span></div><div class="stat"><b>1</b><span>candidate passed every PCM threshold</span></div></div>
        <table class="rec">
          <tr><td>Sensor</td><td>Sentinel-2 L2A</td></tr><tr><td>Tile, location</td><td>t0384_0384 · 28.1812°N, 77.5947°E (Jewar)</td></tr>
          <tr><td>Onset window</td><td>2023-10-06 → 2024-05-18</td></tr><tr><td>Change type</td><td>clearance</td></tr><tr><td>Confidence</td><td>0.56</td></tr>
          <tr><td>NDVI</td><td>0.211 → 0.161 (Δ −0.05)</td></tr><tr><td>NDBI change</td><td>−0.033</td></tr><tr><td>Method</td><td>PCM; persisted in 3 recent observations</td></tr></table></div>
      <div><h3>The chips behind it</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${["2019-04-30", "2020-10-06", "2022-10-16", "2024-10-30"].map((d) => `<figure style="margin:0;text-align:center;font-size:12px;color:#5E6B7A"><img src="samples/jewar_${d}.png" style="width:100%;border-radius:8px" alt="Jewar ${d}">${d}</figure>`).join("")}</div>
        <p class="note">Validation plan ${tag("Planned")}: Precision@K, Recall@K and mAP for retrieval; baseline vs PCM vs PCM + FDR for change (precision, recall, F1, false alarms); median onset error in days on verified windows; latency, indexing time and storage for a full AOI build.</p></div>
    </div>`],

  impact: ["Impact", () => `
    <h3>Who benefits</h3>
    <div class="g4" style="grid-template-columns:repeat(4,1fr)">
      <div class="ucard" style="border-color:#1F497D"><b>Defence and border security</b><i>“new roads or structures near the border since 2023”</i></div>
      <div class="ucard" style="border-color:#4F81BD"><b>Disaster response</b><i>“flooded settlements after the August rains”</i></div>
      <div class="ucard" style="border-color:#F28C28"><b>Urban and infrastructure planning</b><i>“built-up expansion around Pune, 2019 to 2025”</i></div>
      <div class="ucard" style="border-color:#2E9E57"><b>Agriculture and environment</b><i>“forest clearing or shrinking water bodies”</i></div>
    </div>
    <h3>Benefits</h3>
    <div class="g5">
      ${[["Social", "#8064A2", "#EEEAF4", ["Faster disaster before / after maps", "Evidence that non-experts can read"]],
        ["Economic", "#2E9E57", "#E6F4EA", ["No recurring imagery or API licence cost", "Laptop-scale compute (estimate)"]],
        ["Environmental", "#2E7D32", "#E8F3E8", ["Tracks clearing and water-body change", "Early flags on forests and wetlands"]],
        ["Strategic", "#1F497D", "#E9EEF5", ["Early, dated evidence of new construction", "Air-gapped, sovereign deployment"]],
        ["Technological", "#4F81BD", "#E4ECF6", ["Reusable search for any GeoTIFF or COG", "Provenance and audit trail per alert"]]]
        .map(([t, c, bg, l]) => `<div class="ucard" style="border-color:${c};background:${bg}"><b>${t}</b><ul style="margin:6px 0 0;padding-left:18px">${l.map((x) => `<li style="font-size:13px">${x}</li>`).join("")}</ul></div>`).join("")}
    </div>`],

  scope: ["Stack & sources", () => `
    <div class="g2">
      <div><h3>Technology</h3>
        <div class="logos">${[["python-original", "Python"], ["pytorch-original", "PyTorch"], ["huggingface", "Hugging Face"], ["fastapi-original", "FastAPI"], ["qdrant-icon", "Qdrant"],
          ["postgresql-original", "PostGIS"], ["gdal", "GDAL"], ["numpy-original", "NumPy"], ["scikitlearn-original", "scikit-learn"], ["docker-original", "Docker"], ["osm", "OpenStreetMap"], ["github-original", "GitHub"]]
          .map(([f, n]) => `<span><img src="assets/logos/${f}.png" alt="">${n}</span>`).join("")}</div>
        <p class="note" style="margin-top:10px">Web demo: MapLibre GL JS (globe), transformers.js + ONNX Runtime Web (CLIP), EOX Sentinel-2 cloudless, Nominatim geocoding, static hosting on Vercel.</p>
        <h3>What is real in this demo</h3>
        <table class="cmp"><tr><th>Feature</th><th>Status here</th></tr>
          <tr><td>Text and image search, SGR, discovery</td><td>${tag("Live in this demo")} real CLIP embeddings of real Sentinel-2 mosaics, computed in your browser</td></tr>
          <tr><td>Change detection (PCM-lite)</td><td>${tag("Live in this demo")} real statistics on 10 annual mosaics (RGB only)</td></tr>
          <tr><td>Jewar evidence record</td><td>${tag("Demonstrated")} from the Beta pipeline on Sentinel-2 L2A, 14 dates</td></tr>
          <tr><td>RemoteCLIP, HEK, Qdrant, PostGIS, on-prem</td><td>${tag("Designed")} production path</td></tr>
          <tr><td>Sentinel-1, Landsat, Bhuvan adapters</td><td>${tag("Planned")}</td></tr></table>
        <p class="note">Future scope ${tag("Planned")}: Sentinel-1 radar fusion · Landsat and Bhuvan adapters · local LLM query parsing · automated alerts · national-scale tiling.</p></div>
      <div><h3>References</h3>
        <ul>
          <li><b>Data:</b> ESA Copernicus Sentinel-2 L2A, <a href="https://dataspace.copernicus.eu" target="_blank" rel="noopener">dataspace.copernicus.eu</a>; STAC, <a href="https://stacspec.org" target="_blank" rel="noopener">stacspec.org</a>; Sentinel-2 cloudless, <a href="https://s2maps.eu" target="_blank" rel="noopener">s2maps.eu</a></li>
          <li><b>Retrieval:</b> Radford et al., CLIP, ICML 2021 (<a href="https://arxiv.org/abs/2103.00020" target="_blank" rel="noopener">arXiv:2103.00020</a>); Liu et al., RemoteCLIP, IEEE TGRS 2024 (<a href="https://arxiv.org/abs/2306.11029" target="_blank" rel="noopener">arXiv:2306.11029</a>)</li>
          <li><b>Change detection:</b> Zhu &amp; Woodcock, CCDC, RSE 2014; Verbesselt et al., BFAST, RSE 2010</li>
          <li><b>Statistics:</b> Vovk et al. 2005 (conformal); Page 1954 (CUSUM); Benjamini &amp; Hochberg 1995 (FDR); Fisher 1932 (combining p-values)</li>
          <li><b>Search:</b> Malkov &amp; Yashunin, HNSW, TPAMI 2020 (<a href="https://arxiv.org/abs/1603.09320" target="_blank" rel="noopener">arXiv:1603.09320</a>); Campello et al., HDBSCAN 2013; <a href="https://qdrant.tech" target="_blank" rel="noopener">qdrant.tech</a></li>
          <li><b>Greenness from RGB:</b> Gitelson et al., VARI, RSE 2002</li>
        </ul>
        <h3>Attribution</h3>
        <p class="note">Imagery: Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data). 2016 mosaic CC BY 4.0; 2017 onward CC BY-NC-SA 4.0, used here for a non-commercial demonstration. Labels and geocoding © OpenStreetMap contributors.</p></div>
    </div>`],
};

export function openAbout(tab = "journey") {
  const m = document.getElementById("modal"), tabs = document.getElementById("modalTabs"), body = document.getElementById("modalBody");
  tabs.innerHTML = Object.entries(TABS).map(([k, [n]]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}">${n}</button>`).join("");
  const show = (k) => { body.innerHTML = TABS[k][1](); tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.t === k)); body.scrollTop = 0; };
  tabs.onclick = (e) => { const b = e.target.closest("button"); if (b) show(b.dataset.t); };
  show(tab); m.hidden = false;
}
export function closeAbout() { document.getElementById("modal").hidden = true; }
