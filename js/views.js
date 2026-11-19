/* Views: one function per route. Each receives the main element and route params. */
(function () {
  "use strict";
  const A = window.App, { $, $$, esc, shuffle } = A;
  const V = (A.views = {});
  const tabsHtml = (tabs, cur, base) => `<div class="tabs">${tabs.map((t) => `<a class="tab ${cur === t[0] ? "on" : ""}" href="${base}/${t[0]}">${t[1]} <small>${t[2]}</small></a>`).join("")}</div>`;
  const themeProgress = (t) => { const m = t.words.filter((w) => A.srs.mastered("words", w.id)).length; return { m, n: t.words.length, pct: Math.round((100 * m) / t.words.length) }; };

  /* ---------- home ---------- */
  V.home = (m) => {
    const p = A.prefs(), d = A.day(), gateOk = A.gate.done();
    const due = A.dueWords().length, mastered = A.W.filter((w) => A.srs.mastered("words", w.id)).length, started = Object.keys(A.S.words).length;
    const shMastered = A.SH.filter((s) => A.srs.mastered("shadow", s.id)).length;
    const plan = [
      { done: gateOk, t: `Shadowing · ${p.shadowMin} Minuten`, s: gateOk ? "Erledigt – alles ist freigeschaltet." : `Noch ${A.fmtTime(A.gate.left())} – danach wird alles freigeschaltet.`, href: "#/shadow", btn: gateOk ? "Weiter üben" : "Jetzt starten" },
      { done: gateOk && due === 0, t: "Wiederholung", s: `${due} Wörter sind heute fällig.`, href: "#/learn", btn: "Wiederholen", lock: !gateOk },
      { done: d.newW >= p.newPerDay, t: `Neue Wörter · ${p.newPerDay} pro Tag`, s: `${d.newW} / ${p.newPerDay} heute gelernt.`, href: "#/learn", btn: "Lernen", lock: !gateOk },
      { done: false, t: "Input: Geschichte oder Gespräch", s: "Eine Folge hören, Wörter antippen, Fragen beantworten.", href: "#/stories", btn: "Öffnen", lock: !gateOk }
    ];
    m.innerHTML = `<div class="panel"><div class="kicker">${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</div>
      <h1>Guten Tag! 👋</h1><p class="muted" style="margin:0">Dein Tagesplan. Shadowing kommt immer zuerst – so trainierst du Aussprache, Hörverstehen und die wichtigsten Alltagssätze.</p>
      <div class="stats">
        <div class="stat"><b>🔥 ${A.streak()}</b><small>Tage in Folge · streak</small></div>
        <div class="stat"><b>${shMastered} / ${A.SH.length}</b><small>Kernsätze sicher · core sentences</small></div>
        <div class="stat"><b>${mastered} / ${A.W.length}</b><small>Wörter sicher · words mastered</small></div>
        <div class="stat"><b>${started}</b><small>Wörter begonnen · started</small></div>
      </div>
      <div class="plan">${plan.map((x, i) => `<div class="planitem ${x.done ? "done" : ""}"><div class="num">${x.done ? "✓" : i + 1}</div><div class="body"><b>${x.t}</b><span class="muted">${x.s}</span></div>
        ${x.lock ? `<span class="btn" title="Zuerst Shadowing">🔒</span>` : `<a class="btn ${i === 0 && !gateOk ? "primary" : ""}" href="${x.href}">${x.btn}</a>`}</div>`).join("")}</div></div>
      <div class="panel"><h3>Die Methode <small>How it works</small></h3>
      <div class="cards" style="margin-top:10px">
        <div class="card"><span class="tt">1 · Shadowing</span><span class="sub">300 Alltagssätze nachsprechen. Pflicht, mindestens ${p.shadowMin} Minuten am Tag.</span></div>
        <div class="card"><span class="tt">2 · Wiederholung</span><span class="sub">Verteiltes Wiederholen (Leitner): schwierige Wörter kommen öfter.</span></div>
        <div class="card"><span class="tt">3 · Input</span><span class="sub">Geschichten und echte Gespräche – Wort antippen = Übersetzung.</span></div>
        <div class="card"><span class="tt">4 · Output</span><span class="sub">Rollenspiele, Diktat und freies Sprechen mit Mikrofon.</span></div>
      </div></div>`;
  };

  /* ---------- shadowing ---------- */
  V.shadow = (m, params) => {
    const p = A.prefs();
    const sub = params[0] || "daily";
    const groups = window.SHADOWING || [];
    const mastered = A.SH.filter((s) => A.srs.mastered("shadow", s.id)).length;
    m.innerHTML = `<div class="uhead"><div><div class="kicker">Täglich · Pflicht</div><h1>Shadowing</h1><div class="muted">300 Kernsätze für den Alltag · ${mastered} sicher</div></div>
      <div class="toolbar" style="margin:0"><label class="tog"><input type="checkbox" id="blind" ${p.blind ? "checked" : ""}> Blind-Modus (erst hören, dann lesen)</label></div></div>
      ${tabsHtml([["daily", "Tagestraining", "Daily session"], ["texts", "Texte", "Paragraphs"], ["groups", "Satzgruppen", "Sentence groups"]], sub, "#/shadow")}
      <div class="panel" id="sh"></div>`;
    $("#blind").onchange = (e) => { A.setPref("blind", e.target.checked); A.route(); };
    const el = $("#sh");
    if (sub === "texts") return paragraphShadow(el, params[1] != null ? +params[1] : null, params[2] || "satz");
    if (sub === "groups") {
      const gi = params[1] != null ? +params[1] : null;
      if (gi == null) {
        el.innerHTML = `<h3>Satzgruppen <small>Pick a group to practise (counts towards your daily time)</small></h3><div class="cards" style="margin-top:12px">${groups.map((g, i) => {
          const items = A.SH.filter((s) => s.group === i), ms = items.filter((s) => A.srs.mastered("shadow", s.id)).length;
          return `<a class="card" href="#/shadow/groups/${i}"><span class="tt">${esc(g.t)}</span><span class="sub">${esc(g.te)} · ${ms}/${items.length}</span><div class="bar ok"><span style="width:${(100 * ms) / items.length}%"></span></div></a>`;
        }).join("")}</div>`;
        return;
      }
      el.innerHTML = `<div class="toolbar"><a class="btn" href="#/shadow/groups">← Gruppen</a><b>${esc(groups[gi].t)}</b></div><div id="sp"></div>`;
      A.shadowPlayer($("#sp"), A.SH.filter((s) => s.group === gi), { gate: true, bucket: "shadow" });
      return;
    }
    const dueSh = A.SH.filter((s) => A.srs.isDue("shadow", s.id));
    const fresh = A.SH.filter((s) => A.srs.isNew("shadow", s.id)).slice(0, Math.max(0, p.newShadowPerDay - A.day().shN));
    let queue = dueSh.concat(fresh);
    const refill = () => { const learned = A.SH.filter((s) => !A.srs.isNew("shadow", s.id)); const pool = learned.length >= 10 ? learned : A.SH.slice(0, 40); return shuffle(pool).slice(0, 20); };
    if (!queue.length) queue = refill();
    el.innerHTML = `<div id="sp"></div>`;
    A.shadowPlayer($("#sp"), queue, { gate: true, bucket: "shadow", refill });
  };

  /* ---------- daily learning (reviews + new words) ---------- */
  V.learn = (m) => {
    const p = A.prefs(), d = A.day();
    const due = shuffle(A.dueWords()).slice(0, 60);
    const fresh = A.newWords(Math.max(0, p.newPerDay - d.newW));
    m.innerHTML = `<div class="uhead"><div><div class="kicker">Heute</div><h1>Wiederholen & Neues lernen</h1><div class="muted">${due.length} fällig · ${fresh.length} neu (Ziel ${p.newPerDay}/Tag)</div></div></div><div class="panel" id="fl"></div>`;
    const cards = due.concat(fresh);
    if (!cards.length) { $("#fl").innerHTML = `<div class="result"><div class="ring" style="--p:100">✓</div><p><b>Für heute ist alles erledigt!</b></p><p class="muted">Lust auf mehr? Öffne ein <a href="#/themes">Thema</a>, eine <a href="#/stories">Geschichte</a> oder ein <a href="#/convs">Gespräch</a>.</p></div>`; return; }
    A.flash($("#fl"), cards, { onDoneHtml: `<p class="muted">Super! Morgen geht's weiter. Jetzt Input: <a href="#/stories">Geschichte hören</a>.</p>` });
  };

  /* ---------- themes ---------- */
  V.themes = (m) => {
    const block = (g, title) => `<div class="panel"><h3>${title}</h3><div class="cards" style="margin-top:12px">${A.THEMES.filter((t) => t.g === g).map((t) => {
      const pr = themeProgress(t);
      return `<a class="card" href="#/theme/${t.id}"><span class="tt">${esc(t.t)}</span><span class="sub">${esc(t.te)} · ${t.words.length} Wörter · ${t.lessons.length} Lektionen</span><div class="bar ok"><span style="width:${pr.pct}%"></span></div><span class="sub">${pr.m} sicher${A.S.scores[t.id + ":test"] != null ? " · Test " + A.S.scores[t.id + ":test"] + "%" : ""}</span></a>`;
    }).join("")}</div></div>`;
    const gen = A.THEMES.filter((t) => t.g === "gen").reduce((a, t) => a + t.words.length, 0), it = A.W.length - gen;
    m.innerHTML = `<div class="uhead"><div><div class="kicker">Wortschatz</div><h1>Themen</h1><div class="muted">${A.W.length} Wörter · ${gen} Alltag & Beruf · ${it} IT</div></div></div>
      ${block("gen", "Alltag, Beruf & Gesellschaft <small>General B2</small>")}${block("it", "IT & Software <small>IT vocabulary</small>")}`;
  };

  V.theme = (m, params) => {
    const t = A.themeById[params[0]]; if (!t) return V.themes(m);
    const sub = params[1] || "lessons";
    const tabs = [["lessons", "Lektionen", "Lessons"]];
    if (t.r) tabs.push(["read", "Lesen & Hören", "Read & listen"]);
    if (t.d) tabs.push(["dialog", "Dialog", "Dialogue"]);
    const ti = A.TEXTS.findIndex((x) => x.theme === t.id);
    if (ti >= 0) tabs.push(["shadow", "Shadowing-Text", "Paragraph"]);
    tabs.push(["test", "Thementest", "Theme test"]);
    const pr = themeProgress(t);
    m.innerHTML = `<div class="uhead"><div><div class="kicker">${t.g === "it" ? "IT" : "Allgemein"} · Thema</div><h1>${esc(t.t)}</h1><div class="muted">${esc(t.te)} · ${pr.m}/${pr.n} Wörter sicher</div></div><a class="btn" href="#/themes">← Alle Themen</a></div>
      ${tabsHtml(tabs, sub, "#/theme/" + t.id)}<div id="tc"></div>`;
    const tc = $("#tc");
    if (sub === "lessons") {
      tc.innerHTML = `<div class="panel"><div class="cards">${t.lessons.map((ws, i) => {
        const ms = ws.filter((w) => A.srs.mastered("words", w.id)).length, st = ws.filter((w) => !A.srs.isNew("words", w.id)).length;
        return `<a class="card" href="#/lesson/${t.id}/${i}"><span class="kicker">Lektion ${i + 1}</span><span class="tt">${esc(A.say(ws[0].de))} … ${esc(A.say(ws[ws.length - 1].de))}</span><span class="sub">${ws.length} Wörter · ${st} begonnen · ${ms} sicher</span><div class="bar ok"><span style="width:${(100 * ms) / ws.length}%"></span></div></a>`;
      }).join("")}</div></div>`;
    } else if (sub === "read") readText(tc, t.r, t.id + ":read");
    else if (sub === "dialog") dialogView(tc, t.d, t.id + ":dialog");
    else if (sub === "shadow" && ti >= 0) { tc.innerHTML = `<div class="panel" id="psh"></div>`; paragraphShadow($("#psh"), ti, params[2] || "satz", "#/theme/" + t.id + "/shadow"); }
    else {
      tc.innerHTML = `<div class="panel"><h3>Thementest <small>15 Fragen aus allen Lektionen</small></h3><div id="q" style="margin-top:12px"></div></div>`;
      A.runQuiz($("#q"), () => A.makeTest(t.words, t.words, 15), { key: t.id + ":test" });
    }
  };

  function readText(el, r, key, hideTitle) {
    el.innerHTML = `<div class="panel">${hideTitle ? "" : `<h3>${esc(r.t)}</h3><div class="muted">${esc(r.te)}</div>`}
      <div class="toolbar"><button class="btn primary" data-p="de">▶ Vorlesen</button><button class="btn" data-p="en">▶ English</button><button class="btn" data-p="x">■</button><label class="tog"><input type="checkbox" id="showEn"> English anzeigen</label></div>
      <div class="text" id="txt">${r.s.map((s, i) => `<p class="sent" data-i="${i}"><span class="sd">${A.tokenize(s[0])} <span class="sacts"><button class="chip" data-say="${i}" title="Anhören">🔊</button><button class="chip" data-save="${i}" title="Ins Satzbuch">＋</button></span></span><span class="se">${esc(s[1])}</span></p>`).join("")}</div>
      <p class="hint">Tipp: Unterstrichene Wörter antippen = Übersetzung. Erst still lesen, dann laut mitlesen.</p></div>
      <div class="panel"><h3>Verständnisfragen <small>Comprehension</small></h3><div id="q"></div></div>
      <div class="panel"><h3>Diktat <small>Dictation</small></h3><div id="dict"></div></div>`;
    const ps = $$(".sent", el);
    $("#showEn").onchange = (e) => $("#txt").classList.toggle("en", e.target.checked);
    $$("[data-say]", el).forEach((b) => (b.onclick = () => A.sayNow(r.s[+b.dataset.say][0], "de")));
    $$("[data-save]", el).forEach((b) => (b.onclick = () => { const s = r.s[+b.dataset.save]; A.saveSentence(s[0], s[1], r.t); }));
    $$("[data-p]", el).forEach((b) => (b.onclick = () => { const l = b.dataset.p; if (l === "x") return A.stopAll(); A.seq(r.s.map((s) => [l === "de" ? s[0] : s[1], l, 0, 450]), (i) => { ps.forEach((p) => p.classList.remove("playing")); if (i >= 0) ps[i].classList.add("playing"); }); }));
    if (r.q) A.runQuiz($("#q"), A.qsFrom(r.q), { key });
    const L = A.prefs().lang;
    A.dictation($("#dict"), r.s.map((s) => ({ t: L === "de" ? s[0] : s[1], tt: L === "de" ? s[1] : s[0] })), L);
  }

  /* ---------- paragraph shadowing ----------
     "satz": shadow sentence by sentence (credited like the daily session)
     "ganz": listen to the whole paragraph, then speak it in one go; credited on completion */
  function paragraphShadow(el, i, mode, base) {
    base = base || "#/shadow/texts/" + i;
    if (i == null || !A.TEXTS[i]) {
      const block = (g, title) => `<h3 style="margin-top:6px">${title}</h3><div class="cards" style="margin:10px 0 18px">${A.TEXTS.map((x, k) => [x, k]).filter(([x]) => (A.themeById[x.theme] || {}).g === g).map(([x, k]) => {
        const done = A.S.scores["para:" + k]; const th = A.themeById[x.theme];
        return `<a class="card" href="#/shadow/texts/${k}"><span class="kicker">${esc(th ? th.t : x.theme)}</span><span class="tt">${esc(x.t)}</span><span class="sub">${esc(x.te)} · ${x.s.length} Sätze${done != null ? ` · ✓ ${done}%` : ""}</span></a>`;
      }).join("")}</div>`;
      el.innerHTML = `<p class="muted" style="margin-top:0">Zusammenhängende Texte zum Nachsprechen – erst Satz für Satz, dann der ganze Absatz am Stück. Die Zeit zählt fürs Tagesziel.</p>
        ${block("gen", "Alltag & Beruf")}${block("it", "IT")}`;
      return;
    }
    const x = A.TEXTS[i], th = A.themeById[x.theme];
    const head = `<div class="toolbar"><a class="btn" href="#/shadow/texts">← Alle Texte</a><b>${esc(x.t)}</b><span class="muted">${esc(x.te)}${th ? ` · <a href="#/theme/${th.id}">${esc(th.t)}</a>` : ""}</span></div>
      <div class="tabs"><a class="tab ${mode === "satz" ? "on" : ""}" href="${base}/satz">1 · Satz für Satz <small>Sentence by sentence</small></a><a class="tab ${mode === "ganz" ? "on" : ""}" href="${base}/ganz">2 · Ganzer Text <small>Whole paragraph</small></a></div>`;
    if (mode !== "ganz") {
      el.innerHTML = head + `<div id="pp"></div>`;
      A.shadowPlayer($("#pp"), x.s.map((s, k) => ({ id: `para:${i}:${k}`, de: s[0], en: s[1], gt: `${x.t} · ${k + 1}/${x.s.length}` })), {
        gate: true,
        onFinish: (box) => { box.innerHTML = `<div class="result"><div class="ring" style="--p:100">✓</div><p><b>Alle ${x.s.length} Sätze geübt!</b></p><a class="btn primary big" href="${base}/ganz">Jetzt den ganzen Text →</a></div>`; }
      });
      return;
    }
    const full = x.s.map((s) => s[0]).join(" ");
    const cap = Math.round(Math.min(240, Math.max(40, (full.length * 0.075) / A.prefs().rate * 3 + 20)));
    let startedAt = 0, said = "";
    el.innerHTML = head + `
      <div class="steps"><span>1 · Ganzen Text anhören</span><span>2 · Laut mitlesen</span><span>3 · 🎤 Den ganzen Text sprechen</span></div>
      <div class="toolbar"><button class="btn primary" id="pl">▶ Text anhören</button><button class="btn" id="slow">🐢 Langsam</button><button class="btn" id="st">■</button><label class="tog"><input type="checkbox" id="en"> English</label></div>
      <div class="text" id="txt">${x.s.map((s, k) => `<p class="sent" data-k="${k}"><span class="sd">${A.tokenize(s[0])}</span><span class="se">${esc(s[1])}</span></p>`).join("")}</div>
      <div class="toolbar"><button class="mic btn big" id="rec">🎤 Ganzen Text sprechen</button><button class="btn big" id="self">✓ Laut gelesen</button></div>
      <div class="live hidden" id="live"></div><div id="res"></div>`;
    const ps = $$(".sent", el);
    const playAll = (rate) => {
      if (!startedAt) startedAt = Date.now();
      A.seq(x.s.map((y) => [y[0], "de", 0, 350, rate]), (k) => { ps.forEach((p) => p.classList.remove("playing")); if (k >= 0) ps[k].classList.add("playing"); });
    };
    $("#pl", el).onclick = () => { A.unlockTTS(); playAll(); };
    $("#slow", el).onclick = () => { A.unlockTTS(); playAll(Math.max(0.55, A.prefs().rate - 0.3)); };
    $("#st", el).onclick = () => { A.stopAll(); ps.forEach((p) => p.classList.remove("playing")); };
    $("#en", el).onchange = (e) => $("#txt", el).classList.toggle("en", e.target.checked);
    const finish = (score) => {
      const sec = startedAt ? Math.floor(Math.min(cap, (Date.now() - startedAt) / 1000)) : 0;
      if (sec > 0) A.gate.add(sec);
      A.S.scores["para:" + i] = Math.max(A.S.scores["para:" + i] || 0, score); A.save();
      startedAt = 0;
      $("#res", el).innerHTML += `<div class="note">${sec ? `+${A.fmtTime(sec)} fürs Tagesziel gutgeschrieben. ` : ""}${i + 1 < A.TEXTS.length ? `<a href="#/shadow/texts/${i + 1}">Nächster Text →</a>` : ""}</div>`;
    };
    $("#self", el).onclick = () => { if (!startedAt) return A.toast("Erst den Text anhören 🙂"); A.stopAll(); $("#res", el).innerHTML = ""; finish(60); };
    const rec = $("#rec", el);
    let running = false;
    rec.onclick = async () => {
      if (running) { running = false; A.stopAll(); return; }
      if (!startedAt) return A.toast("Erst den Text anhören 🙂");
      if (!A.SR) { $("#res", el).innerHTML = `<p class="hint">${esc(A.micErr("unsupported"))} Lies den Text laut und klicke „✓ Laut gelesen“.</p>`; return; }
      A.stopAll(); running = true; said = ""; rec.classList.add("rec"); rec.textContent = "● Fertig"; const live = $("#live", el); live.classList.remove("hidden"); live.textContent = "…";
      while (running) {
        try { const t = await A.listen("de", { continuous: true, onInterim: (y) => (live.textContent = (said + " " + y).trim()) }); said = (said + " " + t).trim(); live.textContent = said || "…"; }
        catch (e) { if (e === "no-speech" || e === "aborted") { if (!running) break; continue; } $("#res", el).innerHTML = `<span class="badt">${esc(A.micErr(e))}</span>`; break; }
      }
      running = false; rec.classList.remove("rec"); rec.textContent = "🎤 Ganzen Text sprechen";
      if (said) { $("#res", el).innerHTML = A.alignHtml(full, said, "Erkannt"); finish(A.align(full, said).score); }
    };
  }

  function dialogView(el, d, key) {
    const spk = [...new Set(d.l.map((x) => x[0]))];
    el.innerHTML = `<div class="panel"><h3>${esc(d.t)}</h3><div class="muted">${esc(d.te)}</div>
      <div class="steps"><span>1 · Zweimal hören ohne Text</span><span>2 · Fragen beantworten</span><span>3 · Transkript lesen & nachsprechen</span></div>
      <div class="toolbar"><button class="btn primary" data-p="de">▶ Anhören</button><button class="btn" data-p="en">▶ English</button><button class="btn" data-p="x">■</button><label class="tog"><input type="checkbox" id="showT"> Transkript</label><label class="tog"><input type="checkbox" id="showE"> English</label></div>
      <div id="tr" class="hidden">${d.l.map((x, i) => `<div class="dline" data-i="${i}"><span class="who">${esc(x[0])}</span><span><span class="de">${A.tokenize(x[1])}</span><span class="en hidden">${esc(x[2])}</span></span></div>`).join("")}</div></div>
      ${d.q ? `<div class="panel"><h3>Hörverstehen <small>Listening comprehension</small></h3><div id="q"></div></div>` : ""}
      <div class="panel"><h3>Nachsprechen <small>Shadow the lines</small></h3><div id="sl"></div></div>`;
    const lines = $$(".dline", el);
    $("#showT").onchange = (e) => $("#tr").classList.toggle("hidden", !e.target.checked);
    $("#showE").onchange = (e) => $$(".dline .en", el).forEach((x) => x.classList.toggle("hidden", !e.target.checked));
    $$("[data-p]", el).forEach((b) => (b.onclick = () => { const l = b.dataset.p; if (l === "x") return A.stopAll(); A.seq(d.l.map((x) => [l === "de" ? x[1] : x[2], l, spk.indexOf(x[0]), 550]), (i) => { lines.forEach((n) => n.classList.remove("playing")); if (i >= 0) lines[i].classList.add("playing"); }); }));
    if (d.q) A.runQuiz($("#q"), A.qsFrom(d.q), { key });
    A.speakList($("#sl"), d.l.map((x) => ({ who: x[0], t: x[1], tt: x[2] })), "de");
  }

  /* ---------- lesson ---------- */
  V.lesson = (m, params) => {
    const t = A.themeById[params[0]]; if (!t) return V.themes(m);
    const li = +params[1] || 0, ws = t.lessons[li]; if (!ws) return V.theme(m, [t.id]);
    const sub = params[2] || "vocab";
    const base = `#/lesson/${t.id}/${li}`;
    m.innerHTML = `<div class="uhead"><div><div class="kicker"><a href="#/theme/${t.id}">${esc(t.t)}</a> · Lektion ${li + 1} / ${t.lessons.length}</div><h1>Lektion ${li + 1}</h1><div class="muted">${ws.length} Wörter</div></div>
      <div class="toolbar" style="margin:0">${li > 0 ? `<a class="btn" href="#/lesson/${t.id}/${li - 1}">← Zurück</a>` : ""}${li < t.lessons.length - 1 ? `<a class="btn" href="#/lesson/${t.id}/${li + 1}">Weiter →</a>` : ""}</div></div>
      ${tabsHtml([["vocab", "Wortschatz", "Vocabulary"], ["flash", "Karteikarten", "Flashcards"], ["listen", "Hören", "Listening"], ["speak", "Sprechen", "Speaking"], ["test", "Test", "Quiz"]], sub, base)}
      <div class="panel" id="tc"></div>`;
    const el = $("#tc"), L = A.prefs().lang;
    if (sub === "vocab") vocabGrid(el, ws);
    else if (sub === "flash") A.flash(el, ws);
    else if (sub === "listen") {
      el.innerHTML = `<h3>Hörquiz <small>Hear the word, pick the meaning</small></h3><div id="q" style="margin-top:10px"></div><h3 style="margin-top:26px">Diktat <small>Dictation · ${L === "de" ? "Deutsch" : "English"}</small></h3><div id="dict"></div>`;
      A.runQuiz($("#q"), () => shuffle(ws).slice(0, 8).map((w) => { const d = shuffle(ws.filter((x) => x.id !== w.id)).slice(0, 3); return { prompt: "Was hörst du?", sub: "Choose the meaning of the word you hear.", audio: [A.say(w.de), "de"], options: [w.en, ...d.map((x) => x.en)], answer: 0, wid: w.id, after: `<b>${A.wordHtml(w.de)}</b> = ${esc(w.en)}` }; }), { key: `${t.id}:${li}:listen` });
      A.dictation($("#dict"), shuffle(ws).slice(0, 6).map((w) => ({ t: L === "de" ? w.xd : w.xe, tt: L === "de" ? w.xe : w.xd })), L);
    } else if (sub === "speak") {
      el.innerHTML = `<h3>Beispielsätze nachsprechen <small>Shadow the example sentences</small></h3><div id="sl"></div>`;
      A.speakList($("#sl"), ws.map((w) => ({ t: L === "de" ? w.xd : w.xe, tt: L === "de" ? w.xe : w.xd })), L);
    } else {
      el.innerHTML = `<h3>Lektionstest <small>10 Fragen</small></h3><div id="q" style="margin-top:12px"></div>`;
      A.runQuiz($("#q"), () => A.makeTest(ws, t.words, 10), { key: `${t.id}:${li}:test` });
    }
  };

  function vocabGrid(el, ws) {
    const card = (w) => { const lvl = A.srs.level("words", w.id);
      return `<div class="wcard ${A.srs.mastered("words", w.id) ? "known" : ""}" data-id="${esc(w.id)}"><div class="wtop"><div class="wde">${A.wordHtml(w.de)}</div><span class="lvl l${lvl}">${lvl < 0 ? "neu" : "Stufe " + lvl}</span></div>
        <div class="wen">${esc(w.en)}</div>${w.tr ? `<div class="wtr"><span class="trb">TR</span>${esc(w.tr)}</div>` : ""}
        <div class="wex"><span class="xd">${A.hl(w.xd, w.de)}</span><span class="xe">${esc(w.xe)}</span></div>
        <div class="wbtns"><button class="chip" data-say="de">🔊 DE</button><button class="chip" data-say="en">🔊 EN</button><button class="chip" data-say="xd">🔊 Satz</button><button class="chip" data-say="xe">🔊 Sentence</button></div></div>`; };
    el.innerHTML = `<h3>Wortschatz <small>Artikel: <span class="art der">der</span> · <span class="art die">die</span> · <span class="art das">das</span></small></h3>
      <div class="toolbar"><button class="btn" data-pa="w">▶ Wörter DE → EN</button><button class="btn" data-pa="s">▶ Sätze DE → EN</button><button class="btn" data-pa="x">■ Stopp</button><a class="btn primary" href="${location.hash.replace(/\/vocab$/, "")}/flash">Karteikarten →</a></div>
      <div class="grid">${ws.map(card).join("")}</div>`;
    $$(".wcard", el).forEach((c) => { const w = A.byId[c.dataset.id];
      $$("[data-say]", c).forEach((b) => (b.onclick = () => { const s = b.dataset.say; A.sayNow(s === "de" ? A.say(w.de) : s === "en" ? w.en : s === "xd" ? w.xd : w.xe, s === "de" || s === "xd" ? "de" : "en"); })); });
    $$("[data-pa]", el).forEach((b) => (b.onclick = () => {
      if (b.dataset.pa === "x") return A.stopAll();
      const cards = $$(".wcard", el), items = [];
      cards.forEach((c) => { const w = A.byId[c.dataset.id]; if (b.dataset.pa === "w") items.push([A.say(w.de), "de", 0, 450], [w.en, "en", 0, 900]); else items.push([w.xd, "de", 0, 450], [w.xe, "en", 0, 900]); });
      A.seq(items, (i) => { cards.forEach((c) => c.classList.remove("playing")); if (i >= 0) { const c = cards[Math.floor(i / 2)]; c.classList.add("playing"); c.scrollIntoView({ block: "nearest", behavior: "smooth" }); } });
    }));
  }

  /* ---------- stories ---------- */
  V.stories = (m, params) => {
    if (params[0] != null) return storyView(m, +params[0]);
    m.innerHTML = `<div class="uhead"><div><div class="kicker">Input</div><h1>Geschichten</h1><div class="muted">„Deniz in Deutschland“ – eine Serie in ${A.STORIES.length} Folgen. Hören, Wörter antippen, Fragen beantworten.</div></div></div>
      <div class="panel"><div class="cards">${A.STORIES.map((s, i) => `<a class="card" href="#/stories/${i}"><span class="kicker">Folge ${i + 1}</span><span class="tt">${esc(s.t.replace(/^Folge \d+:\s*/, ""))}</span><span class="sub">${esc(s.te.replace(/^Episode \d+:\s*/, ""))}${A.S.scores["story:" + i] != null ? " · ✓ " + A.S.scores["story:" + i] + "%" : ""}</span></a>`).join("")}</div></div>`;
  };
  function storyView(m, i) {
    const s = A.STORIES[i]; if (!s) return V.stories(m, []);
    m.innerHTML = `<div class="uhead"><div><div class="kicker"><a href="#/stories">Geschichten</a> · Folge ${i + 1} / ${A.STORIES.length}</div><h1>${esc(s.t.replace(/^Folge \d+:\s*/, ""))}</h1><div class="muted">${esc(s.te)}</div></div>
      <div class="toolbar" style="margin:0">${i > 0 ? `<a class="btn" href="#/stories/${i - 1}">←</a>` : ""}${i < A.STORIES.length - 1 ? `<a class="btn" href="#/stories/${i + 1}">Nächste Folge →</a>` : ""}</div></div><div id="st"></div>`;
    readText($("#st"), s, "story:" + i, true);
  }

  /* ---------- conversations / role-play ---------- */
  V.convs = (m, params) => {
    if (params[0] != null) return convView(m, +params[0], params[1] || "listen");
    m.innerHTML = `<div class="uhead"><div><div class="kicker">Sprechen</div><h1>Alltagsgespräche</h1><div class="muted">Echte Situationen zum Hören und als Rollenspiel – du sprichst deine Rolle selbst.</div></div></div>
      <div class="panel"><div class="cards">${A.CONVS.map((c, i) => `<a class="card" href="#/convs/${i}"><span class="tt">${esc(c.t)}</span><span class="sub">${esc(c.te)}</span><span class="sub">${esc(c.ctx)}</span></a>`).join("")}</div></div>`;
  };
  function convView(m, i, sub) {
    const c = A.CONVS[i]; if (!c) return V.convs(m, []);
    const spk = [...new Set(c.l.map((x) => x[0]))];
    m.innerHTML = `<div class="uhead"><div><div class="kicker"><a href="#/convs">Gespräche</a></div><h1>${esc(c.t)}</h1><div class="muted">${esc(c.te)}</div></div></div>
      ${tabsHtml([["listen", "Hören", "Listen"], ["role", "Rollenspiel", "Role-play"]], sub, "#/convs/" + i)}<div class="panel" id="cv"></div>`;
    const el = $("#cv");
    if (sub === "listen") {
      el.innerHTML = `<p class="note" style="margin-top:0">🎬 ${esc(c.ctx)}</p>
        <div class="toolbar"><button class="btn primary" data-p="de">▶ Anhören</button><button class="btn" data-p="en">▶ English</button><button class="btn" data-p="x">■</button><label class="tog"><input type="checkbox" id="showE"> English</label></div>
        <div>${c.l.map((x, k) => `<div class="dline ${x[0] === "Sie" ? "me" : ""}" data-i="${k}"><span class="who">${x[0] === "Sie" ? "Du (Sie)" : esc(x[0])}</span><span><span class="de">${A.tokenize(x[1])} <button class="chip" data-say="${k}">🔊</button> <button class="chip" data-save="${k}">＋</button></span><span class="en hidden">${esc(x[2])}</span></span></div>`).join("")}</div>
        <div class="toolbar"><a class="btn primary" href="#/convs/${i}/role">Jetzt Rollenspiel →</a></div>`;
      const lines = $$(".dline", el);
      $("#showE").onchange = (e) => $$(".dline .en", el).forEach((x) => x.classList.toggle("hidden", !e.target.checked));
      $$("[data-say]", el).forEach((b) => (b.onclick = () => { const x = c.l[+b.dataset.say]; A.sayNow(x[1], "de", { voice: spk.indexOf(x[0]) }); }));
      $$("[data-save]", el).forEach((b) => (b.onclick = () => { const x = c.l[+b.dataset.save]; A.saveSentence(x[1], x[2], c.t); }));
      $$("[data-p]", el).forEach((b) => (b.onclick = () => { const l = b.dataset.p; if (l === "x") return A.stopAll(); A.seq(c.l.map((x) => [l === "de" ? x[1] : x[2], l, spk.indexOf(x[0]), 550]), (k) => { lines.forEach((n) => n.classList.remove("playing")); if (k >= 0) lines[k].classList.add("playing"); }); }));
      return;
    }
    // role-play
    let k = 0; const scores = [];
    const step = async () => {
      if (k >= c.l.length) {
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        A.S.scores["conv:" + i] = Math.max(A.S.scores["conv:" + i] || 0, avg); A.save();
        el.innerHTML += `<div class="result"><div class="ring" style="--p:${avg}">${avg}%</div><p><b>Rollenspiel beendet!</b></p><button class="btn primary" id="again">↻ Nochmal</button></div>`;
        $("#again").onclick = () => A.route();
        return;
      }
      const x = c.l[k], log = $("#log");
      if (x[0] !== "Sie") {
        log.insertAdjacentHTML("beforeend", `<div class="dline playing"><span class="who">${esc(x[0])}</span><span><span class="de">${esc(x[1])}</span><span class="en">${esc(x[2])}</span></span></div>`);
        await A.speak(x[1], "de", { voice: spk.indexOf(x[0]) });
        log.lastElementChild.classList.remove("playing"); k++; step();
      } else {
        log.insertAdjacentHTML("beforeend", `<div class="dline me" id="turn"><span class="who">Du</span><span><span class="en"><b>Sag auf Deutsch:</b> ${esc(x[2])}</span>
          <span class="toolbar" style="margin:6px 0"><button class="mic" id="rmic">🎤 Sprechen</button><button class="chip" id="hint">💡 Lösung zeigen</button><button class="chip" id="skip">Weiter →</button></span><span class="res"></span></span></div>`);
        const turn = $("#turn"), res = $(".res", turn);
        const finish = (score, said) => { scores.push(score); turn.removeAttribute("id"); $(".toolbar", turn).remove(); res.innerHTML = (said != null ? A.alignHtml(x[1], said, "Du hast gesagt") : "") + `<div class="de" style="margin-top:4px"><b>${esc(x[1])}</b></div>`; A.speak(x[1], "de").then(() => { k++; step(); }); };
        $("#hint").onclick = () => { res.innerHTML = `<span class="muted">${esc(x[1])}</span>`; A.sayNow(x[1], "de"); };
        $("#skip").onclick = () => finish(0, null);
        $("#rmic").onclick = async () => {
          const b = $("#rmic"); if (!A.SR) { res.innerHTML = `<span class="hint">${esc(A.micErr("unsupported"))} Sprich den Satz laut und klicke „Weiter“.</span>`; return; }
          b.classList.add("rec"); b.textContent = "● …";
          try { const said = await A.listen("de", { onInterim: (t) => (res.innerHTML = `<span class="muted">${esc(t)}</span>`) }); finish(A.align(x[1], said).score, said); }
          catch (e) { res.innerHTML = `<span class="badt">${esc(A.micErr(e))}</span>`; b.classList.remove("rec"); b.textContent = "🎤 Sprechen"; }
        };
      }
    };
    el.innerHTML = `<p class="note" style="margin-top:0">🎬 ${esc(c.ctx)} Du bist <b>„Sie“</b>. Die anderen Rollen spricht die App; für deine Zeilen siehst du nur die englische Bedeutung.</p>
      <div class="toolbar"><button class="btn primary" id="go">▶ Rollenspiel starten</button></div><div id="log"></div>`;
    $("#go").onclick = () => { $("#go").remove(); step(); };
  }

  /* ---------- notebook ---------- */
  V.notebook = (m, params) => {
    const nb = A.S.notebook;
    const sub = params[0] || "list";
    m.innerHTML = `<div class="uhead"><div><div class="kicker">Satzbuch</div><h1>Meine Sätze</h1><div class="muted">${nb.length} gespeicherte Sätze aus Geschichten, Texten und Gesprächen</div></div></div>
      ${tabsHtml([["list", "Liste", "List"], ["shadow", "Shadowing", "Shadow them"]], sub, "#/notebook")}<div class="panel" id="nb"></div>`;
    const el = $("#nb");
    if (!nb.length) { el.innerHTML = `<p>Noch leer. Klicke bei Sätzen auf <b>＋</b>, um sie hier zu sammeln.</p>`; return; }
    if (sub === "shadow") { A.shadowPlayer(el, nb.map((n) => ({ de: n.de, en: n.en })), { gate: true }); return; }
    el.innerHTML = `<div class="list">${nb.map((n, i) => `<div class="lrow"><span><b>${esc(n.de)}</b><br><small>${esc(n.src || "")}</small></span><span class="en muted">${esc(n.en)}</span><span><button class="chip" data-p="${i}">🔊</button> <button class="chip" data-d="${i}">✕</button></span></div>`).join("")}</div>`;
    $$("[data-p]", el).forEach((b) => (b.onclick = () => A.sayNow(nb[+b.dataset.p].de, "de")));
    $$("[data-d]", el).forEach((b) => (b.onclick = () => { nb.splice(+b.dataset.d, 1); A.save(); A.route(); }));
  };

  /* ---------- search ---------- */
  V.search = (m) => {
    m.innerHTML = `<div class="uhead"><div><div class="kicker">Wörterbuch</div><h1>Suche</h1><div class="muted">${A.W.length} Wörter · Deutsch, Englisch oder Türkisch</div></div></div>
      <div class="panel"><div class="search-row"><input class="input" id="q" placeholder="z. B. Kündigung, deployment, kira …" autofocus></div><div id="res" style="margin-top:14px"></div></div>`;
    const run = () => {
      const q = $("#q").value.trim().toLowerCase();
      if (q.length < 2) { $("#res").innerHTML = `<p class="muted">Mindestens 2 Buchstaben eingeben.</p>`; return; }
      const hits = A.W.filter((w) => w.de.toLowerCase().includes(q) || w.en.toLowerCase().includes(q) || (w.tr && w.tr.toLowerCase().includes(q))).slice(0, 60);
      $("#res").innerHTML = hits.length ? `<div class="list">${hits.map((w) => `<div class="lrow"><span><b>${A.wordHtml(w.de)}</b><br><small><a href="#/theme/${w.theme}">${esc(A.themeById[w.theme].t)}</a></small></span><span class="en">${esc(w.en)}${w.tr ? `<br><small><span class="trb">TR</span>${esc(w.tr)}</small>` : ""}</span><span><button class="chip" data-id="${esc(w.id)}">🔊</button></span></div>`).join("")}</div>` : `<p class="muted">Keine Treffer.</p>`;
      $$("[data-id]", $("#res")).forEach((b) => (b.onclick = () => A.sayNow(A.say(A.byId[b.dataset.id].de), "de")));
    };
    $("#q").oninput = run; run();
  };

  /* ---------- mixed test ---------- */
  V.test = (m) => {
    const best = A.S.scores["mixed:test"];
    const pool = A.W.filter((w) => !A.srs.isNew("words", w.id));
    const src = pool.length >= 20 ? pool : A.W;
    m.innerHTML = `<div class="uhead"><div><div class="kicker">Prüfen</div><h1>Gemischter Test</h1><div class="muted">20 Fragen ${pool.length >= 20 ? "aus deinen gelernten Wörtern" : "aus allen Themen"} · Bestes Ergebnis: ${best != null ? best + "%" : "—"}</div></div></div><div class="panel"><div id="q"></div></div>`;
    A.runQuiz($("#q"), () => A.makeTest(src, A.W, 20), { key: "mixed:test" });
  };

  /* ---------- free speaking ---------- */
  V.speak = (m) => {
    const prompts = A.THEMES.filter((t) => t.r).map((t) => t.r.t);
    const topics = ["Stell dich in zwei Minuten vor: Arbeit, Familie, Hobbys.", "Beschreibe deinen typischen Arbeitstag.", "Was sind Vor- und Nachteile von Homeoffice?", "Erzähle von einem schwierigen Bug und wie du ihn gelöst hast.", "Wie hast du Deutsch gelernt und was ist am schwierigsten?", "Beschreibe deine Wohnung und deine Nachbarschaft.", "Was würdest du ändern, wenn du Bürgermeister wärst?", "Sollte KI menschliche Tester ersetzen? Begründe deine Meinung.", "Erzähle von deinem letzten Urlaub.", "Wie sieht für dich die perfekte Firma aus?"].concat(prompts.map((p) => `Erzähle mit eigenen Worten: „${p}“`));
    let topic = topics[Math.floor(Math.random() * topics.length)];
    m.innerHTML = `<div class="uhead"><div><div class="kicker">Output</div><h1>Freies Sprechen</h1><div class="muted">90 Sekunden zu einem Thema – ohne Pause. Ziel B2: 90+ Wörter.</div></div></div>
      <div class="panel"><p style="font-size:18px;margin:4px 0"><b id="topic">${esc(topic)}</b></p><div class="toolbar"><button class="btn" id="newt">🎲 Anderes Thema</button></div>
      <div class="toolbar"><button class="mic btn big" id="fs">🎤 Start</button><span class="bigtimer" id="tm">1:30</span><span class="muted" id="wc">0 Wörter</span><button class="btn" id="cp">📋 Für Feedback kopieren</button></div>
      <div class="live" id="live"><span class="muted">Dein gesprochener Text erscheint hier …</span></div>
      <p class="hint">Tipp: Kopiere den Text und lass ihn von einer KI oder einer Lehrkraft korrigieren. Mikrofon: Chrome/Edge.</p></div>`;
    $("#newt").onclick = () => { topic = topics[Math.floor(Math.random() * topics.length)]; $("#topic").textContent = topic; };
    let running = false, txt = "", left = 90, timer = null;
    const fs = $("#fs"), live = $("#live");
    const show = (t) => { live.textContent = t || "…"; $("#wc").textContent = A.norm(t || "").length + " Wörter"; };
    const stop = () => { running = false; clearInterval(timer); A.stopAll(); fs.classList.remove("rec"); fs.textContent = "🎤 Start"; };
    fs.onclick = async () => {
      if (running) return stop();
      if (!A.SR) return A.toast(A.micErr("unsupported"));
      A.stopAll(); running = true; txt = ""; left = 90; $("#tm").textContent = A.fmtTime(left); show(""); fs.classList.add("rec"); fs.textContent = "● Stopp";
      timer = setInterval(() => { left--; $("#tm").textContent = A.fmtTime(Math.max(0, left)); if (left <= 0) stop(); }, 1000);
      while (running && left > 0) {
        try { const t = await A.listen("de", { continuous: true, onInterim: (x) => show((txt + " " + x).trim()) }); txt = (txt + " " + t).trim(); show(txt); }
        catch (e) { if (e === "no-speech" || e === "aborted") continue; A.toast(A.micErr(e)); stop(); }
      }
    };
    $("#cp").onclick = () => { const t = `Bitte korrigiere meinen gesprochenen Text (Deutsch, B2) und gib mir drei Tipps:\n\nThema: ${topic}\n\n${txt || live.textContent}`; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => A.toast("Kopiert!"), () => A.toast("Kopieren nicht möglich.")); };
  };

  /* ---------- settings ---------- */
  V.settings = (m) => {
    const p = A.prefs(), dv = A.voicesFor("de")[0], ev = A.voicesFor("en")[0];
    m.innerHTML = `<div class="uhead"><div><div class="kicker">App</div><h1>Einstellungen</h1></div></div>
      <div class="panel"><h3>Lernziele <small>Daily goals</small></h3>
        <div class="toolbar"><label class="tog">Shadowing pro Tag (Minuten, min. 5) <input class="input" style="width:80px" type="number" min="5" max="60" id="smin" value="${p.shadowMin}"></label></div>
        <div class="toolbar"><label class="tog">Neue Wörter pro Tag <input class="input" style="width:80px" type="number" min="0" max="100" id="nw" value="${p.newPerDay}"></label></div>
        <div class="toolbar"><label class="tog">Neue Shadowing-Sätze pro Tag <input class="input" style="width:80px" type="number" min="0" max="60" id="ns" value="${p.newShadowPerDay}"></label></div>
      </div>
      <div class="panel"><h3>Technik <small>Setup</small></h3>
        <div class="note ${dv ? "" : "warn"}">Deutsche Stimme: <b>${dv ? esc(dv.name) : "nicht gefunden"}</b> · English voice: <b>${ev ? esc(ev.name) : "not found"}</b>${dv ? "" : " – installiere eine deutsche Stimme (Windows: Zeit & Sprache → Sprache · macOS: Bedienungshilfen → Gesprochene Inhalte) oder nutze Chrome/Edge."}</div>
        <div class="toolbar"><button class="btn primary" id="ttsDe">🔊 Deutsch testen</button><button class="btn" id="ttsEn">🔊 English test</button><span class="muted" id="ttsRes"></span></div>
        <p class="hint">Stimmen auf diesem Gerät: ${A.voicesFor("de").length} deutsch, ${A.voicesFor("en").length} englisch.</p>
        <div class="note">Kein Ton auf dem Handy? <b>iPhone:</b> Stummschalter an der Seite aus, Lautstärke hoch, Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch laden. <b>Android:</b> Einstellungen → Sprachausgabe (Text-to-Speech) → Google-Sprachausgabe → Deutsch installieren.</div>
        <div class="note ${A.SR ? "" : "warn"}">Spracherkennung: <b>${A.SR ? "verfügbar" : "nicht verfügbar"}</b>. Am besten in Chrome oder Edge über <code>http://localhost</code> (siehe README).</div>
      </div>
      <div class="panel"><h3>Fortschritt <small>Progress</small></h3><p class="muted">Dein Fortschritt wird nur in diesem Browser gespeichert. Exportiere ihn als Backup oder für ein anderes Gerät.</p>
        <div class="toolbar"><button class="btn" id="exp">⬇ Exportieren</button><label class="btn">⬆ Importieren<input type="file" id="imp" accept="application/json" hidden></label><button class="btn" id="reset">Alles zurücksetzen</button></div></div>`;
    const test = (lang, text) => async () => {
      $("#ttsRes").textContent = "…";
      const r = await A.sayNow(text, lang);
      $("#ttsRes").textContent = r && r.ok ? "✓ Ton funktioniert" : A.ttsBlocked ? "✖ vom Browser blockiert – nochmal tippen" : "✖ kein Ton – siehe Hinweise unten";
    };
    $("#ttsDe").onclick = test("de", "Hallo! Wenn du mich hörst, funktioniert die Sprachausgabe.");
    $("#ttsEn").onclick = test("en", "Hello! If you can hear me, speech output works.");
    const num = (id, key, min) => ($("#" + id).onchange = (e) => { const v = Math.max(min, Math.min(+e.target.max, +e.target.value || min)); e.target.value = v; A.setPref(key, v); A.renderChrome(); });
    num("smin", "shadowMin", 5); num("nw", "newPerDay", 0); num("ns", "newShadowPerDay", 0);
    $("#exp").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(A.S, null, 1)], { type: "application/json" })); a.download = "learningde-progress-" + A.today() + ".json"; a.click(); };
    $("#imp").onchange = (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { try { const s = JSON.parse(t); if (!s.words) throw new Error(); A.S = Object.assign(A.load(), s); A.save(); A.toast("Importiert!"); A.renderChrome(); A.route(); } catch (err) { A.toast("Ungültige Datei."); } }); };
    $("#reset").onclick = () => { if (confirm("Gesamten Fortschritt löschen?")) { A.S = { words: {}, shadow: {}, days: {}, scores: {}, notebook: [], prefs: A.S.prefs }; A.save(); A.renderChrome(); A.route(); } };
  };

  /* ---------- lock screen ---------- */
  V.locked = (m) => {
    m.innerHTML = `<div class="panel lock"><div class="big">🔒</div><h1>Erst Shadowing, dann der Rest</h1>
      <p class="muted">Jeden Tag mindestens ${A.prefs().shadowMin} Minuten aktives Shadowing – danach ist alles freigeschaltet.<br>First shadow for ${A.prefs().shadowMin} minutes, then everything unlocks.</p>
      <div class="timer-ring" style="--p:${Math.round((100 * A.day().sh) / A.gate.need())}">${A.fmtTime(A.gate.left())}</div>
      <a class="btn primary big" href="#/shadow">🎧 Shadowing starten</a></div>`;
  };
})();
