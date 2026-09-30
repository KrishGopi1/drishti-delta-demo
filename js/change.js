// PCM-lite: Peer-Conformal Monitoring on annual Sentinel-2 composites, entirely in the browser.
//   1. per cell and year: visible greenness (VARI) and brightness
//   2. residual against the cell's own baseline years
//   3. robust z-score against its PEERS on the SAME date (removes composite / sensor / season shifts)
//   4. conformal p-value on each date, CUSUM for the onset year
//   5. Fisher-combined p over the last observations, Benjamini-Hochberg FDR gate, persistence >= 3
import { patch, worldToLonLat, lonLatToWorld, metersPerPixel } from "./tiles.js";

export const PARAMS = { size: 512, cell: 16, q: 0.05, k: 1.5, h: 3, minZ: 3, persist: 3, pEach: 0.1 };

const median = (a) => { const s = Float32Array.from(a).sort(); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
function robust(a) { const m = median(a); const d = median(a.map((x) => Math.abs(x - m))) * 1.4826; return [m, d || 1e-3]; }
function chi2sfEven(x, df) { const m = df / 2, h = x / 2; let t = 1, s = 1; for (let i = 1; i < m; i++) { t *= h / i; s += t; } return Math.min(1, Math.exp(-h) * s); }
function bh(p) {
  const n = p.length, idx = [...p.keys()].sort((a, b) => p[a] - p[b]), q = new Float64Array(n);
  let run = 1; for (let r = n - 1; r >= 0; r--) { const i = idx[r]; run = Math.min(run, (p[i] * n) / (r + 1)); q[i] = run; }
  return q;
}

function pixelFeatures(canvas, size) {
  const d = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, size, size).data;
  const v = new Float32Array(size * size), b = new Float32Array(size * size);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255;
    const den = G + R - B;
    v[j] = Math.max(-1, Math.min(1, Math.abs(den) < 0.02 ? 0 : (G - R) / den));
    b[j] = (R + G + B) / 3;
  }
  return { v, b };
}

export async function analyse({ lat, lon, z, from, to, onProgress = () => {} }) {
  const P = PARAMS, S = P.size, C = P.cell, G = S / C, N = G * G;
  const zz = Math.max(10, Math.min(14, Math.round(z)));
  const years = []; for (let y = from; y <= to; y++) years.push(y);
  const T = years.length;
  if (T < 4) throw new Error("Pick a window of at least 4 years: PCM needs a baseline plus 3 later observations.");

  // ---- fetch every annual composite for the window ----
  let done = 0;
  const patches = await Promise.all(years.map((y) => patch(y, lat, lon, zz, S).then((p) => { onProgress(++done / T); return p; })));
  const feats = patches.map((p) => pixelFeatures(p.canvas, S));
  const bounds = patches[0].bounds;

  // ---- cell means ----
  const cv = years.map(() => new Float32Array(N)), cb = years.map(() => new Float32Array(N));
  feats.forEach((f, t) => {
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      let sv = 0, sb = 0;
      for (let y = gy * C; y < gy * C + C; y++) for (let x = gx * C; x < gx * C + C; x++) { const i = y * S + x; sv += f.v[i]; sb += f.b[i]; }
      cv[t][gy * G + gx] = sv / (C * C); cb[t][gy * G + gx] = sb / (C * C);
    }
  });

  // ---- baseline, peer-normalised scores, conformal p-values ----
  const B = T >= 6 ? 2 : 1;
  const bv = new Float32Array(N), bb = new Float32Array(N);
  for (let c = 0; c < N; c++) { let a = 0, e = 0; for (let t = 0; t < B; t++) { a += cv[t][c]; e += cb[t][c]; } bv[c] = a / B; bb[c] = e / B; }
  const s = years.map(() => new Float32Array(N)), p = years.map(() => new Float32Array(N));
  const zv = years.map(() => new Float32Array(N)), zb = years.map(() => new Float32Array(N));
  for (let t = 0; t < T; t++) {
    const rv = cv[t].map((x, c) => x - bv[c]), rb = cb[t].map((x, c) => x - bb[c]);
    const [mv, dv] = robust(rv), [mb, db] = robust(rb);
    for (let c = 0; c < N; c++) { zv[t][c] = (rv[c] - mv) / dv; zb[t][c] = (rb[c] - mb) / db; s[t][c] = Math.hypot(zv[t][c], zb[t][c]); }
    const sorted = Float32Array.from(s[t]).sort();
    for (let c = 0; c < N; c++) {
      let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < s[t][c]) lo = m + 1; else hi = m; }
      p[t][c] = (N - lo + 1) / (N + 1);           // (1 + #peers with score >= mine) / (n + 1)
    }
  }

  // ---- CUSUM onset, Fisher combination, persistence ----
  const pc = new Float64Array(N), onset = new Int16Array(N), pers = new Int16Array(N), mag = new Float32Array(N);
  for (let c = 0; c < N; c++) {
    let S_ = 0, br = -1;
    for (let t = B; t < T; t++) { S_ = Math.max(0, S_ + s[t][c] - P.k); if (br < 0 && S_ > P.h) br = t; }
    onset[c] = br;
    const m = Math.min(P.persist, T - B);
    let X = 0; for (let t = T - m; t < T; t++) X -= 2 * Math.log(p[t][c]);
    pc[c] = chi2sfEven(X, 2 * m);
    let k = 0; for (let t = T - 1; t >= B && p[t][c] <= P.pEach; t--) k++;
    pers[c] = k;
    const tail = []; for (let t = T - m; t < T; t++) tail.push(s[t][c]); mag[c] = median(tail);
  }
  const q = bh(pc);
  const flag = new Uint8Array(N);
  for (let c = 0; c < N; c++) flag[c] = q[c] <= P.q && pers[c] >= Math.min(P.persist, T - B) && mag[c] >= P.minZ && onset[c] >= 0 ? 1 : 0;

  // ---- regions (connected flagged cells) ----
  const lab = new Int32Array(N).fill(-1), regions = [];
  const [ox, oy] = lonLatToWorld(bounds[0], bounds[3], zz);
  const mpp = metersPerPixel(lat, zz), cellKm2 = ((C * mpp) / 1000) ** 2;
  for (let c0 = 0; c0 < N; c0++) {
    if (!flag[c0] || lab[c0] >= 0) continue;
    const id = regions.length, st = [c0], cells = []; lab[c0] = id;
    while (st.length) {
      const c = st.pop(); cells.push(c); const gx = c % G, gy = (c / G) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = gx + dx, ny = gy + dy; if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
        const n = ny * G + nx; if (flag[n] && lab[n] < 0) { lab[n] = id; st.push(n); }
      }
    }
    regions.push(cells);
  }
  const TYPES = { clear: "Vegetation cleared", build: "New built / bare surface", green: "Vegetation gain", dark: "Water or darkening", other: "Surface change" };
  const typeOf = (dv, db) => (dv < -0.04 && db > 0.06 ? "build" : dv < -0.04 ? "clear" : db > 0.06 ? "build" : dv > 0.04 ? "green" : db < -0.04 ? "dark" : "other");
  const out = regions.map((cells) => {
    const xs = cells.map((c) => c % G), ys = cells.map((c) => (c / G) | 0);
    const [w, n] = worldToLonLat(ox + Math.min(...xs) * C, oy + Math.min(...ys) * C, zz);
    const [e, so] = worldToLonLat(ox + (Math.max(...xs) + 1) * C, oy + (Math.max(...ys) + 1) * C, zz);
    const series = years.map((_, t) => ({ v: cells.reduce((a, c) => a + cv[t][c], 0) / cells.length, b: cells.reduce((a, c) => a + cb[t][c], 0) / cells.length }));
    const post = Math.min(P.persist, T - B);
    const avg = (arr) => arr.reduce((a, x) => a + x, 0) / arr.length;
    const vBefore = avg(series.slice(0, B).map((x) => x.v)), vAfter = avg(series.slice(T - post).map((x) => x.v));
    const bBefore = avg(series.slice(0, B).map((x) => x.b)), bAfter = avg(series.slice(T - post).map((x) => x.b));
    const on = median(cells.map((c) => onset[c]));
    const t = typeOf(vAfter - vBefore, bAfter - bBefore);
    return {
      cells: cells.length, areaKm2: cells.length * cellKm2, bbox: [w, so, e, n], center: [(w + e) / 2, (so + n) / 2],
      onsetYear: years[Math.round(on)], q: Math.min(...cells.map((c) => q[c])), pComb: Math.min(...cells.map((c) => pc[c])),
      persistence: Math.min(...cells.map((c) => pers[c])), z: median(cells.map((c) => mag[c])),
      vBefore, vAfter, bBefore, bAfter, type: t, typeLabel: TYPES[t], series,
    };
  }).filter((r) => r.cells >= 2).sort((a, b) => b.cells - a.cells).slice(0, 6);

  // ---- smooth heatmap (first vs last year), coloured by change type ----
  const H = 128, k = S / H, f0 = feats[0], f1 = feats[T - 1];
  const dvp = new Float32Array(H * H), dbp = new Float32Array(H * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) {
    let a = 0, e = 0;
    for (let yy = y * k; yy < y * k + k; yy++) for (let xx = x * k; xx < x * k + k; xx++) { const i = yy * S + xx; a += f1.v[i] - f0.v[i]; e += f1.b[i] - f0.b[i]; }
    dvp[y * H + x] = a / (k * k); dbp[y * H + x] = e / (k * k);
  }
  const [mv, sv] = robust(dvp), [mb, sb] = robust(dbp);
  const heat = new OffscreenCanvas(H, H), hx = heat.getContext("2d"), img = hx.createImageData(H, H);
  let changed = 0;
  const COL = { clear: [242, 140, 40], build: [229, 83, 35], green: [46, 158, 87], dark: [79, 129, 189], other: [128, 100, 162] };
  for (let i = 0; i < H * H; i++) {
    const a = (dvp[i] - mv) / sv, e = (dbp[i] - mb) / sb, m = Math.hypot(a, e);
    const al = Math.max(0, Math.min(1, (m - 2.5) / 4));
    if (al > 0.15) changed++;
    const col = COL[typeOf(dvp[i] - mv, dbp[i] - mb)];
    img.data.set([col[0], col[1], col[2], Math.round(al * 215)], i * 4);
  }
  hx.putImageData(img, 0, 0);

  return {
    years, bounds, z: zz, cells: N, flagged: flag.reduce((a, x) => a + x, 0), regions: out, heat,
    changedPct: (100 * changed) / (H * H), baselineYears: years.slice(0, B), params: { ...P, baseline: B, grid: `${G}×${G}` },
    thumbs: [patches[0].canvas, patches[T - 1].canvas],
  };
}
