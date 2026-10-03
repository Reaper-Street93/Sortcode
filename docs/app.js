import { loadModel } from "./model.js";

const QUEUE = {
  security: "Security team",
  disputes: "Disputes team",
  payments: "Payments team",
  account: "Account & compliance",
  self_serve: "Self-serve bot",
};
const APPROACHES = {
  rules: "Keyword rules",
  tfidf: "Classic model",
  gemini_zero: "Gemini, zero-shot",
  gemini_few: "Gemini, few-shot",
  hybrid: "Hybrid",
};
const HUMAN = new Set(["disputes", "payments", "account"]);
const PAGE = 15;

const EXAMPLES = [
  "Help! Someone stole my card!",
  "How long for money transfer to show?",
  "I cannot find my credit card.",
  "What do I do with my card PIN?",
  "Somebody used my card to make a purchase",
  "Is there a fee for topping up by card?",
];

// ── small helpers ────────────────────────────────────────────
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
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const pretty = (intent) => {
  const s = intent.replace(/\?$/, "").replaceAll("_", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// What a routing decision cost, in words. Mirrors sortcode/routing.py.
function outcome(trueQueue, predQueue, cost) {
  if (cost === 0) return { level: "good", icon: "✓", label: "Right" };
  if (trueQueue === "security") return { level: "critical", icon: "✕", label: "Fraud missed" };
  if (HUMAN.has(trueQueue)) {
    return predQueue === "self_serve"
      ? { level: "serious", icon: "!", label: "Real problem → bot" }
      : { level: "warning", icon: "–", label: "Wrong team" };
  }
  if (predQueue === "self_serve") return { level: "warning", icon: "–", label: "Wrong answer" };
  if (predQueue === "security") return { level: "warning", icon: "–", label: "False alarm" };
  return { level: "warning", icon: "–", label: "FAQ to a person" };
}

function outcomeChip(o, cost) {
  return el("span", { class: `outcome ${o.level}` },
    el("span", { class: "dot", "aria-hidden": "true" }, o.icon),
    o.label,
    el("span", { class: "cost" }, cost ? `cost ${cost}` : ""));
}

// ── theme ────────────────────────────────────────────────────
$("theme").addEventListener("click", () => {
  const dark = getComputedStyle(document.documentElement).colorScheme === "dark";
  const next = dark ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
});

// ── try a message ────────────────────────────────────────────
let model = null;

function routeCard(title, dest, detail, extra, recommended = false) {
  return el("div", { class: `route${recommended ? " recommended" : ""}` },
    el("h3", {}, title), el("p", { class: "dest" }, dest), el("p", { class: "detail" }, detail), extra);
}

function recommend(text, rules, m) {
  if (rules.queue === "security" || m.queue === "security") {
    return {
      dest: QUEUE.security,
      detail: m.queue === "security"
        ? "The model flagged it. A person, fast."
        : "The keyword tripwire caught it even though the model didn't. A person, fast.",
    };
  }
  if (!m.sure) {
    return {
      dest: "A person (triage)",
      detail: `The model is only ${pct(m.confidence, 0)} sure, under the ${pct(model.meta.threshold, 0)} bar, so nothing is automated.`,
    };
  }
  if (m.queue === "self_serve") return { dest: QUEUE.self_serve, detail: `Answers with: ${pretty(m.intent)}.` };
  return { dest: QUEUE[m.queue], detail: `A person picks it up as "${pretty(m.intent).toLowerCase()}".` };
}

function renderTry() {
  const text = $("msg").value.trim();
  const routes = $("routes");
  routes.replaceChildren();
  if (!model) {
    routes.append(routeCard("Loading", "Fetching the model…", "About 7 MB, once. It runs on your device."));
    return;
  }
  if (!text) {
    routes.append(routeCard("Waiting", "Type a message", "…or pick an example above to see where each approach sends it."));
    return;
  }
  const rules = model.routeByRules(text);
  const m = model.classify(text);
  const rec = recommend(text, rules, m);

  const conf = el("div", { class: "conf" },
    el("div", { class: "conf-track", title: `Confidence ${pct(m.confidence)}; the bar for automating is ${pct(model.meta.threshold, 0)}` },
      el("div", { class: "conf-fill", style: `width:${(m.confidence * 100).toFixed(1)}%` }),
      el("div", { class: "conf-mark", style: `left:${(model.meta.threshold * 100).toFixed(1)}%` })),
    el("div", { class: "conf-label" },
      `${pct(m.confidence)} sure${m.runnersUp.length ? ` · next: ${pretty(m.runnersUp[0].intent).toLowerCase()} ${pct(m.runnersUp[0].p, 0)}` : ""}`));

  routes.append(
    routeCard("Keyword rules", QUEUE[rules.queue],
      rules.pattern ? `A ${rules.queue.replace("_", "-")} rule matched.` : "No rule matched, so it falls through to the bot."),
    routeCard("Classic model", pretty(m.intent), `→ ${QUEUE[m.queue]}`, conf),
    routeCard("Recommended setup", rec.dest, rec.detail, null, true),
  );
}

let pending;
$("msg").addEventListener("input", () => {
  clearTimeout(pending);
  pending = setTimeout(renderTry, 120);
  for (const c of $("examples").children) c.setAttribute("aria-pressed", "false");
});
for (const ex of EXAMPLES) {
  $("examples").append(el("button", {
    class: "chip", type: "button", "aria-pressed": "false",
    onclick: (e) => {
      $("msg").value = ex;
      for (const c of $("examples").children) c.setAttribute("aria-pressed", String(c === e.currentTarget));
      renderTry();
    },
  }, ex));
}
renderTry();
loadModel("model/").then((m) => { model = m; renderTry(); })
  .catch(() => $("routes").replaceChildren(routeCard("Error", "The model didn't load", "Try refreshing the page.")));

// ── results ──────────────────────────────────────────────────
function renderResults(summary) {
  const rows = Object.entries(summary.approaches);
  const cols = [
    ["Right intent", (a) => a.intent_accuracy, (v) => (v == null ? "—" : pct(v)), "max"],
    ["Right team", (a) => a.queue_accuracy, (v) => pct(v), "max"],
    ["Fraud missed (of 240)", (a) => a.security_missed, (v) => String(v), "min"],
    ["Harm per 1,000", (a) => a.harm_per_1000, (v) => Math.round(v).toLocaleString("en-GB"), "min"],
    ["Cost per 10,000 tickets", (a) => a.cost_per_10k_tickets_usd, (v) => `$${v.toFixed(2)}`, null],
  ];
  const best = cols.map(([, get, , dir]) => {
    if (!dir) return null;
    const vals = rows.map(([, a]) => get(a)).filter((v) => v != null);
    return dir === "max" ? Math.max(...vals) : Math.min(...vals);
  });
  $("results").replaceChildren(
    el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "Approach"), cols.map(([h]) => el("th", { scope: "col" }, h)))),
    el("tbody", {}, rows.map(([key, a]) => el("tr", {},
      el("th", { scope: "row", style: "text-align:left;font-weight:500" }, APPROACHES[key]),
      cols.map(([, get, fmt], i) => {
        const v = get(a);
        return el("td", { class: v != null && v === best[i] ? "best" : "" }, el("span", { class: "num" }, fmt(v)));
      })))),
  );

  // Harm per 1,000: one series, so one hue and no legend; each bar labelled.
  const max = Math.max(...rows.map(([, a]) => a.harm_per_1000));
  const tip = $("tooltip");
  const chart = $("harm-chart");
  const show = (target, a, key) => {
    tip.replaceChildren(
      el("strong", {}, APPROACHES[key]), el("br"),
      `Harm ${Math.round(a.harm_per_1000).toLocaleString("en-GB")} per 1,000 · fraud missed ${a.security_missed} of 240 · right team ${pct(a.queue_accuracy)}`);
    tip.hidden = false;
    const box = target.getBoundingClientRect(), outer = chart.getBoundingClientRect();
    tip.style.left = `${Math.min(box.left - outer.left, outer.width - 270)}px`;
    tip.style.top = `${box.bottom - outer.top + 6}px`;
  };
  $("bars").replaceChildren(...rows.map(([key, a]) => {
    const track = el("div", {
      class: "bar-track", tabindex: "0",
      "aria-label": `${APPROACHES[key]}: harm ${Math.round(a.harm_per_1000)} per 1,000 tickets`,
      onmouseenter: (e) => show(e.currentTarget, a, key), onfocus: (e) => show(e.currentTarget, a, key),
      onmouseleave: () => (tip.hidden = true), onblur: () => (tip.hidden = true),
    },
      el("div", { class: "bar", style: `width:${((a.harm_per_1000 / max) * 85).toFixed(2)}%` }),
      el("span", { class: "bar-value" }, Math.round(a.harm_per_1000).toLocaleString("en-GB")));
    return el("div", { class: "bar-row" }, el("span", { class: "label" }, APPROACHES[key]), track);
  }));
}

// ── explorer ─────────────────────────────────────────────────
const STORIES = {
  all: { label: "All 3,080 messages", note: "", test: () => true },
  rules_fraud: {
    label: "Fraud the keyword rules missed",
    note: "Security tickets the keyword router sent somewhere else. Customers don't write the words the rules were written for.",
    test: (m) => m.queue === "security" && m.by.rules.cost > 0,
    // Clearest first: the ones only the rules got wrong.
    rank: (m) => -othersRight(m, "rules"),
  },
  gemini_question: {
    label: "Gemini answered the question, not the problem",
    note: "Real problems Gemini few-shot sent to the bot. Many are \"how long does it take…\" from someone whose money hasn't arrived.",
    test: (m) => HUMAN.has(m.queue) && m.by.gemini_few.queue === "self_serve",
    rank: (m) => -(m.by.tfidf.cost === 0) - (m.by.gemini_few.intent === "transfer_timing"),
  },
  all_wrong: {
    label: "Every approach got it wrong",
    note: "Some of these are hard; some are labels you could argue with.",
    test: (m) => Object.values(m.by).every((b) => b.cost > 0),
  },
  handoffs: {
    label: "Hybrid: the unsure tickets passed to Gemini",
    note: "Where the classic model was under the confidence bar. Every approach struggles here, which is why the write-up sends these to a person instead.",
    test: (m) => m.by.hybrid.answered_by === "gemini",
  },
};

// How many approaches other than `skip` got this message right.
function othersRight(m, skip) {
  return Object.entries(m.by).filter(([k, b]) => k !== skip && b.cost === 0).length;
}

let messages = [];
let shown = PAGE;

function filtered() {
  const story = STORIES[$("story").value];
  const queue = $("queue").value;
  const q = $("search").value.trim().toLowerCase();
  const list = messages.filter((m) =>
    story.test(m) && (queue === "any" || m.queue === queue) && (!q || m.text.toLowerCase().includes(q)));
  return story.rank ? list.sort((a, b) => story.rank(a) - story.rank(b)) : list;
}

function ticket(m) {
  return el("article", { class: "ticket" },
    el("blockquote", {}, m.text),
    el("p", { class: "truth" }, "Really: ", el("b", {}, pretty(m.intent)), ` · ${QUEUE[m.queue]}`),
    el("div", { class: "verdicts" }, Object.entries(APPROACHES).flatMap(([key, name]) => {
      const b = m.by[key];
      const via = key === "hybrid" ? ` (via ${b.answered_by === "gemini" ? "Gemini" : "classic model"})` : "";
      return [
        el("div", { class: "who" }, name + via),
        el("div", { class: "what" }, QUEUE[b.queue], b.intent ? el("small", {}, ` · ${pretty(b.intent).toLowerCase()}`) : null),
        el("div", { class: "outcome-cell" }, outcomeChip(outcome(m.queue, b.queue, b.cost), b.cost)),
      ];
    })));
}

function renderTickets() {
  const list = filtered();
  $("story-note").textContent = STORIES[$("story").value].note;
  $("count").textContent = `${list.length.toLocaleString("en-GB")} message${list.length === 1 ? "" : "s"}`;
  $("tickets").replaceChildren(...list.slice(0, shown).map(ticket));
  $("more").hidden = list.length <= shown;
}

function setupExplorer() {
  for (const [key, s] of Object.entries(STORIES)) $("story").append(el("option", { value: key }, s.label));
  $("story").value = "rules_fraud";
  $("queue").append(el("option", { value: "any" }, "Any team"),
    ...Object.entries(QUEUE).map(([k, v]) => el("option", { value: k }, `Really: ${v}`)));
  const reset = () => { shown = PAGE; renderTickets(); };
  $("story").addEventListener("change", reset);
  $("queue").addEventListener("change", reset);
  $("search").addEventListener("input", reset);
  $("more").addEventListener("click", () => { shown += PAGE; renderTickets(); });
}

// Most costly mistakes first, so the interesting ones surface.
const totalCost = (m) => Object.values(m.by).reduce((s, b) => s + b.cost, 0);

Promise.all([
  fetch("data/summary.json").then((r) => r.json()),
  fetch("data/messages.json").then((r) => r.json()),
]).then(([summary, msgs]) => {
  renderResults(summary);
  messages = msgs.sort((a, b) => totalCost(b) - totalCost(a));
  setupExplorer();
  renderTickets();
});
