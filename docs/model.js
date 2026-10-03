// The benchmarked TF-IDF model and keyword rules, running in the browser.
//
// This mirrors scikit-learn step for step: lowercase, word 1-2 grams over
// tokens of 2+ word characters, char_wb 2-5 grams, sublinear tf, idf, L2
// normalisation per vectoriser, then a multinomial logistic regression.
// tests/check_demo_model.mjs runs it on every test message and checks it
// against Python, so the page can't quietly drift from the numbers.

const WORD_TOKEN = /[\p{L}\p{N}_]{2,}/gu;

function wordNgrams(text) {
  const tokens = text.toLowerCase().match(WORD_TOKEN) ?? [];
  const grams = [...tokens];
  for (let i = 0; i + 1 < tokens.length; i++) grams.push(tokens[i] + " " + tokens[i + 1]);
  return grams;
}

function charWbNgrams(text, minN = 2, maxN = 5) {
  const grams = [];
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  for (const word of words) {
    const w = Array.from(" " + word + " "); // code points, like Python strings
    for (let n = minN; n <= maxN; n++) {
      let offset = 0;
      grams.push(w.slice(offset, offset + n).join(""));
      while (offset + n < w.length) {
        offset += 1;
        grams.push(w.slice(offset, offset + n).join(""));
      }
      if (offset === 0) break; // a word shorter than n is counted once
    }
  }
  return grams;
}

// Sparse tf-idf vector: Map of feature index -> weight, L2-normalised.
function tfidf(grams, vocab, idf, offset) {
  const counts = new Map();
  for (const g of grams) {
    const i = vocab.get(g);
    if (i !== undefined) counts.set(i, (counts.get(i) ?? 0) + 1);
  }
  const vec = new Map();
  let norm = 0;
  for (const [i, c] of counts) {
    const v = (1 + Math.log(c)) * idf[offset + i];
    vec.set(offset + i, v);
    norm += v * v;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) for (const [i, v] of vec) vec.set(i, v / norm);
  return vec;
}

export async function loadModel(base = "model/") {
  const [meta, idfBuf, wBuf] = await Promise.all([
    fetch(base + "meta.json").then((r) => r.json()),
    fetch(base + "idf.bin").then((r) => r.arrayBuffer()),
    fetch(base + "weights.bin").then((r) => r.arrayBuffer()),
  ]);
  return fromParts(meta, idfBuf, wBuf);
}

export function fromParts(meta, idfBuf, wBuf) {
  const wordVocab = new Map(meta.word_vocab.map((t, i) => [t, i]));
  const charVocab = new Map(meta.char_vocab.map((t, i) => [t, i]));
  const idf = new Float32Array(idfBuf);
  const weights = new Int16Array(wBuf);
  const nFeatures = meta.word_vocab.length + meta.char_vocab.length;
  const rules = meta.rules.map(({ queue, patterns }) => ({
    queue,
    patterns: patterns.map((p) => new RegExp(p, "i")),
  }));

  function classify(text) {
    const x = new Map([
      ...tfidf(wordNgrams(text), wordVocab, idf, 0),
      ...tfidf(charWbNgrams(text), charVocab, idf, meta.word_vocab.length),
    ]);
    const scores = meta.classes.map((_, c) => {
      let s = meta.intercept[c];
      const row = c * nFeatures;
      for (const [i, v] of x) s += v * weights[row + i] * meta.scale[c];
      return s;
    });
    const top = Math.max(...scores);
    const exp = scores.map((s) => Math.exp(s - top));
    const total = exp.reduce((a, b) => a + b, 0);
    const ranked = meta.classes
      .map((intent, c) => ({ intent, p: exp[c] / total }))
      .sort((a, b) => b.p - a.p);
    const best = ranked[0];
    return {
      intent: best.intent,
      queue: meta.queue_of[best.intent],
      confidence: best.p,
      sure: best.p >= meta.threshold,
      runnersUp: ranked.slice(1, 3),
    };
  }

  function routeByRules(text) {
    for (const { queue, patterns } of rules) {
      const hit = patterns.find((p) => p.test(text));
      if (hit) return { queue, pattern: hit.source };
    }
    return { queue: "self_serve", pattern: null };
  }

  return { classify, routeByRules, meta };
}
