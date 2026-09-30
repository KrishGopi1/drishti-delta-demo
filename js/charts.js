// Tiny dependency-free SVG line charts.
export function lineChart({ years, series, marks = [], band = null, h = 150, fmt = (v) => v.toFixed(2), axis = "" }) {
  const W = 360, H = h, L = 38, R = 10, T = 14, B = 24;
  const all = series.flatMap((s) => s.values.filter((v) => v != null));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1e-6) { hi += 0.01; lo -= 0.01; }
  const padv = (hi - lo) * 0.15; lo -= padv; hi += padv;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, years.length - 1);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let g = "";
  if (band) { const i0 = years.indexOf(band[0]), i1 = years.indexOf(band[1]); if (i0 >= 0 && i1 >= 0) g += `<rect x="${x(i0)}" y="${T}" width="${x(i1) - x(i0)}" height="${H - T - B}" fill="#FDEEDC"/>`; }
  for (let k = 0; k <= 3; k++) { const v = lo + ((hi - lo) * k) / 3, yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#E6EBF0"/><text x="${L - 5}" y="${yy + 3.5}" text-anchor="end" font-size="9.5" fill="#6B7785">${fmt(v)}</text>`; }
  years.forEach((yr, i) => { if (years.length <= 10 || i % 2 === 0) g += `<text x="${x(i)}" y="${H - 7}" text-anchor="middle" font-size="9.5" fill="#6B7785">${String(yr).slice(-2) === String(yr).slice(-2) ? "’" + String(yr).slice(-2) : yr}</text>`; });
  marks.forEach((m) => { const i = years.indexOf(m.year); if (i < 0) return; g += `<line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}" stroke="${m.color}" stroke-width="1.6"/><text x="${x(i) + 3}" y="${T + 8}" font-size="9.5" font-weight="700" fill="${m.color}">${m.label}</text>`; });
  series.forEach((s) => {
    const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    g += `<polyline fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
    pts.forEach((p, i) => { const hl = s.highlight && s.highlight.includes(years[i]); g += `<circle cx="${p[0]}" cy="${p[1]}" r="${hl ? 4.6 : 3}" fill="${hl ? s.color : "#fff"}" stroke="${s.color}" stroke-width="2"/>`; });
  });
  if (axis) g += `<text x="4" y="10" font-size="9.5" fill="#6B7785">${axis}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
