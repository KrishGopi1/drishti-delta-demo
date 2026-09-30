# DRISHTI-Δ demo guide

Team NOVA · SIH 2026 · PS 26227 · web demo v0.9

## 1. Deploy to Vercel (10 minutes, once)

**Option A, Vercel CLI (recommended)**

1. Install Node.js 18 or newer.
2. Unzip `drishti-delta-demo.zip` and open a terminal in the folder.
3. Run `npx vercel`. Log in when asked. Answers: set up and deploy **Y**, link to existing project **N**, project name `drishti-delta`, directory `./`, modify settings **N**.
4. Run `npx vercel --prod`. Copy the URL it prints, for example `https://drishti-delta.vercel.app`.

**Option B, GitHub + Vercel website**

1. Create a GitHub repository and upload everything inside the folder (the largest file is 21.6 MB, under GitHub's 25 MB web limit).
2. On vercel.com: **Add New → Project → Import** the repository. Framework preset **Other**, build command empty, output directory `.`. Press **Deploy**.

**Check the deployment**

* Open `https://YOUR-APP/eox/wmts/1.0.0/s2cloudless-2024_3857/default/g/3/3/5.jpg`. You should see a satellite tile. If not, `vercel.json` was not deployed.
* Open the app. The globe should appear and the pill at the top right should move from "AI model %" to "Indexing" to **"AI ready · 57 tiles"**.
* Put the URL in slide 6 of the deck (the "‹add link›" box).

Local test without deploying: `node dev-server.js`, then open `http://localhost:5173`.

## 2. Prepare the laptop (30 minutes before)

1. Chrome, latest version. Charger in. Close other tabs. Browser zoom 100%. Screen 1920×1080 or 1366×768.
2. Connect to venue Wi-Fi and keep a phone hotspot ready.
3. Open the app. Wait for **AI ready · 57 tiles** (1 to 3 minutes the first time; the model is about 150 MB and is cached afterwards).
4. **Search** tab → scroll down → **Pre-embed all 10 years**. Wait for "done" (2 to 5 minutes). This makes the gain curves and change queries instant.
5. Rehearse every step in section 4 once. This also caches the imagery. Write down which place ranks #1 for each query and adjust the script lines marked ⟨ ⟩.
6. **Review** tab → **Reset demo queue**. Click the DRISHTI-Δ logo to return to the globe.
7. Press F11 for full screen. Do not clear browsing data (it holds the model and embeddings).

## 3. Images to download for image search

| File name | How to get it | Expected look-alikes |
|---|---|---|
| `kurnool_solar_2025.png` (main) | App → **Search** tab → "Places to save as query images" → **Kurnool Ultra Mega Solar Park → Fly there** → wait 3 s → **Save view** (download arrow, right toolbar) | Bhadla, Pavagada |
| `kempegowda_airport_2025.png` (backup) | Same list → **Kempegowda Airport → Fly there → Save view** | Mopa, Navi Mumbai, Jewar |
| `bhitarkanika_2025.png` (backup) | Same list → **Bhitarkanika mangroves → Fly there → Save view** | Sundarbans |
| `jewar_2024-10-30.png` (real Beta chip) | `https://YOUR-APP/samples/jewar_2024-10-30.png` → right click → Save image | Jewar and the other airports |

Save them on the desktop and rename them as above. None of the first three places is in the index, so the search has to find look-alikes, which is the point. Save them while the map shows 2025 (click the logo first; home always resets to 2025).

## 4. Run sheet and script

Speaking time: about 520 words at 130 words per minute, roughly 4 minutes, plus about 2 to 3 minutes of clicking and waiting. Intro and outro are not counted.

**Intro (not counted).** *"Good morning. We are Team NOVA with DRISHTI-Δ for problem statement 26227. Δ means change, and finding change is what we do."*

| # | Press / do | Show | Say |
|---|---|---|---|
| 1 | Nothing. Globe on screen. | Rotating Earth, coloured dots over India. | "This is ten years of Sentinel-2 imagery over India, one cloud-free mosaic per year from 2016 to 2025. Today, finding something in an archive like this means knowing the tile, the date and the cloud cover, then downloading scenes and comparing them by eye. DRISHTI-Δ lets an analyst simply ask." |
| 2 | Click the search bar, type `solar park in Rajasthan`, press **Enter**. | The panel slides in; the four chips; the flight to Rajasthan; ranked cards; the map lands on result #1. | "I ask in plain language: solar park in Rajasthan. The parser splits my question into a concept, a place and a time, shown as these chips. The place filter keeps Rajasthan, then a CLIP vision-language model, running inside this browser, compares the meaning of my words with every archive tile. No keywords, no labels. The best match is ⟨Bhadla Solar Park⟩, and the map flies straight to it." |
| 3 | In the panel search bar type `new airport built between 2018 and 2024`, **Enter**. | Mode chip "semantic change (SGR)", gain bars, flight to #1. | "Now a harder question. The word *new* switches on our Semantic-Gain Retrieval. For each place we measure how much it looks like an airport in 2024, minus how much it did in 2018. An old airport scores nothing, because nothing changed. Places that *became* airports rise to the top, here ⟨Jewar, where Noida International Airport is being built on farmland⟩." |
| 4 | On the Jewar card press **Compare years**. Wait for the automatic sweep, then drag the orange handle slowly left and right. | Before 2019 on the left, After 2025 on the right. | "Left of the handle is 2019, right is 2025. As I drag, farmland turns into runway and terminal. I can choose any two years from these pills." |
| 5 | Press **▶ Time-lapse**. Let it run 2016 to 2025, then press **■ Stop**. | Big year counter, imagery cross-fading. | "Or play all ten years as a time-lapse." |
| 6 | Press **Detect change (PCM)**. When it finishes, point at the heatmap, then at region card 1. | Orange / red heatmap on the After side, numbered orange box, region card with onset year, area, q-value, persistence and the small chart. | "Seeing change is easy. Trusting it is the hard part, because monsoon, haze and processing make every year look a little different. So Peer-Conformal Monitoring judges each of 1,024 cells against its peers on the same date, and whatever changes for everyone cancels out. Each cell gets a conformal p-value, CUSUM finds the onset year, a Benjamini-Hochberg gate controls false discoveries, and a change must persist for three later years before it is released. This card gives the type, onset year, area, q-value and persistence." |
| 7 | Scroll the panel down to the green **Beta pipeline evidence** card. | Three Jewar chips and the evidence table. | "This is not only a browser demo. Our Beta pipeline ran on real Sentinel-2 Level-2A data: 80 tiles, 14 dates, and exactly one candidate passed every threshold. This Jewar tile: clearance, onset between October 2023 and May 2024, NDVI down from 0.211 to 0.161." |
| 8 | Scroll up to **What the AI sees**. Then in **Semantic gain over the years** press **Plot** (concept "airport"). | Before / after labels; the gain curve with the biggest jump. | "The model also explains in words what it sees before and after. This curve shows, year by year, how airport-like the place looks. The biggest jump marks when construction took off." |
| 9 | Click the **image button** in the search bar, choose `kurnool_solar_2025.png`. | Query image at the top, ranked look-alikes, flight to #1. | "Search does not need words. This is Kurnool solar park, which is not in our index. Same model, same vector space: the closest places are ⟨Bhadla and Pavagada⟩. An analyst can drop any tile and find look-alikes across the whole archive." |
| 10 | Click the **Discover** tab. | Named clusters with thumbnails. | "Discover groups the archive by appearance with no labels at all, and names each group automatically. It shows what an archive contains before anyone asks." |
| 11 | Click **Change** tab (Jewar reopens), press **Detect change**, press **Send to review** on region 1. Click the **Review** tab, type a note such as `verified with site photos`, press **Confirm**, then **Export GeoJSON with provenance**. | Review card turns green; the audit log line; the file downloads. | "Every flag goes to an analyst. I confirm this one with a note, and the decision is logged with a time stamp. The export is GeoJSON that opens straight in QGIS, and every feature carries its provenance: imagery, years, method, thresholds, model and the decision." |
| 12 | Click **How it works**. Show the **Journey** tab, then **Architecture**. | Nine chevrons; the on-premise architecture. | "Everything you saw follows our nine-step journey: ask, parse, retrieve, explore, compare, detect, explain, review and export. In production the same design runs on-premise with RemoteCLIP, Qdrant and PostGIS, air-gap ready, with no imagery or licence cost." |

**Outro (not counted).** *"DRISHTI-Δ: ask the archive, see what changed, and know why you can trust it. Thank you."*

**Shorter variant (3 minutes):** do steps 1, 2, 3, 4, 6, 9 and 11.

## 5. If something goes wrong

| Problem | What to do and say |
|---|---|
| Pill shows **AI unavailable** | Switch to the hotspot and press **Retry** in the panel. Search still answers with a clearly labelled keyword fallback; the slider, time-lapse, change detection, review and export do not need the AI. |
| Step 6 says "No region passed every gate" | Say: *"It sees differences, but they have not persisted for three years, so PCM holds them back. That is exactly how we control false alarms."* Then zoom out one step with **−** and press **Detect** again, or set **After** to 2025. |
| First search is slow | The model is still warming up. Say *"the model runs locally in the browser, so the first query warms it up"*. The warm-up in section 2 prevents this. |
| Imagery missing or black | Network. Wait a few seconds or switch to the hotspot. Check the `/eox` test URL from section 1. |
| A different place ranks #1 | Name what is on screen. CLIP ranks by meaning, so a close neighbour (another solar park or airport) is a correct answer too. |
| Lost on the map | Click the DRISHTI-Δ logo (back to the globe) or type the place name. |

## 6. Likely judge questions

* **Is the AI really running?** Yes. CLIP ViT-B/32 runs in the browser via ONNX; the pill shows how many archive tiles were embedded. Open the browser's network tab to see there is no backend.
* **Why annual mosaics?** They are cloud-free by construction and play the role of our HEK season-free key. The production pipeline works on every Level-2A date, as the Beta run did (14 dates).
* **How do you avoid false alarms?** Peers on the same date cancel shared effects, BH-FDR controls the expected share of false discoveries, and persistence requires three later observations.
* **What is not built yet?** RemoteCLIP with Qdrant on the server, HEK fitting on dense time series, and the Sentinel-1, Landsat and Bhuvan adapters. The demo labels each item honestly under *How it works → Stack & sources*.
* **Licensing?** Sentinel-2 cloudless by EOX (CC BY 4.0 for 2016, CC BY-NC-SA 4.0 from 2017), used for a non-commercial demo; production reads Copernicus data directly.
