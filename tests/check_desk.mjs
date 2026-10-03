// Is the card desk's data complete and does every claim point at a source?
//   node tests/check_desk.mjs
import { readFileSync } from "node:fs";
import {
  ACCOUNT_FEE, CODES, PLAYBOOK_OF, PLAYBOOKS, RATINGS, SOURCES, SYSTEMS, THEMES,
} from "../docs/caxton/data.js";

const intents = JSON.parse(readFileSync(new URL("../data/categories.json", import.meta.url)));
const results = [];
const check = (name, ok, detail = "") => results.push([ok ? "PASS" : "FAIL", name, detail]);

const unmapped = intents.filter((i) => !PLAYBOOK_OF[i]);
check("every one of the 77 intents has a playbook", unmapped.length === 0, unmapped.join(", "));
const missing = Object.values(PLAYBOOK_OF).filter((p) => !PLAYBOOKS[p]);
check("every mapped playbook exists", missing.length === 0, missing.join(", "));
const extra = Object.keys(PLAYBOOK_OF).filter((i) => !intents.includes(i));
check("no playbook mapped to a made-up intent", extra.length === 0, extra.join(", "));

const badFacts = Object.entries(PLAYBOOKS).flatMap(([id, p]) =>
  p.facts.filter(([, src]) => !SOURCES[src]).map(() => id));
check("every fact cites a known source", badFacts.length === 0, badFacts.join(", "));
const badSystems = Object.entries(PLAYBOOKS).flatMap(([id, p]) =>
  p.where.filter(([sys]) => !SYSTEMS[sys]).map(() => id));
check("every step names a known system", badSystems.length === 0, badSystems.join(", "));
check("every playbook has a reply starter", Object.values(PLAYBOOKS).every((p) => p.reply && p.reply.length > 30));

const dupes = CODES.map((c) => c.code).filter((c, i, all) => all.indexOf(c) !== i);
check("codes are unique", dupes.length === 0, dupes.join(", "));
check("every code cites a known source", CODES.every((c) => SOURCES[c.src]));
check("every theme points at a real playbook and sources",
  THEMES.every((t) => PLAYBOOKS[t.playbook] && t.sources.every((s) => SOURCES[s])));
check("every rating cites a known source", RATINGS.every((r) => SOURCES[r.src]));

for (const yes of ["Why have I been charged £2 a month?", "what is this dormancy fee", "I keep getting an inactivity charge",
  "there's an account management fee on my card"]) {
  check(`fee keywords catch: "${yes}"`, ACCOUNT_FEE.test(yes));
}
for (const no of ["my card was declined", "I was charged twice at a shop", "what is the ATM fee abroad"]) {
  check(`fee keywords ignore: "${no}"`, !ACCOUNT_FEE.test(no));
}

for (const [state, name, detail] of results) console.log(`  ${state}  ${name}${detail ? "  — " + detail : ""}`);
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
