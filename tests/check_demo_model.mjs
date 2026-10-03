// Does the browser model give the same answers as the Python one?
//
// Runs docs/model.js on all 3,080 test messages and compares each result with
// the saved Python predictions in docs/data/messages.json. Run with:
//   node tests/check_demo_model.mjs
import { readFileSync } from "node:fs";
import { fromParts } from "../docs/model.js";

const docs = new URL("../docs/", import.meta.url);
const read = (p) => readFileSync(new URL(p, docs));
const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

const model = fromParts(
  JSON.parse(read("model/meta.json")),
  toArrayBuffer(read("model/idf.bin")),
  toArrayBuffer(read("model/weights.bin")),
);
const messages = JSON.parse(read("data/messages.json"));

let intentMismatch = 0, confWorst = 0, sideFlips = 0, rulesMismatch = 0;
const threshold = model.meta.threshold;
for (const m of messages) {
  const js = model.classify(m.text);
  const py = m.by.tfidf;
  if (js.intent !== py.intent) intentMismatch++;
  confWorst = Math.max(confWorst, Math.abs(js.confidence - py.confidence));
  if ((js.confidence >= threshold) !== (py.confidence >= threshold)) sideFlips++;
  if (model.routeByRules(m.text).queue !== m.by.rules.queue) rulesMismatch++;
}

const ok = intentMismatch === 0 && rulesMismatch === 0 && sideFlips === 0 && confWorst < 0.001;
console.log(`${messages.length} messages`);
console.log(`  TF-IDF intent mismatches:      ${intentMismatch}`);
console.log(`  worst confidence difference:   ${confWorst.toFixed(5)}  (Python saved to 4 dp)`);
console.log(`  sure/unsure flips at ${threshold}:  ${sideFlips}`);
console.log(`  keyword-rule queue mismatches: ${rulesMismatch}`);
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
