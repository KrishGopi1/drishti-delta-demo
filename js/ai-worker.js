// Runs CLIP (ViT-B/32, 8-bit) fully in the browser with transformers.js + ONNX Runtime Web.
// Text and image go into the same 512-d space, so text->image and image->image search use one index.
import {
  env, AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor, CLIPVisionModelWithProjection, RawImage,
} from "../vendor/transformers/transformers.min.js";

env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = new URL("../vendor/transformers/", import.meta.url).href;

const MODEL = "Xenova/clip-vit-base-patch32";
let tok, textModel, proc, visModel;

const norm = (arr) => {
  let s = 0; for (const v of arr) s += v * v; s = Math.sqrt(s) || 1;
  const o = new Float32Array(arr.length); for (let i = 0; i < arr.length; i++) o[i] = arr[i] / s; return o;
};
const rows = (t) => { const [n, d] = t.dims; const out = []; for (let i = 0; i < n; i++) out.push(norm(t.data.subarray(i * d, (i + 1) * d))); return out; };

self.onmessage = async (e) => {
  const { id, type } = e.data;
  try {
    if (type === "init") {
      const progress_callback = (p) => self.postMessage({ type: "progress", p });
      const opt = { dtype: "q8", device: "wasm", progress_callback };
      [tok, proc] = await Promise.all([AutoTokenizer.from_pretrained(MODEL, { progress_callback }), AutoProcessor.from_pretrained(MODEL, { progress_callback })]);
      [textModel, visModel] = await Promise.all([
        CLIPTextModelWithProjection.from_pretrained(MODEL, opt),
        CLIPVisionModelWithProjection.from_pretrained(MODEL, opt),
      ]);
      self.postMessage({ id, ok: true, result: { model: MODEL, threads: env.backends.onnx.wasm.numThreads ?? null, isolated: self.crossOriginIsolated } });
    } else if (type === "text") {
      const inputs = tok(e.data.texts, { padding: true, truncation: true });
      const { text_embeds } = await textModel(inputs);
      self.postMessage({ id, ok: true, result: rows(text_embeds) });
    } else if (type === "image") {
      const out = [];
      for (const im of e.data.images) {
        const raw = new RawImage(new Uint8ClampedArray(im.buf), im.w, im.h, 4).rgb();
        const inputs = await proc(raw);
        const { image_embeds } = await visModel(inputs);
        out.push(rows(image_embeds)[0]);
      }
      self.postMessage({ id, ok: true, result: out });
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
