#!/usr/bin/env node
/**
 * Validates all learning content in data/.
 *  - schema of every word, reading, dialogue, story and conversation
 *  - duplicate headwords across themes (homonyms with a different meaning are allowed)
 *  - at least 3,000 words and exactly 300 shadowing sentences
 *  - every data file is referenced from index.html
 * Exit code 1 on any error.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);

const sandbox = { window: {} };
vm.createContext(sandbox);
const files = readdirSync(dataDir).filter((f) => f.endsWith(".js")).sort();
for (const f of files) {
  try { vm.runInContext(readFileSync(join(dataDir, f), "utf8"), sandbox, { filename: f }); }
  catch (e) { err(`${f}: cannot be parsed – ${e.message}`); }
}
const { THEMES = [], SHADOWING = [], SHADOW_TEXTS = [], STORIES = [], CONVERSATIONS = [] } = sandbox.window;

const isStr = (s) => typeof s === "string" && s.trim().length > 0;
const checkQuestions = (where, qs) => {
  (qs || []).forEach((q, i) => {
    if (!Array.isArray(q) || q.length !== 4 || !isStr(q[0]) || !isStr(q[1]) || !Array.isArray(q[2]) || q[2].length < 2) err(`${where} question ${i + 1}: expected [de, en, options[], answerIndex]`);
    else if (!Number.isInteger(q[3]) || q[3] < 0 || q[3] >= q[2].length) err(`${where} question ${i + 1}: answer index out of range`);
  });
};
const checkSentences = (where, s, n = 2) => {
  if (!Array.isArray(s) || !s.length) return err(`${where}: no sentences`);
  s.forEach((x, i) => { if (!Array.isArray(x) || x.length < n || x.slice(0, n).some((v) => !isStr(v))) err(`${where} line ${i + 1}: malformed`); });
};

/* themes & words */
const norm = (s) => s.toLowerCase().replace(/^(der|die|das|den)\s+/, "").replace(/\(.*?\)/g, "").split(",")[0].replace(/\s*\/.*$/, "").trim();
const seen = new Map();
const ids = new Set();
let total = 0;
for (const t of THEMES) {
  if (!isStr(t.id) || !isStr(t.t) || !isStr(t.te) || !["gen", "it"].includes(t.g)) err(`theme ${t.id}: missing id/t/te or invalid g`);
  if (ids.has(t.id)) err(`theme id ${t.id} is used twice`);
  ids.add(t.id);
  (t.w || []).forEach((w, i) => {
    total++;
    const where = `${t.id} word ${i + 1} (${w && w[0]})`;
    if (!Array.isArray(w) || w.length !== 5) return err(`${where}: expected [de, en, tr, exampleDe, exampleEn]`);
    if (!isStr(w[0]) || !isStr(w[1]) || !isStr(w[3]) || !isStr(w[4]) || typeof w[2] !== "string") err(`${where}: empty field`);
    if (/^(der|die|das)\s+\S+.*\s(der|die|das)$/.test(w[0])) warnings.push(`${where}: article appears twice`);
    const k = norm(w[0]);
    if (seen.has(k)) {
      const prev = seen.get(k);
      if (prev.en === w[1]) err(`${where}: duplicate of ${prev.theme}`);
      else warnings.push(`${where}: homonym of ${prev.theme} (${prev.en} / ${w[1]})`);
    } else seen.set(k, { theme: t.id, en: w[1] });
  });
  if (t.r) { checkSentences(`${t.id} reading`, t.r.s); checkQuestions(`${t.id} reading`, t.r.q); }
  if (t.d) { checkSentences(`${t.id} dialogue`, t.d.l, 3); checkQuestions(`${t.id} dialogue`, t.d.q); }
}
if (total < 3000) err(`only ${total} words – the programme promises at least 3,000`);

/* shadowing */
const shCount = SHADOWING.reduce((a, g) => a + (g.s || []).length, 0);
SHADOWING.forEach((g, i) => { if (!isStr(g.t) || !isStr(g.te)) err(`shadowing group ${i + 1}: missing title`); checkSentences(`shadowing ${g.t}`, g.s); });
if (shCount !== 300) err(`shadowing has ${shCount} sentences, expected 300`);

/* paragraph shadowing */
SHADOW_TEXTS.forEach((x, i) => {
  if (!isStr(x.t) || !isStr(x.te)) err(`shadowing text ${i + 1}: missing title`);
  if (!THEMES.some((t) => t.id === x.theme)) err(`shadowing text ${i + 1}: unknown theme "${x.theme}"`);
  checkSentences(`shadowing text ${x.t}`, x.s);
  if ((x.s || []).length < 4) err(`shadowing text ${x.t}: a paragraph needs at least 4 sentences`);
});

/* stories & conversations */
STORIES.forEach((s, i) => { if (!isStr(s.t)) err(`story ${i + 1}: missing title`); checkSentences(`story ${i + 1}`, s.s); checkQuestions(`story ${i + 1}`, s.q); });
CONVERSATIONS.forEach((c, i) => {
  if (!isStr(c.t) || !isStr(c.ctx)) err(`conversation ${i + 1}: missing title or context`);
  checkSentences(`conversation ${i + 1}`, c.l, 3);
  if (!(c.l || []).some((x) => x[0] === "Sie")) err(`conversation ${i + 1}: no learner ("Sie") lines`);
});

/* index.html references */
const html = readFileSync(join(root, "index.html"), "utf8");
for (const f of files) if (!html.includes(`data/${f}`)) err(`index.html does not load data/${f}`);

/* report */
const gen = THEMES.filter((t) => t.g === "gen").reduce((a, t) => a + t.w.length, 0);
console.log(`Themes:        ${THEMES.length}`);
console.log(`Words:         ${total} (${gen} general, ${total - gen} IT)`);
console.log(`Shadowing:     ${shCount} sentences in ${SHADOWING.length} groups`);
console.log(`Paragraphs:    ${SHADOW_TEXTS.length} shadowing texts`);
console.log(`Stories:       ${STORIES.length}`);
console.log(`Conversations: ${CONVERSATIONS.length}`);
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  ` + warnings.join("\n  "));
if (errors.length) { console.error(`\n✖ ${errors.length} error(s):\n  ` + errors.join("\n  ")); process.exit(1); }
console.log("\n✔ All content is valid.");
