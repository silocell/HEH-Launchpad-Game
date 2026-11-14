/* Gate Run sounds - all made live, no files. Starts after the first tap
   (phones insist); the speaker button turns it off and that's remembered.
   GPL-3.0, like the game. */
(function () {
  "use strict";
  var on = true; try { on = localStorage.getItem("hl.gate.sound") !== "off"; } catch (e) {}
  var ac = null, out = null;
  function audio() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return ac; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); out = ac.createGain(); out.gain.value = .8; out.connect(ac.destination); } catch (e) { ac = null; }
    return ac;
  }
  ["pointerdown", "keydown"].forEach(function (ev) { addEventListener(ev, function () { if (on) audio(); }, { passive: true, capture: true }); });
  document.addEventListener("visibilitychange", function () { if (ac) { if (document.hidden) ac.suspend(); else ac.resume(); } });
  function note(f, d, type, vol, when, slide) {
    if (!on || !audio()) return;
    try {
      var t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol || .08, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .02);
    } catch (e) {}
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function buzz(p) { try { if (on && navigator.vibrate && matchMedia("(pointer:coarse)").matches) navigator.vibrate(p); } catch (e) {} }
  window.GRSound = {
    right: function (streak) { var b = 72 + Math.min(streak || 0, 14); note(mtof(b), .12, "triangle", .07); note(mtof(b + 7), .18, "triangle", .05, .06);
      if (streak && streak % 5 === 0) [0, 4, 7, 12].forEach(function (n, i) { note(mtof(76 + n), .14, "square", .035, .15 + i * .06); }); },
    wrong: function () { note(220, .2, "sawtooth", .05, 0, 110); note(147, .3, "sine", .07, .08); buzz(60); },
    shield: function () { note(300, .3, "triangle", .07, 0, 900); buzz(25); },
    power: function () { [0, 4, 7, 12].forEach(function (n, i) { note(mtof(74 + n), .12, "square", .04, i * .05); }); buzz(15); },
    tier: function () { [0, 7, 12, 16].forEach(function (n, i) { note(mtof(67 + n), .22, "triangle", .06, i * .09); }); },
    over: function () { [0, -3, -7, -12].forEach(function (n, i) { note(mtof(64 + n), .35, "triangle", .06, i * .16); }); buzz([80, 40, 120]); },
    start: function () { note(mtof(72), .1, "square", .045); note(mtof(79), .18, "square", .045, .1); }
  };
  function button() {
    var b = document.createElement("button"); b.type = "button"; b.id = "sndBtn";
    b.style.cssText = "position:fixed;z-index:6;left:78px;bottom:14px;width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:22px;" +
      "color:var(--ink);background:var(--card);border:0;cursor:pointer;box-shadow:0 3px 0 var(--lift)";
    function paint() { b.textContent = on ? "🔊" : "🔇"; b.title = on ? "Sound on" : "Sound off"; b.setAttribute("aria-label", b.title); }
    b.onclick = function () { on = !on; try { localStorage.setItem("hl.gate.sound", on ? "on" : "off"); } catch (e) {} paint(); if (on) GRSound.start(); };
    paint(); document.body.appendChild(b);
  }
  if (document.body) button(); else addEventListener("DOMContentLoaded", button);
})();
