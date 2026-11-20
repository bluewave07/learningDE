#!/usr/bin/env node
/**
 * Lists every German text the app can speak and writes audio-manifest.json: [{ id, text }].
 * The ids come from js/audio-id.js, exactly like in the browser.
 *   node scripts/audio-manifest.mjs [out.json]
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of readdirSync(join(root, "data")).sort()) vm.runInContext(readFileSync(join(root, "data", f), "utf8"), ctx);
vm.runInContext(readFileSync(join(root, "js", "audio-id.js"), "utf8"), ctx);
const W = ctx.window, audioId = W.audioId;

// must match App.say() in js/core.js
const say = (de) => de.replace(/\(.*?\)/g, "").split(",")[0].replace(/\s*\/.*$/, "").replace(/\betw\./g, "etwas").replace(/\bjdm\./g, "jemandem").replace(/\bjdn\./g, "jemanden").replace(/…/g, "").trim();

const texts = new Set();
const add = (t) => { if (t && t.trim()) texts.add(t.normalize("NFC").trim()); };
for (const t of W.THEMES) {
  for (const w of t.w) { add(say(w[0])); add(w[3]); }
  if (t.r) t.r.s.forEach((s) => add(s[0]));
  if (t.d) t.d.l.forEach((l) => add(l[1]));
}
(W.SHADOWING || []).forEach((g) => g.s.forEach((s) => add(s[0])));
(W.SHADOW_TEXTS || []).forEach((x) => x.s.forEach((s) => add(s[0])));
(W.STORIES || []).forEach((x) => x.s.forEach((s) => add(s[0])));
(W.CONVERSATIONS || []).forEach((x) => x.l.forEach((l) => add(l[1])));
add("Hallo! Wenn du mich hörst, funktioniert die Sprachausgabe.");

const list = [...texts].map((text) => ({ id: audioId(text), text })).sort((a, b) => a.id.localeCompare(b.id));
const ids = new Set();
for (const x of list) { if (ids.has(x.id)) { console.error("id collision:", x.id); process.exit(1); } ids.add(x.id); }
const out = process.argv[2] || join(root, "audio-manifest.json");
writeFileSync(out, JSON.stringify(list, null, 0));
console.log(`${list.length} German clips, ${list.reduce((a, x) => a + x.text.length, 0)} characters → ${out}`);
