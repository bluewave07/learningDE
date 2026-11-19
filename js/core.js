/* Core: helpers, storage, data index, speech, spaced repetition, daily gate. */
(function () {
  "use strict";
  const App = (window.App = {});

  /* ---------- helpers ---------- */
  App.$ = (s, r) => (r || document).querySelector(s);
  App.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  App.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  App.shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  App.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  App.today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  App.addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  App.fmtTime = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  App.toast = (t) => { const el = App.$("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(App.toast.t); App.toast.t = setTimeout(() => el.classList.remove("show"), 3200); };
  /** speakable form of a headword: strips plural endings, notes and abbreviations */
  App.say = (de) => de.replace(/\(.*?\)/g, "").split(",")[0].replace(/\s*\/.*$/, "").replace(/\betw\./g, "etwas").replace(/\bjdm\./g, "jemandem").replace(/\bjdn\./g, "jemanden").replace(/…/g, "").trim();
  App.wordHtml = (de) => { const m = de.match(/^(der|die|das)\s(.*)$/); return m ? `<span class="art ${m[1]}">${m[1]}</span> ${App.esc(m[2])}` : App.esc(de); };
  App.hl = (text, word) => {
    const e = App.esc(text), key = App.clozeKey(text, word);
    if (!key) return e;
    const ke = App.esc(key), i = e.indexOf(ke);
    return i < 0 ? e : e.slice(0, i) + "<mark>" + ke + "</mark>" + e.slice(i + ke.length);
  };
  /** finds the form of the headword that appears in the example sentence (for highlighting and cloze) */
  App.clozeKey = (sentence, de) => {
    const lemma = App.say(de).replace(/^(der|die|das|sich|den)\s+/i, "").replace(/\s+(sein|haben|werden)$/, "");
    if (!lemma) return null;
    if (sentence.includes(lemma)) return lemma;
    const lc = sentence.toLowerCase(), ll = lemma.toLowerCase();
    let i = lc.indexOf(ll);
    if (i >= 0) return sentence.substr(i, lemma.length);
    const words = sentence.split(/[\s.,!?;:„“"()]+/).filter(Boolean);
    const main = ll.split(/\s+/).sort((a, b) => b.length - a.length)[0];
    if (!main || main.length < 4) return null;
    const stem = main.slice(0, Math.max(4, Math.min(main.length - 2, 7)));
    const hit = words.find((w) => w.toLowerCase().includes(stem));
    return hit || null;
  };

  /* ---------- storage ---------- */
  const KEY = "learningde-v2";
  const blank = () => ({ words: {}, shadow: {}, days: {}, scores: {}, notebook: [], prefs: {} });
  App.load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.words) return Object.assign(blank(), s); } catch (e) { /* storage unavailable */ } return blank(); };
  App.S = App.load();
  App.save = () => { try { localStorage.setItem(KEY, JSON.stringify(App.S)); } catch (e) { /* ignore */ } };
  App.prefs = () => Object.assign({ lang: "de", rate: 0.9, newPerDay: 10, shadowMin: 5, newShadowPerDay: 15, blind: false }, App.S.prefs);
  App.setPref = (k, v) => { App.S.prefs[k] = v; App.save(); };
  App.day = (iso) => { iso = iso || App.today(); if (!App.S.days[iso]) App.S.days[iso] = { sh: 0, newW: 0, rev: 0, shN: 0 }; return App.S.days[iso]; };

  /* ---------- data index ---------- */
  App.THEMES = (window.THEMES || []).map((t) => {
    const seen = new Set();
    const words = [];
    t.w.forEach((a) => {
      let id = t.id + ":" + App.say(a[0]).toLowerCase();
      while (seen.has(id)) id += "+";
      seen.add(id);
      words.push({ id, theme: t.id, de: a[0], en: a[1], tr: a[2], xd: a[3], xe: a[4] });
    });
    const lessons = [];
    for (let i = 0; i < words.length; i += 20) lessons.push(words.slice(i, i + 20));
    return Object.assign({}, t, { words, lessons });
  });
  App.W = App.THEMES.flatMap((t) => t.words);
  App.byId = Object.fromEntries(App.W.map((w) => [w.id, w]));
  App.themeById = Object.fromEntries(App.THEMES.map((t) => [t.id, t]));
  App.SH = (window.SHADOWING || []).flatMap((g, gi) => g.s.map((s, i) => ({ id: "sh:" + gi + ":" + i, group: gi, gt: g.t, de: s[0], en: s[1] })));
  App.STORIES = window.STORIES || [];
  App.CONVS = window.CONVERSATIONS || [];
  App.TEXTS = window.SHADOW_TEXTS || [];

  /* lookup for tap-to-translate in stories */
  const strip = (s) => s.toLowerCase().replace(/^(der|die|das|sich|den|etwas|einen|eine|ein)\s+/g, "");
  App.lex = new Map();
  App.W.forEach((w) => {
    const k = strip(App.say(w.de));
    if (!k.includes(" ") && !App.lex.has(k)) App.lex.set(k, w);
  });
  /** maps a word form in running text to a headword; lowercase forms never match nouns */
  App.lookup = (token) => {
    const t = token.toLowerCase().replace(/[^a-zäöüß-]/g, "");
    if (t.length < 3) return null;
    const lowerToken = token[0] === token[0].toLowerCase();
    const ok = (w) => w && !(lowerToken && /^(der|die|das)\s/.test(w.de));
    if (ok(App.lex.get(t))) return App.lex.get(t);
    const tries = [t.replace(/(en|er|es|em|e|n|s|t|st|te|ten)$/, ""), t.replace(/(ungen)$/, "ung")];
    if (/^ge.+t$/.test(t)) tries.push(t.slice(2, -1));
    for (const x of tries) {
      if (x.length < 3) continue;
      if (ok(App.lex.get(x))) return App.lex.get(x);
      for (const suf of ["en", "n", "e"]) if (ok(App.lex.get(x + suf))) return App.lex.get(x + suf);
    }
    return null;
  };

  /* ---------- spaced repetition (Leitner boxes) ---------- */
  const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
  App.srs = {
    get: (bucket, id) => App.S[bucket][id],
    isDue: (bucket, id) => { const it = App.S[bucket][id]; return !!it && it.due <= App.today(); },
    isNew: (bucket, id) => !App.S[bucket][id],
    /** grade: 0 = again, 1 = hard, 2 = good, 3 = easy */
    grade(bucket, id, g) {
      const it = App.S[bucket][id] || { b: 0, due: App.today(), n: 0 };
      if (g === 0) it.b = 0; else if (g === 1) it.b = Math.max(1, it.b); else if (g === 2) it.b = Math.min(6, it.b + 1); else it.b = Math.min(6, it.b + 2);
      it.due = App.addDays(App.today(), g === 0 ? 0 : INTERVALS[it.b]);
      it.n = (it.n || 0) + 1; it.last = App.today();
      App.S[bucket][id] = it; App.save();
      return it;
    },
    level: (bucket, id) => (App.S[bucket][id] ? App.S[bucket][id].b : -1),
    mastered: (bucket, id) => { const it = App.S[bucket][id]; return !!it && it.b >= 3; }
  };
  App.dueWords = () => App.W.filter((w) => App.srs.isDue("words", w.id));
  App.newWords = (n) => App.W.filter((w) => App.srs.isNew("words", w.id)).slice(0, n);

  /* ---------- daily shadowing gate ---------- */
  App.IDLE_SEC = 30; // shadowing clock pauses after this many seconds without interaction
  App.ROUND_MIN = 15; // a finished round with at least this many sentences also completes the daily goal
  const dayDone = (d) => !!d && (d.sh >= App.prefs().shadowMin * 60 || !!d.round);
  App.gate = {
    need: () => App.prefs().shadowMin * 60,
    done: () => dayDone(App.day()),
    left: () => (App.gate.done() ? 0 : Math.max(0, App.gate.need() - App.day().sh)),
    completeRound() { const d = App.day(); const before = App.gate.done(); d.round = true; App.save(); document.dispatchEvent(new CustomEvent("gate-change")); if (!before) document.dispatchEvent(new CustomEvent("gate-open")); },
    add(sec) { const d = App.day(); const before = d.sh < App.gate.need(); d.sh += sec; App.save(); document.dispatchEvent(new CustomEvent("gate-change")); if (before && d.sh >= App.gate.need()) document.dispatchEvent(new CustomEvent("gate-open")); }
  };
  App.streak = () => {
    let n = 0, d = App.today();
    if (!dayDone(App.S.days[d])) d = App.addDays(d, -1);
    while (dayDone(App.S.days[d])) { n++; d = App.addDays(d, -1); }
    return n;
  };

  /* ---------- speech synthesis ---------- */
  const TTS = "speechSynthesis" in window;
  let voices = [];
  const loadVoices = () => { if (TTS) voices = speechSynthesis.getVoices(); };
  if (TTS) { loadVoices(); speechSynthesis.onvoiceschanged = () => { loadVoices(); document.dispatchEvent(new CustomEvent("voices")); }; }
  App.voicesFor = (lang) => {
    const p = lang === "de" ? "de" : "en";
    const vs = voices.filter((v) => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith(p));
    const good = vs.filter((v) => /google|natural|neural|premium|enhanced|online/i.test(v.name));
    return good.length ? good.concat(vs.filter((v) => !good.includes(v))) : vs;
  };
  /* Robust wrapper around speechSynthesis:
     - browsers swallow an utterance spoken right after cancel(), so we wait briefly first
     - Chrome can get stuck "paused" and garbage-collects utterances (onend never fires) – keep a reference
     - speaking without a prior user gesture is blocked ("not-allowed") – reported via App.ttsBlocked */
  const live = new Set();
  App.ttsBlocked = false;
  App.speak = (text, lang, opts) => {
    opts = opts || {};
    if (!TTS) { App.toast("Dein Browser unterstützt keine Sprachausgabe."); return Promise.resolve({ ok: false }); }
    if (!voices.length) loadVoices();
    const busy = speechSynthesis.speaking || speechSynthesis.pending;
    return App.wait(busy ? 120 : 0).then(() => new Promise((res) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "de" ? "de-DE" : "en-US";
      const vs = App.voicesFor(lang);
      if (vs.length) u.voice = vs[(opts.voice || 0) % Math.min(vs.length, 3)];
      const rate = opts.rate || App.prefs().rate;
      u.rate = rate;
      let done = false, started = false;
      const fin = (ok) => { if (done) return; done = true; live.delete(u); clearTimeout(guard); res({ ok }); };
      u.onstart = () => { started = true; App.ttsBlocked = false; };
      u.onend = () => fin(true);
      u.onerror = (e) => {
        if (e && e.error === "not-allowed") { App.ttsBlocked = true; document.dispatchEvent(new CustomEvent("tts-blocked")); }
        fin(e && (e.error === "interrupted" || e.error === "canceled"));
      };
      const guard = setTimeout(() => fin(started), Math.max(4000, (text.length * 120) / rate + 2000));
      live.add(u);
      try { speechSynthesis.resume(); } catch (e) { /* ignore */ }
      speechSynthesis.speak(u);
    }));
  };
  let tok = 0;
  App.rec = null;
  App.stopAll = () => { tok++; if (TTS) speechSynthesis.cancel(); if (App.rec) { try { App.rec.abort(); } catch (e) { /* ignore */ } App.rec = null; } };
  /* only wait after cancel() if something was actually playing – an extra delay loses the
     user gesture on iOS, where the first utterance must start inside the tap handler */
  App.sayNow = (text, lang, opts) => {
    const busy = TTS && (speechSynthesis.speaking || speechSynthesis.pending);
    App.stopAll();
    return busy ? App.wait(60).then(() => App.speak(text, lang, opts)) : App.speak(text, lang, opts);
  };
  /* iOS / Android unlock: speak a silent utterance synchronously on the first touch or click.
     After that, later (asynchronous) playback is allowed. */
  let unlocked = false;
  App.unlockTTS = () => {
    if (unlocked || !TTS) return;
    unlocked = true;
    try {
      loadVoices();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0; u.lang = "de-DE";
      speechSynthesis.resume();
      speechSynthesis.speak(u);
    } catch (e) { unlocked = false; }
  };
  ["touchend", "pointerup", "click", "keydown"].forEach((ev) => document.addEventListener(ev, App.unlockTTS, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") App.stopAll(); });
  /** plays [[text, lang, voice, pauseMs], ...] in order; onStep(i) highlights, -1 at the end */
  App.seq = async (items, onStep) => {
    App.stopAll(); const my = tok;
    for (let i = 0; i < items.length; i++) {
      if (my !== tok) return;
      onStep && onStep(i);
      await App.speak(items[i][0], items[i][1], { voice: items[i][2], rate: items[i][4] });
      if (my !== tok) return;
      await App.wait(items[i][3] || 300);
    }
    onStep && onStep(-1);
  };

  /* ---------- speech recognition ---------- */
  App.SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  App.listen = (lang, opts) => {
    opts = opts || {};
    return new Promise((res, rej) => {
      if (!App.SR) { rej("unsupported"); return; }
      const r = new App.SR();
      r.lang = lang === "de" ? "de-DE" : "en-US"; r.interimResults = true; r.continuous = !!opts.continuous; r.maxAlternatives = 1;
      let fin = "", failed = false;
      r.onresult = (e) => { let inter = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t + " "; else inter += t; } opts.onInterim && opts.onInterim((fin + inter).trim()); };
      r.onerror = (e) => { failed = true; rej(e.error); };
      r.onend = () => { if (App.rec === r) App.rec = null; if (!failed) res(fin.trim()); };
      App.rec = r; r.start();
    });
  };
  App.micErr = (e) => ({
    unsupported: "Spracherkennung wird hier nicht unterstützt. Bitte Chrome oder Edge verwenden – oder „Nachgesprochen ✓“ klicken.",
    "not-allowed": "Mikrofon blockiert. Erlaube den Zugriff oder starte die App über http://localhost (siehe README).",
    "no-speech": "Nichts gehört – bitte nochmal versuchen.",
    network: "Die Spracherkennung in Chrome braucht eine Internetverbindung.",
    "audio-capture": "Kein Mikrofon gefunden.",
    aborted: "Abgebrochen."
  })[e] || "Fehler: " + e;

  /* ---------- comparing spoken / typed text ---------- */
  App.norm = (s) => s.toLowerCase().replace(/[-–—/]/g, " ").replace(/[.,!?;:"„“”'()…%]/g, " ").split(/\s+/).filter(Boolean);
  App.align = (expected, got) => {
    const a = App.norm(expected), b = App.norm(got), n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const hit = new Array(n).fill(false); let i = 0, j = 0;
    while (i < n && j < m) { if (a[i] === b[j]) { hit[i] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
    const hits = hit.filter(Boolean).length, extra = Math.max(0, m - hits);
    return { words: a, hit, score: n ? Math.max(0, Math.round((100 * (hits - extra * 0.25)) / n)) : 0 };
  };
  App.alignHtml = (expected, got, label) => {
    const r = App.align(expected, got);
    const msg = r.score >= 90 ? "Ausgezeichnet!" : r.score >= 70 ? "Gut – fast perfekt." : r.score >= 40 ? "Nicht schlecht, nochmal versuchen." : "Hör nochmal genau hin.";
    return `<div class="score"><div class="bar ${r.score >= 70 ? "ok" : ""}"><span style="width:${r.score}%"></span></div><b>${r.score}%</b><span class="muted">${msg}</span></div>
      <div class="heard">${label}: „${App.esc(got || "—")}“</div>
      <div class="words">${r.words.map((w, i) => `<span class="${r.hit[i] ? "h" : "m"}">${App.esc(w)}</span>`).join(" ")}</div>`;
  };
})();
