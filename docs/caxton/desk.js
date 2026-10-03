import { loadModel } from "../model.js";
import {
  ACCOUNT_FEE, CODES, PLAYBOOK_OF, PLAYBOOKS, RATINGS, RETRIEVED, SOURCES, SYSTEMS, THEMES,
} from "./data.js";

const TEAM = {
  security: "Security team",
  disputes: "Disputes team",
  payments: "Payments team",
  account: "Account & compliance",
  self_serve: "Self-serve answer",
};

const EXAMPLES = [
  "My card got declined at a cash machine in Lisbon",
  "Why have I been charged £2 a month?",
  "My top-up hasn't gone through",
  "There's a payment in Spain I didn't make",
  "My PIN is blocked after three wrong tries",
  "A hotel payment is still pending on my card",
];

// ── helpers ──────────────────────────────────────────────────
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c);
  return node;
}
const $ = (id) => document.getElementById(id);
const pct = (x) => `${Math.round(x * 100)}%`;
const pretty = (intent) => {
  const s = intent.replace(/\?$/, "").replaceAll("_", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const sourceLink = (key) => el("a", { href: SOURCES[key].url, target: "_blank", rel: "noopener" }, SOURCES[key].name);

$("theme").addEventListener("click", () => {
  const dark = getComputedStyle(document.documentElement).colorScheme === "dark";
  const next = dark ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
});

// ── triage ───────────────────────────────────────────────────
let model = null;

// The same policy as the benchmark write-up: anything that looks like fraud
// goes to a person fast, anything the model is unsure of goes to a person,
// and only confident self-serve answers are automated.
function decide(text, rules, m) {
  if (ACCOUNT_FEE.test(text)) {
    return { playbook: "account_fee", team: TEAM.self_serve,
      why: "Matched the account-fee keywords. A person handles it if they ask for a refund." };
  }
  const playbook = PLAYBOOK_OF[m.intent];
  if (rules.queue === "security" || m.queue === "security") {
    return { playbook, team: TEAM.security,
      why: m.queue === "security" ? "The model flagged it. A person, fast." : "The keyword tripwire caught it. A person, fast." };
  }
  if (!m.sure) {
    const alternatives = [...new Set(m.runnersUp.map((r) => PLAYBOOK_OF[r.intent]))].filter((p) => p !== playbook);
    return { playbook, team: "A person (triage)", unsure: true, alternatives,
      why: `The model is only ${pct(m.confidence)} sure, so a person reads it first. Below is its best guess.` };
  }
  return { playbook, team: TEAM[m.queue],
    why: m.queue === "self_serve" ? "A standard answer covers it." : "Needs someone to look at the account." };
}

function playbookView(id, { unsure = false, alternatives = [] } = {}) {
  const p = PLAYBOOKS[id];
  const swap = (next) => (e) => {
    const others = [id, ...alternatives].filter((x) => x !== next);
    e.currentTarget.closest(".verdict-body").replaceWith(playbookView(next, { unsure, alternatives: others }));
  };
  let status;
  const copy = el("button", {
    class: "btn", type: "button",
    onclick: async () => {
      try { await navigator.clipboard.writeText(reply.value); status.textContent = "Copied"; }
      catch { reply.select(); status.textContent = "Press Ctrl/Cmd+C to copy"; }
    },
  }, "Copy reply");
  const reply = el("textarea", { class: "reply", "aria-label": "Reply starter" });
  reply.value = p.reply;
  status = el("span", {}, "Fill in the [brackets] before sending.");

  return el("div", { class: "verdict-body" },
    el("div", {},
      el("p", { class: "label" }, unsure ? "Where to look (best guess)" : "Where to look"),
      el("p", { class: "playbook-title" }, p.title),
      alternatives.length ? el("p", { class: "related alts" }, "Could also be: ",
        alternatives.map((a) => el("button", { class: "chip", type: "button", onclick: swap(a) }, PLAYBOOKS[a].title))) : null,
      el("ol", { class: "steps" }, p.where.map(([sys, text]) =>
        el("li", {}, el("span", {}, el("span", { class: "sys" }, SYSTEMS[sys]), text)))),
      p.caution ? el("p", { class: "caution" }, p.caution) : null,
      p.related ? el("p", { class: "related" }, "Related: ", el("a", { href: p.related[1] }, p.related[0])) : null),
    el("div", {},
      el("p", { class: "label" }, "Reply starter"),
      reply,
      el("div", { class: "reply-actions" }, copy, status),
      p.facts.length ? el("p", { class: "label" }, "Facts you can quote") : null,
      p.facts.length ? el("ul", { class: "facts" }, p.facts.map(([text, src]) =>
        el("li", {}, text, " ", el("a", { href: SOURCES[src].url, target: "_blank", rel: "noopener" }, "source")))) : null),
  );
}

function renderVerdict() {
  const box = $("verdict");
  const text = $("msg").value.trim();
  if (!model) { box.replaceChildren(el("div", { class: "route" }, el("p", { class: "label" }, "Loading"), el("p", { class: "detail" }, "Fetching the model (about 7 MB, once). It runs on your device."))); return; }
  if (!text) { box.replaceChildren(el("div", { class: "route" }, el("p", { class: "label" }, "Waiting"), el("p", { class: "detail" }, "Type a message, or pick an example, to see the team, where to look and a reply to start from."))); return; }

  const rules = model.routeByRules(text);
  const m = model.classify(text);
  const d = decide(text, rules, m);

  const intentBox = ACCOUNT_FEE.test(text)
    ? el("div", {}, el("p", { class: "label" }, "Ticket type"), el("p", { class: "big" }, "Account management fee"),
        el("p", { class: "why" }, "Caught by keywords: BANKING77 has no ticket type for this fee."))
    : el("div", {}, el("p", { class: "label" }, "Ticket type"), el("p", { class: "big" }, pretty(m.intent)),
        el("div", { class: "conf" },
          el("div", { class: "conf-track" },
            el("div", { class: "conf-fill", style: `width:${(m.confidence * 100).toFixed(1)}%` }),
            el("div", { class: "conf-mark", style: `left:${(model.meta.threshold * 100).toFixed(1)}%` })),
          el("div", { class: "conf-label" }, `${pct(m.confidence)} sure · the bar for automating is ${pct(model.meta.threshold)}`)));

  box.replaceChildren(
    el("div", { class: "verdict-head" },
      el("div", { class: "team" }, el("p", { class: "label" }, "Goes to"), el("p", { class: "big" }, d.team), el("p", { class: "why" }, d.why)),
      intentBox),
    playbookView(d.playbook, { unsure: d.unsure, alternatives: d.alternatives }),
  );
}

function showPlaybook(id, note) {
  $("msg").value = "";
  for (const c of $("examples").children) c.setAttribute("aria-pressed", "false");
  $("verdict").replaceChildren(
    el("div", { class: "verdict-head" },
      el("div", { class: "team" }, el("p", { class: "label" }, "Playbook"), el("p", { class: "big" }, PLAYBOOKS[id].title), el("p", { class: "why" }, note)),
      el("div", {}, el("p", { class: "label" }, "Try it"), el("p", { class: "why" }, "Type a customer message above to see the model route it."))),
    playbookView(id));
  $("triage-h").scrollIntoView({ behavior: "smooth", block: "start" });
}

let pending;
$("msg").addEventListener("input", () => {
  clearTimeout(pending);
  pending = setTimeout(renderVerdict, 120);
  for (const c of $("examples").children) c.setAttribute("aria-pressed", "false");
});
for (const ex of EXAMPLES) {
  $("examples").append(el("button", {
    class: "chip", type: "button", "aria-pressed": "false",
    onclick: (e) => {
      $("msg").value = ex;
      for (const c of $("examples").children) c.setAttribute("aria-pressed", String(c === e.currentTarget));
      renderVerdict();
    },
  }, ex));
}
renderVerdict();
loadModel("../model/").then((m) => { model = m; renderVerdict(); })
  .catch(() => $("verdict").replaceChildren(el("div", { class: "route" }, el("p", { class: "detail" }, "The model didn't load. Try refreshing."))));

// ── code lookup ──────────────────────────────────────────────
function renderCode() {
  const q = $("code").value.trim().toUpperCase();
  const box = $("code-result");
  if (!q) { box.replaceChildren(el("p", { class: "code-empty" }, "Type a code, or pick one below.")); return; }
  const c = CODES.find((x) => x.code === q);
  if (!c) { box.replaceChildren(el("p", { class: "code-empty" }, `No entry for "${q}" here. The full lists are in the sources.`)); return; }
  box.replaceChildren(el("dl", { class: "code-result" },
    el("dt", {}, "Seen on"), el("dd", {}, c.where === "Top-up" ? "A top-up from the customer's bank card" : "The customer's card"),
    el("dt", {}, "Means"), el("dd", {}, el("strong", {}, c.meaning)),
    c.merchant ? [el("dt", {}, "Merchant told"), el("dd", {}, c.merchant)] : null,
    el("dt", {}, "Tell the customer"), el("dd", {}, c.tell),
    el("dt", {}, "Source"), el("dd", {}, sourceLink(c.src))));
}
$("code").addEventListener("input", renderCode);
$("code-groups").append(...[["Caxton card (Thredd)", "Caxton card"], ["Top-up (Checkout.com)", "Top-up"]].map(([title, where]) =>
  el("div", {}, el("h3", {}, title), el("div", { class: "examples" },
    CODES.filter((c) => c.where === where).map((c) => el("button", {
      class: "chip code-chip", type: "button", title: c.meaning,
      onclick: () => { $("code").value = c.code; renderCode(); },
    }, c.code))))));
renderCode();

// ── voice of customer ────────────────────────────────────────
$("ratings").append(...RATINGS.map((r) => el("a", { class: "rating", href: SOURCES[r.src].url, target: "_blank", rel: "noopener", style: "text-decoration:none;color:inherit" },
  el("div", {}, el("span", { class: "score" }, r.score), el("span", { class: "of" }, " / 5")),
  el("div", { class: "where" }, r.where + (r.detail ? ` · ${r.detail}` : "")))));
$("themes").append(...THEMES.map((t) => el("article", { class: "theme" },
  el("span", { class: `outcome ${t.tone === "praise" ? "good" : "serious"}` },
    el("span", { class: "dot", "aria-hidden": "true" }, t.tone === "praise" ? "✓" : "!"), t.tone === "praise" ? "Praise" : "Complaint"),
  el("h3", {}, t.title),
  el("p", {}, t.text),
  el("div", { class: "meta" },
    el("span", {}, t.sources.flatMap((s, i) => [i ? " · " : "", el("a", { href: SOURCES[s].url, target: "_blank", rel: "noopener" }, SOURCES[s].name.replace(/^Caxton (Currency Card )?on /, ""))])),
    el("button", { class: "btn", type: "button", onclick: () => showPlaybook(t.playbook, `How the desk handles: ${t.title.toLowerCase()}.`) }, "See the playbook")))));

// ── sources ──────────────────────────────────────────────────
$("retrieved").textContent = `All retrieved ${RETRIEVED}. Ratings are as shown on that date.`;
$("source-list").append(...Object.keys(SOURCES).map((k) => el("li", {}, sourceLink(k))));
