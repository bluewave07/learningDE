/* Router, navigation, header and the daily shadowing gate. */
(function () {
  "use strict";
  const A = window.App, { $, esc } = A;
  const OPEN = new Set(["home", "shadow", "settings"]);

  const NAV = [
    ["Heute", [["home", "⌂", "Übersicht", "Today"], ["shadow", "🎧", "Shadowing", "Daily · required"], ["learn", "↻", "Wiederholen", "Review & new words"]]],
    ["Üben", [["themes", "📚", "Themen", "3.000 words"], ["stories", "📖", "Geschichten", "Stories"], ["convs", "💬", "Gespräche", "Role-play"], ["speak", "🎤", "Freies Sprechen", "Free speaking"], ["notebook", "📝", "Satzbuch", "Saved sentences"]]],
    ["Prüfen", [["test", "★", "Gemischter Test", "Mixed test"], ["search", "🔎", "Suche", "Dictionary"], ["settings", "⚙", "Einstellungen", "Settings"]]]
  ];

  A.renderChrome = () => {
    const view = (location.hash.replace(/^#\/?/, "").split("/")[0]) || "home";
    const done = A.gate.done();
    $("#nav").innerHTML = NAV.map(([h, items]) => `<div class="navhead">${h}</div>` + items.map(([id, ic, t, s]) => {
      const locked = !done && !OPEN.has(id);
      const on = view === id || (id === "themes" && (view === "theme" || view === "lesson"));
      return `<a class="navi ${on ? "on" : ""} ${locked ? "locked" : ""}" href="#/${id}"><span class="ic">${locked ? "🔒" : ic}</span><span>${t}<small>${s}</small></span></a>`;
    }).join("")).join("");
    const gb = $("#gatebar");
    gb.className = "gatebar" + (done ? " done" : "");
    gb.textContent = done ? "✓ Shadowing erledigt" : `🎧 Shadowing: noch ${A.fmtTime(A.gate.left())}`;
    gb.href = "#/shadow";
    $("#streak").textContent = "🔥 " + A.streak();
    const p = A.prefs();
    document.querySelectorAll("#langSeg button").forEach((b) => b.classList.toggle("on", b.dataset.l === p.lang));
    $("#rate").value = p.rate; $("#rateV").textContent = Math.round(p.rate * 100) + "%";
  };

  A.route = () => {
    window.onkeydown = null; A.stopAll(); A.closePop();
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    let view = parts[0] || "home";
    if (!A.views[view]) view = "home";
    const main = $("#main");
    if (!A.gate.done() && !OPEN.has(view)) A.views.locked(main);
    else A.views[view](main, parts.slice(1));
    A.renderChrome();
    window.scrollTo(0, 0);
  };

  function initHeader() {
    document.querySelectorAll("#langSeg button").forEach((b) => (b.onclick = () => { A.setPref("lang", b.dataset.l); A.renderChrome(); A.route(); }));
    $("#rate").oninput = (e) => { A.setPref("rate", +e.target.value); $("#rateV").textContent = Math.round(+e.target.value * 100) + "%"; };
  }

  document.addEventListener("gate-open", () => {
    A.toast("🎉 Tagesziel erreicht! Alles ist freigeschaltet.");
    A.renderChrome();
  });
  setInterval(() => { if (!A.gate.done()) A.renderChrome(); }, 5000);
  document.addEventListener("voices", () => { if ((location.hash || "").includes("settings")) A.route(); });
  window.addEventListener("hashchange", A.route);
  initHeader();
  A.route();
})();
