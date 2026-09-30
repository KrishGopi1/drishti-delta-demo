// Query parser: splits a plain-language request into concept, place and time, and spots "change" intent.
import { SITES, STATES } from "./catalog.js";
import { YEARS } from "./tiles.js";

const Y0 = YEARS[0], Y1 = YEARS[YEARS.length - 1];
const clampY = (y) => Math.max(Y0, Math.min(Y1, +y));
const CHANGE = /\b(new|newly|built|build|construct\w*|appear\w*|emerg\w*|expan\w*|grew|grow\w*|cleared|clearing|clearance|lost|loss|became|developed|came up|converted|replaced)\b/gi;
const FILLER = /\b(show me|show|find me|find|search for|search|look for|images? of|tiles? of|places? with|areas? with|areas? of|where|there (is|are)|any|all|please|the|was|were|has|have|been|that|which)\b/gi;

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function matchSite(text) {
  const t = norm(text);
  if (!t) return null;
  return SITES.find((s) => norm(s.name) === t || norm(s.place) === t || norm(s.id) === t)
    || SITES.find((s) => t.length > 3 && (norm(s.name).includes(t) || norm(s.place).split(" ").includes(t)));
}
export function matchState(text) {
  const t = norm(text);
  return STATES.find((s) => norm(s) === t) || null;
}

export function parse(raw) {
  let q = " " + raw.trim() + " ";
  const out = { raw: raw.trim(), concept: "", place: null, from: null, to: null, mode: "retrieve", change: false };

  // ---- time ----
  const T = [
    [/\b(?:between|from)\s+(20\d\d)\s+(?:and|to|till|until)\s+(20\d\d)\b/i, (m) => [m[1], m[2]]],
    [/\b(20\d\d)\s*(?:-|to|→|till|until|vs|versus)\s*(20\d\d)\b/i, (m) => [m[1], m[2]]],
    [/\b(?:after|since|post)\s+(20\d\d)\b/i, (m) => [m[1], Y1]],
    [/\b(?:before|until|till|pre)\s+(20\d\d)\b/i, (m) => [Y0, m[1]]],
    [/\b(?:in|during|of)\s+(20\d\d)\b/i, (m) => [m[1], m[1]]],
    [/\b(20\d\d)\b/, (m) => [m[1], m[1]]],
  ];
  for (const [re, f] of T) {
    const m = q.match(re);
    if (m) { const [a, b] = f(m).map(clampY); out.from = Math.min(a, b); out.to = Math.max(a, b); q = q.replace(m[0], " "); break; }
  }
  if (/\b(last|past) (few|\d+) years\b/i.test(q)) { out.from = out.from ?? 2019; out.to = out.to ?? Y1; q = q.replace(/\b(last|past) (few|\d+) years\b/i, " "); }

  // ---- change intent (semantic gain) ----
  if (CHANGE.test(q)) { out.change = true; q = q.replace(CHANGE, " "); }
  CHANGE.lastIndex = 0;

  // ---- place ----
  const pm = q.match(/\b(?:in|near|around|at|across|within|of)\s+([a-z][a-z .'-]{2,})$/i);
  if (pm) {
    const name = pm[1].trim();
    const st = matchState(name), site = matchSite(name);
    if (st) out.place = { type: "state", name: st };
    else if (site) out.place = { type: "site", name: site.name, site };
    else out.place = { type: "geo", name: name.replace(/\b\w/g, (c) => c.toUpperCase()) };
    q = q.replace(pm[0], " ");
  }

  // ---- concept ----
  let c = q.replace(FILLER, " ").replace(/\s+/g, " ").trim();
  c = c.replace(/^(a|an|of|with|for)\s+/i, "").replace(/\s+(of|in|with|and)$/i, "").trim();

  if (!out.place && c) {
    // the whole remaining text may itself be a place ("Tehri", "Hyderabad")
    const st = matchState(c), site = matchSite(c);
    if (st) { out.place = { type: "state", name: st }; c = ""; }
    else if (site && !out.change) { out.place = { type: "site", name: site.name, site }; c = ""; }
  }
  out.concept = c;
  if (!c && out.place) out.mode = "place";
  else if (out.change) out.mode = "sgr";
  if (out.mode === "sgr") { out.from = out.from ?? null; out.to = out.to ?? null; }
  return out;
}

// Heuristic: a single capitalised word or two with no concept words is probably a place name to geocode.
export function looksLikePlace(raw) {
  return /^[A-Z][\w'.-]*( [A-Z][\w'.-]*){0,3}(,.*)?$/.test(raw.trim()) && raw.trim().split(" ").length <= 4;
}
