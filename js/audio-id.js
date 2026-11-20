/* Stable id for a spoken text – used for the pre-generated audio files (audio/de/<id>.mp3).
   Shared by the browser and by scripts/audio-manifest.mjs, so both always agree. */
(function (g) {
  "use strict";
  function fnv(str, seed) {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, "0");
  }
  g.audioId = (text) => { const t = String(text).normalize("NFC").trim(); return fnv(t, 0x811c9dc5) + fnv(t, 0x01000193 ^ t.length); };
})(typeof window !== "undefined" ? window : globalThis);
