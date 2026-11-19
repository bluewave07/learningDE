/* Reusable UI components: quiz, test generator, flashcards, shadowing player, speaking & dictation lists, tap-to-translate text. */
(function () {
  "use strict";
  const A = window.App, { $, $$, esc, shuffle } = A;

  /* ---------- quiz engine ---------- */
  A.runQuiz = (el, make, opts) => {
    opts = opts || {};
    let qs, i, score;
    const start = () => { qs = make(); i = 0; score = 0; show(); };
    function show() {
      if (i >= qs.length) return finish();
      const q = qs[i], ord = shuffle(q.options.map((_, k) => k));
      el.innerHTML = `<div class="quiz"><div class="bar"><span style="width:${(100 * i) / qs.length}%"></span></div>
        <div class="qmeta">Frage ${i + 1} / ${qs.length} · ${score} richtig</div>
        ${q.audio ? `<button class="btn big" data-a>🔊 Anhören · Listen</button>` : ""}
        <div class="qprompt">${q.prompt}</div>${q.sub ? `<div class="qsub">${q.sub}</div>` : ""}
        <div class="opts">${ord.map((k) => `<button class="opt" data-k="${k}">${esc(q.options[k])}</button>`).join("")}</div><div class="qfoot"></div></div>`;
      if (q.audio) { const a = () => A.sayNow(q.audio[0], q.audio[1]); el.querySelector("[data-a]").onclick = a; setTimeout(a, 250); }
      $$(".opt", el).forEach((b) => (b.onclick = () => {
        const k = +b.dataset.k, right = k === q.answer;
        $$(".opt", el).forEach((o) => { o.disabled = true; if (+o.dataset.k === q.answer) o.classList.add("ok"); });
        if (right) score++; else b.classList.add("bad");
        if (q.wid) A.srs.grade("words", q.wid, right ? 2 : 0);
        const f = el.querySelector(".qfoot");
        f.innerHTML = `<span class="${right ? "okt" : "badt"}">${right ? "Richtig! · Correct" : "Leider falsch · Not quite"}</span>${q.after ? `<div class="after">${q.after}</div>` : ""}
          <button class="btn primary" data-n>${i + 1 < qs.length ? "Weiter →" : "Ergebnis anzeigen"}</button>`;
        const n = f.querySelector("[data-n]"); n.onclick = () => { i++; show(); }; n.focus();
      }));
    }
    function finish() {
      const pct = Math.round((100 * score) / qs.length);
      if (opts.key) { A.S.scores[opts.key] = Math.max(A.S.scores[opts.key] || 0, pct); A.save(); }
      const msg = pct >= 90 ? "Hervorragend!" : pct >= 70 ? "Gut gemacht! Fehler landen automatisch in der Wiederholung." : "Wiederhole die Wörter und versuch es erneut.";
      el.innerHTML = `<div class="result"><div class="ring" style="--p:${pct}">${pct}%</div><p><b>${score} / ${qs.length}</b> richtig · correct</p><p class="muted">${msg}</p><button class="btn primary" data-r>↻ Nochmal · Retry</button></div>`;
      el.querySelector("[data-r]").onclick = start;
      opts.onDone && opts.onDone(pct);
    }
    start();
  };
  A.qsFrom = (arr) => () => arr.map((q) => ({ prompt: esc(q[0]), sub: esc(q[1]), options: q[2], answer: q[3] }));

  /** vocabulary test: meaning, reverse, listening, cloze and English-sentence questions */
  A.makeTest = (words, pool, n) => shuffle(words).slice(0, n).map((w, i) => {
    let others = shuffle(pool.filter((x) => x.id !== w.id && x.theme === w.theme));
    if (others.length < 3) others = shuffle(pool.filter((x) => x.id !== w.id));
    const d = others.slice(0, 3);
    const after = `<b>${A.wordHtml(w.de)}</b> = ${esc(w.en)}${w.tr ? ` <span class="trb">TR</span>${esc(w.tr)}` : ""}<br><i>${esc(w.xd)}</i><br><span class="muted">${esc(w.xe)}</span>`;
    const base = { answer: 0, wid: w.id, after };
    let t = i % 5;
    const key = A.clozeKey(w.xd, w.de);
    const dKeys = d.map((x) => A.clozeKey(x.xd, x.de));
    if (t === 3 && (!key || dKeys.some((k) => !k || k === key))) t = 0;
    if (t === 0) return Object.assign(base, { prompt: `Was bedeutet <b>${A.wordHtml(w.de)}</b>?`, sub: "What does it mean?", options: [w.en, ...d.map((x) => x.en)] });
    if (t === 1) return Object.assign(base, { prompt: `Wie heißt <b>${esc(w.en)}</b> auf Deutsch?`, sub: "Choose the German word.", options: [w.de, ...d.map((x) => x.de)] });
    if (t === 2) return Object.assign(base, { prompt: "Hör zu: Was bedeutet das Wort?", sub: "Listen (no text) and choose the meaning.", audio: [A.say(w.de), "de"], options: [w.en, ...d.map((x) => x.en)] });
    if (t === 3) return Object.assign(base, { prompt: esc(w.xd).replace(esc(key), "<mark>_____</mark>"), sub: esc(w.xe), options: [key, ...dKeys] });
    return Object.assign(base, { prompt: "Listen: Which German sentence means the same?", sub: "Hör den englischen Satz und wähle die deutsche Übersetzung.", audio: [w.xe, "en"], options: [w.xd, ...d.map((x) => x.xd)] });
  });

  /* ---------- flashcards with SRS grading ---------- */
  A.flash = (el, words, opts) => {
    opts = opts || {};
    let dir = A.prefs().lang === "en" ? "en" : "de", queue = words.slice(), done = 0, flipped = false;
    const total = words.length;
    const front = (w) => (dir === "de" ? A.wordHtml(w.de) : esc(w.en));
    const back = (w) => (dir === "de" ? esc(w.en) : A.wordHtml(w.de));
    const sayFront = (w) => A.sayNow(dir === "de" ? A.say(w.de) : w.en, dir);
    const sayBack = (w) => A.sayNow(dir === "de" ? w.en : A.say(w.de), dir === "de" ? "en" : "de");
    function draw() {
      if (!queue.length) {
        window.onkeydown = null;
        el.innerHTML = `<div class="result"><div class="ring" style="--p:100">✓</div><p><b>Alle ${total} Karten geschafft!</b> · All cards done!</p>${opts.onDoneHtml || ""}</div>`;
        opts.onDone && opts.onDone(el);
        return;
      }
      const w = queue[0], lvl = A.srs.level("words", w.id);
      el.innerHTML = `<div class="fwrap"><div class="toolbar"><div class="seg"><button data-d="de" class="${dir === "de" ? "on" : ""}">DE → EN</button><button data-d="en" class="${dir === "en" ? "on" : ""}">EN → DE</button></div>
        <span class="muted">${done} / ${total} · ${queue.length} übrig</span>${lvl >= 0 ? `<span class="lvl l${lvl}">Stufe ${lvl}</span>` : `<span class="lvl">neu</span>`}</div>
        <div class="fcard ${flipped ? "flip" : ""}" id="fc"><div class="ff">${front(w)}</div><button class="chip" data-s="f">🔊</button>
        <div class="muted" style="font-size:13px">${flipped ? "" : "Klicken oder Leertaste zum Umdrehen · click or space to flip"}</div>
        <div class="fb"><div class="fbm">${back(w)}</div>${w.tr ? `<div class="wtr"><span class="trb">TR</span>${esc(w.tr)}</div>` : ""}
        <div class="wex" style="text-align:left"><span class="xd">${A.hl(w.xd, w.de)}</span><span class="xe">${esc(w.xe)}</span></div>
        <div class="wbtns"><button class="chip" data-s="b">🔊 ${dir === "de" ? "EN" : "DE"}</button><button class="chip" data-s="xd">🔊 Satz</button><button class="chip" data-s="xe">🔊 Sentence</button></div></div></div>
        <div class="fbtns"><button class="btn" data-g="0" ${flipped ? "" : "disabled"}>↻ Nochmal<small>again · 1</small></button><button class="btn" data-g="2" ${flipped ? "" : "disabled"}>✓ Gut<small>good · 2</small></button><button class="btn primary" data-g="3" ${flipped ? "" : "disabled"}>★ Leicht<small style="color:inherit">easy · 3</small></button></div></div>`;
      const fl = () => { if (!flipped) { flipped = true; draw(); sayBack(w); } };
      el.querySelector("#fc").onclick = (e) => { if (!e.target.closest("[data-s]")) fl(); };
      $$("[data-s]", el).forEach((b) => (b.onclick = () => { const s = b.dataset.s; if (s === "f") sayFront(w); if (s === "b") sayBack(w); if (s === "xd") A.sayNow(w.xd, "de"); if (s === "xe") A.sayNow(w.xe, "en"); }));
      $$("[data-d]", el).forEach((b) => (b.onclick = () => { dir = b.dataset.d; flipped = false; draw(); sayFront(queue[0]); }));
      const grade = (g) => {
        if (!flipped) return;
        const wasNew = A.srs.isNew("words", w.id);
        A.srs.grade("words", w.id, g);
        const d = A.day(); if (wasNew) d.newW++; else d.rev++; A.save();
        queue.shift(); if (g === 0) queue.push(w); else done++;
        flipped = false; draw(); if (queue.length) setTimeout(() => sayFront(queue[0]), 150);
        opts.onGrade && opts.onGrade();
      };
      $$("[data-g]", el).forEach((b) => (b.onclick = () => grade(+b.dataset.g)));
      window.onkeydown = (e) => { if (e.target.tagName === "INPUT") return; if (e.code === "Space") { e.preventDefault(); fl(); } else if (e.key === "1") grade(0); else if (e.key === "2") grade(2); else if (e.key === "3") grade(3); };
    }
    draw();
    if (queue.length) setTimeout(() => sayFront(queue[0]), 200);
  };

  /* ---------- shadowing player ----------
     items: [{id, de, en}]
     opts.gate   – credit practice time towards the daily goal
     opts.bucket – SRS bucket for the self-ratings ("shadow")
     opts.refill – returns more items when the queue runs out
     Time model: nothing runs in the background. For each sentence the time between the first
     playback and the rating is credited – but only if the learner repeated the sentence
     (🎤 or ✓) and rated it, and at most a cap that depends on the sentence length.
     Doing nothing therefore never fills the daily goal. */
  A.shadowPlayer = (el, items, opts) => {
    opts = opts || {};
    const p = A.prefs();
    let queue = items.slice(), cur = null, spoken = false, heard = false, startedAt = 0, count = 0, banked = 0, uiTimer = null;
    const capFor = (s) => Math.round(Math.min(40, Math.max(12, (s.length * 0.075) / p.rate * 3 + 8)));
    const pending = () => (startedAt ? Math.min(capFor(cur.de), (Date.now() - startedAt) / 1000) : 0);

    function updateRing() {
      if (!opts.gate || !document.body.contains(el)) { clearInterval(uiTimer); return; }
      const ring = $("#sh-ring", el); if (!ring) return;
      const need = A.gate.need(), have = Math.min(need, A.day().sh);
      ring.style.setProperty("--p", Math.round((100 * have) / need));
      ring.textContent = A.gate.done() ? "✓" : A.fmtTime(A.gate.left());
      const st = $("#sh-state", el);
      if (A.gate.done()) st.textContent = "Tagesziel erreicht – alles ist freigeschaltet. Weiter so!";
      else if (!startedAt) st.textContent = "Die Zeit zählt erst, wenn du einen Satz anhörst, nachsprichst und bewertest.";
      else st.textContent = `Dieser Satz: +${Math.floor(pending())} s (max. ${capFor(cur.de)} s) – wird beim Bewerten gutgeschrieben.`;
    }

    function intro() {
      el.innerHTML = `<div class="shadow-card">
        ${opts.gate ? `<div class="timer-ring" id="sh-ring">--:--</div><div class="muted" id="sh-state" style="font-size:13px"></div>` : ""}
        <h2 style="margin:18px 0 6px">Bereit?</h2>
        <p class="muted" style="max-width:520px;margin:0 auto">So geht's: <b>1.</b> Satz anhören · <b>2.</b> laut nachsprechen (🎤 oder ✓) · <b>3.</b> bewerten.<br>Gezählt wird nur die Zeit, in der du wirklich übst.</p>
        <div class="shadow-btns"><button class="btn primary big" id="sh-start">▶ Shadowing starten</button></div>
        <p class="hint">${queue.length} Sätze bereit · Tasten: Leertaste = anhören, M = Mikrofon, 1/2/3 = bewerten</p></div>`;
      updateRing();
      $("#sh-start", el).onclick = () => { A.unlockTTS(); next(); };
    }

    function next() {
      if (!queue.length && opts.refill) queue = opts.refill();
      if (!queue.length) { window.onkeydown = null; if (opts.onFinish) opts.onFinish(el); else el.innerHTML = `<div class="result"><div class="ring" style="--p:100">✓</div><p><b>Alle Sätze geübt!</b></p></div>`; return; }
      cur = queue.shift(); spoken = false; heard = false; startedAt = 0;
      draw(); play();
    }

    async function play(slow) {
      const playBtn = $("[data-a=play]", el); playBtn && (playBtn.disabled = true);
      const r = await A.sayNow(cur.de, "de", slow ? { rate: Math.max(0.55, p.rate - 0.3) } : null);
      if (!document.body.contains(el)) return;
      playBtn && (playBtn.disabled = false);
      const msg = $(".tts-msg", el);
      if (r && r.ok) {
        if (!startedAt) startedAt = Date.now();
        heard = true; msg && (msg.innerHTML = "");
        const sEl = $(".shadow-sent", el); sEl && sEl.classList.remove("blur");
      } else if (msg) {
        msg.innerHTML = A.ttsBlocked
          ? `<span class="badt">Der Browser hat die Wiedergabe blockiert – tippe auf „🔊 Anhören“.</span>`
          : `<span class="badt">Keine Sprachausgabe gehört? Prüfe die Lautstärke oder installiere eine deutsche Stimme (Einstellungen).</span>`;
        const sEl = $(".shadow-sent", el); sEl && sEl.classList.remove("blur");
        if (!startedAt) startedAt = Date.now();
      }
      updateRing();
    }

    function draw() {
      const lvl = opts.bucket ? A.srs.level(opts.bucket, cur.id) : -1;
      el.innerHTML = `<div class="shadow-card">
        ${opts.gate ? `<div class="timer-ring" id="sh-ring">--:--</div><div class="muted" id="sh-state" style="font-size:13px"></div>` : ""}
        <div class="toolbar" style="justify-content:center">${cur.gt ? `<span class="lvl">${esc(cur.gt)}</span>` : ""}${lvl >= 0 ? `<span class="lvl l${lvl}">Stufe ${lvl}</span>` : opts.bucket ? `<span class="lvl">neu</span>` : ""}<span class="muted" style="font-size:13px">${count} geübt${banked ? ` · ${A.fmtTime(banked)} heute in dieser Sitzung` : ""}</span></div>
        <div class="shadow-sent ${p.blind ? "blur" : ""}">${esc(cur.de)}</div>
        <div class="shadow-en">${esc(cur.en)}</div>
        <div class="tts-msg"></div>
        <div class="shadow-btns">
          <button class="btn big" data-a="play">🔊 Anhören</button>
          <button class="btn big" data-a="slow">🐢 Langsam</button>
          <button class="mic btn big" data-a="mic">🎤 Nachsprechen</button>
          <button class="btn big" data-a="self">✓ Nachgesprochen</button>
        </div>
        <div class="res"></div>
        <div class="rate-btns">
          <button class="btn" data-g="1" disabled>😓 Schwer</button>
          <button class="btn" data-g="2" disabled>🙂 Gut</button>
          <button class="btn primary" data-g="3" disabled>😎 Leicht</button>
        </div>
        <p class="hint">Sprich <b>gleichzeitig oder direkt danach</b> laut mit. Bewerten geht erst nach dem Nachsprechen.</p>
      </div>`;
      updateRing();
      const res = $(".res", el);
      const enableRate = () => { spoken = true; $$("[data-g]", el).forEach((b) => (b.disabled = false)); };
      $("[data-a=play]", el).onclick = () => play();
      $("[data-a=slow]", el).onclick = () => play(true);
      $("[data-a=self]", el).onclick = () => { if (!startedAt) return A.toast("Erst anhören, dann nachsprechen 🙂"); enableRate(); $("[data-a=self]", el).classList.add("primary"); };
      const mic = $("[data-a=mic]", el);
      mic.onclick = async () => {
        if (mic.classList.contains("rec")) { A.stopAll(); return; }
        if (!startedAt) return A.toast("Erst anhören, dann nachsprechen 🙂");
        if (!A.SR) { res.innerHTML = `<p class="hint">${esc(A.micErr("unsupported"))}</p>`; return; }
        A.stopAll(); mic.classList.add("rec"); mic.textContent = "● Stopp";
        res.innerHTML = `<span class="muted">Ich höre zu … · Listening …</span>`;
        try {
          const t = await A.listen("de", { onInterim: (x) => (res.innerHTML = `<span class="muted">${esc(x)}</span>`) });
          res.innerHTML = t ? A.alignHtml(cur.de, t, "Erkannt") : `<span class="muted">${A.micErr("no-speech")}</span>`;
          if (t) enableRate();
        } catch (e) {
          res.innerHTML = `<span class="badt">${esc(A.micErr(e))}</span><p class="hint">Du kannst stattdessen laut sprechen und „✓ Nachgesprochen“ klicken.</p>`;
        } finally { mic.classList.remove("rec"); mic.textContent = "🎤 Nachsprechen"; }
      };
      $$("[data-g]", el).forEach((b) => (b.onclick = () => rate(+b.dataset.g)));
      window.onkeydown = (e) => {
        if (e.target.tagName === "INPUT" || e.repeat) return;
        if (e.code === "Space") { e.preventDefault(); play(); }
        else if (e.key === "m" || e.key === "M") mic.click();
        else if (["1", "2", "3"].includes(e.key) && spoken) rate(+e.key);
      };
    }

    function rate(g) {
      if (!spoken) return;
      const sec = Math.floor(pending());
      if (opts.gate && sec > 0) { A.gate.add(sec); banked += sec; }
      count++;
      if (opts.bucket && cur.id) { const wasNew = A.srs.isNew(opts.bucket, cur.id); A.srs.grade(opts.bucket, cur.id, g); if (wasNew) { A.day().shN++; A.save(); } }
      if (g === 1) queue.splice(Math.min(3, queue.length), 0, cur);
      opts.onRate && opts.onRate();
      next();
    }

    if (opts.gate) uiTimer = setInterval(updateRing, 1000);
    intro();
    return { stop: () => { clearInterval(uiTimer); A.stopAll(); } };
  };

  /* ---------- speaking list (shadow individual sentences with score) ---------- */
  A.speakList = (el, items, lang) => {
    el.innerHTML = items.map((it, i) => `<div class="sitem" data-i="${i}"><div><div class="st">${it.who ? `<span class="muted" style="font-weight:600">${esc(it.who)}: </span>` : ""}${esc(it.t)}</div><div class="stt">${esc(it.tt || "")}</div></div>
      <div class="sb"><button class="chip" data-pl>🔊</button><button class="mic" data-mic>🎤</button></div><div class="res"></div></div>`).join("");
    $$(".sitem", el).forEach((row) => {
      const it = items[+row.dataset.i], res = row.querySelector(".res"), mic = row.querySelector("[data-mic]");
      row.querySelector("[data-pl]").onclick = () => A.sayNow(it.t, lang);
      mic.onclick = async () => {
        if (mic.classList.contains("rec")) { A.stopAll(); return; }
        A.stopAll(); mic.classList.add("rec"); mic.textContent = "●";
        res.innerHTML = `<span class="muted">Ich höre zu …</span>`;
        try { const t = await A.listen(lang, { onInterim: (x) => (res.innerHTML = `<span class="muted">${esc(x)}</span>`) }); res.innerHTML = t ? A.alignHtml(it.t, t, "Erkannt") : `<span class="muted">${A.micErr("no-speech")}</span>`; }
        catch (e) { res.innerHTML = `<span class="badt">${esc(A.micErr(e))}</span>`; }
        finally { mic.classList.remove("rec"); mic.textContent = "🎤"; }
      };
    });
  };

  /* ---------- dictation list ---------- */
  A.dictation = (el, items, lang) => {
    el.innerHTML = items.map((s, i) => `<div class="dict" data-i="${i}"><div><button class="chip" data-pl>▶</button> <button class="chip" data-sl>🐢</button></div>
      <input placeholder="Satz ${i + 1} …" autocomplete="off" spellcheck="false" aria-label="Satz ${i + 1}"><button class="btn" data-ck>Prüfen</button><div class="res"></div></div>`).join("");
    $$(".dict", el).forEach((row) => {
      const s = items[+row.dataset.i], text = s.t, inp = row.querySelector("input"), res = row.querySelector(".res");
      row.querySelector("[data-pl]").onclick = () => { A.sayNow(text, lang); inp.focus(); };
      row.querySelector("[data-sl]").onclick = () => { A.sayNow(text, lang, { rate: Math.max(0.55, A.prefs().rate - 0.3) }); inp.focus(); };
      const ck = () => { res.innerHTML = A.alignHtml(text, inp.value, "Deine Eingabe") + `<div class="heard" style="margin-top:4px">Lösung: <b>${esc(text)}</b><br>${esc(s.tt || "")}</div>`; };
      row.querySelector("[data-ck]").onclick = ck;
      inp.onkeydown = (e) => { if (e.key === "Enter") ck(); };
    });
  };

  /* ---------- tap-to-translate sentence ---------- */
  A.tokenize = (sentence) => esc(sentence).replace(/([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*)/g, (m) => {
    const w = A.lookup(m);
    return w ? `<span class="tok ${A.srs.mastered("words", w.id) ? "known" : ""}" data-w="${esc(w.id)}">${m}</span>` : m;
  });
  let pop = null;
  A.closePop = () => { if (pop) { pop.remove(); pop = null; } };
  document.addEventListener("click", (e) => {
    const t = e.target.closest(".tok");
    if (!t) { if (!e.target.closest(".pop")) A.closePop(); return; }
    e.stopPropagation();
    A.closePop();
    const w = A.byId[t.dataset.w]; if (!w) return;
    pop = document.createElement("div"); pop.className = "pop";
    pop.innerHTML = `<div class="pw">${A.wordHtml(w.de)}</div><div>${esc(w.en)}</div>${w.tr ? `<div class="wtr"><span class="trb">TR</span>${esc(w.tr)}</div>` : ""}
      <div class="wex" style="margin-top:6px"><span>${esc(w.xd)}</span></div><div class="wbtns"><button class="chip" data-p="de">🔊 DE</button><button class="chip" data-p="en">🔊 EN</button><button class="chip" data-p="add">＋ Lernen</button></div>`;
    document.body.appendChild(pop);
    const r = t.getBoundingClientRect();
    pop.style.left = Math.min(window.innerWidth - pop.offsetWidth - 10, Math.max(10, r.left)) + "px";
    pop.style.top = (r.bottom + 6 + pop.offsetHeight > window.innerHeight ? r.top - pop.offsetHeight - 6 : r.bottom + 6) + "px";
    pop.querySelector("[data-p=de]").onclick = () => A.sayNow(A.say(w.de), "de");
    pop.querySelector("[data-p=en]").onclick = () => A.sayNow(w.en, "en");
    pop.querySelector("[data-p=add]").onclick = () => { if (A.srs.isNew("words", w.id)) A.srs.grade("words", w.id, 0); A.toast("Zur Wiederholung hinzugefügt · added to review"); A.closePop(); };
    A.sayNow(A.say(w.de), "de");
  });
  window.addEventListener("scroll", A.closePop, { passive: true });

  /** save a sentence to the notebook */
  A.saveSentence = (de, en, src) => {
    if (A.S.notebook.some((n) => n.de === de)) { A.toast("Schon im Satzbuch · already saved"); return; }
    A.S.notebook.unshift({ de, en, src, added: A.today() }); A.save(); A.toast("Im Satzbuch gespeichert · saved");
  };
})();
