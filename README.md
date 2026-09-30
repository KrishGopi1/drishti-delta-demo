# DRISHTI-Δ web demo

Semantic search and multi-temporal change analysis of Sentinel-2 imagery, running entirely in the browser.
Team NOVA · Smart India Hackathon 2026 · PS 26227.

## What it does

| Feature | How it works here |
|---|---|
| Globe home | MapLibre GL globe with Sentinel-2 cloudless 2025, slowly rotating |
| Text search | CLIP ViT-B/32 (8-bit ONNX) in a Web Worker ranks every archive tile by meaning |
| Query parser | Splits the question into concept, place (state / place name) and time chips |
| Semantic change search (SGR) | gain = similarity(after, query) − similarity(before, query) |
| Image to image search | Upload or drop any image; same CLIP space as text |
| Place search + fly-to | Catalogue match first, then OpenStreetMap Nominatim |
| Before / after slider | Two synced maps, drag the orange handle; years 2016 to 2025 |
| Time-lapse | Cross-fades the 10 annual mosaics |
| Change detection (PCM-lite) | Peer-normalised scores → conformal p-values → CUSUM onset → Fisher → BH-FDR → persistence ≥ 3 |
| Explain | Zero-shot CLIP labels for the before and after year |
| Discover | k-means on CLIP embeddings, clusters named by closest description |
| Review + export | Confirm / reject / follow-up with notes, audit log, GeoJSON export with provenance |
| How it works | Journey, architecture, PCM / HEK / SGR, Beta evidence, impact, stack, references |

## Run locally

```bash
node dev-server.js      # then open http://localhost:5173
```

No install or build step. Node 18+ only needed for the local server.

## Deploy to Vercel

Option A, CLI (fastest):

```bash
npm i -g vercel
vercel          # answer the prompts; framework "Other", no build command, output directory "."
vercel --prod
```

Option B, GitHub: push this folder to a repository, then on vercel.com choose **Add New → Project → Import**.
Framework preset **Other**, leave Build Command empty, Output Directory `.` (root). Deploy.

`vercel.json` does two things:

1. Rewrites `/eox/*` to `https://tiles.maps.eox.at/*`, so imagery is same-origin and the browser can read its pixels for CLIP and change detection.
2. Sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`, which lets the AI use several CPU threads.

## First load

The CLIP model (about 150 MB) downloads from huggingface.co on the first visit and is cached by the browser.
The archive index (57 tiles) is then embedded and cached in IndexedDB. Later visits are instant.
If the model cannot be downloaded, search falls back to keywords (clearly labelled) and everything else keeps working.

## URL options

* `?q=solar park in Rajasthan` runs a query on load
* `?mock=1` UI test mode with fake embeddings (no model download)
* `?direct=1` loads tiles straight from EOX (no proxy; pixel features may be blocked by CORS)

## Honest scope

* Retrieval uses general CLIP in the browser; the production design uses RemoteCLIP on a server with Qdrant.
* Imagery is one cloud-free composite per year (EOX Sentinel-2 cloudless), which stands in for HEK's season-free key.
* PCM-lite uses RGB greenness (VARI) and brightness; the Beta pipeline uses NDVI / NDBI on every Sentinel-2 L2A date.
* The Jewar evidence card (80 tiles × 14 dates, 1 candidate, confidence 0.56) comes from the Beta pipeline run.

## Attribution and licences

Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data), s2maps.eu.
2016 mosaic CC BY 4.0; 2017 onward CC BY-NC-SA 4.0 (non-commercial demonstration).
Labels and geocoding © OpenStreetMap contributors. MapLibre GL JS (BSD-3), transformers.js (Apache-2.0), ONNX Runtime Web (MIT).
