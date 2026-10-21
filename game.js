/*  Gate Run - a 3d maths and English game.
 *  Copyright (C) 2026  Shiv (silocell)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/* ====================================================================
   GATE RUN  -  the 3d bit.

   The rule this is built around: the 3d has to be the game, not a
   decoration behind a quiz. So the answering IS the steering. You are
   not picking button B, you are moving into a lane before you arrive,
   while the track speeds up. That is why it is worth doing in 3d at
   all; a spinning cube behind a multiple-choice box would not be.

   Built to run on a school laptop: no shadows, no post-processing, flat
   colours, a few dozen objects in total, and the pixel ratio capped so
   a retina screen does not quietly ask for four times the pixels.
   ==================================================================== */
import * as THREE from "three";

/* Wider than the gates, so there is a visible gap to aim at rather
   than one continuous wall of answers. */
const LANES = [-5.6, 0, 5.6];
const START_SPEED = 21;
const MAX_SPEED   = 52;
/* Close enough that the answers are readable for most of the run-up.
   At 150 they were a smudge on the horizon until the last moment, which
   made it a reaction test rather than a maths one. */
const SPAWN_Z     = -96;    /* where a set of gates appears */
const JUDGE_Z     = 1.5;    /* where it counts as passed */
const LIVES       = 3;

const el = (id) => document.getElementById(id);
const ask = el("ask"), sub = el("sub"), flash = el("flash");
const scoreEl = el("score"), livesEl = el("lives");

let renderer, scene, camera, player, glow, roadTex, gateSet = [];
let running = false, speed = START_SPEED, score = 0, lives = LIVES;
let lane = 1, laneX = 0, question = null, subject = "maths", judged = false;
let best = 0;

/* ---------- a label, drawn flat then hung in the world ----------
   Canvas text keeps its own resolution, so the gate reads cleanly at a
   distance instead of turning to mush like geometry-built letters. */
const labelCanvas = () => {
  const c = document.createElement("canvas");
  /* 4:3, matching the panel it goes on, or the text comes out stretched. */
  c.width = 640; c.height = 333;
  return c;
};
function drawLabel(canvas, text, colour){
  const g = canvas.getContext("2d");
  g.clearRect(0,0,canvas.width,canvas.height);
  g.fillStyle = colour;
  g.strokeStyle = "rgba(255,255,255,.75)";
  g.lineWidth = 6;
  const r = 22, w = canvas.width-12, h = canvas.height-12;
  g.beginPath();
  g.moveTo(6+r,6); g.lineTo(6+w-r,6); g.quadraticCurveTo(6+w,6,6+w,6+r);
  g.lineTo(6+w,6+h-r); g.quadraticCurveTo(6+w,6+h,6+w-r,6+h);
  g.lineTo(6+r,6+h); g.quadraticCurveTo(6,6+h,6,6+h-r);
  g.lineTo(6,6+r); g.quadraticCurveTo(6,6,6+r,6);
  g.closePath(); g.fill(); g.stroke();

  g.fillStyle = "#07101f";
  g.textAlign = "center"; g.textBaseline = "middle";
  let size = 150;
  do { g.font = "800 " + size + "px 'Bricolage Grotesque', Trebuchet MS, sans-serif"; size -= 4; }
  while (g.measureText(text).width > canvas.width - 56 && size > 26);
  g.fillText(text, canvas.width/2, canvas.height/2 + 4);
}

function makeGate(){
  const canvas = labelCanvas();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  /* Big. The deciding case is a spelling question, where the three
     answers differ by one letter - 'definately' against 'definitely'.
     If that is not readable with room to spare, the game is a guess. */
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.6), mat);
  /* A post under each gate, so it reads as standing on the track
     rather than floating in the dark. */
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 2.2, 0.16),
    new THREE.MeshBasicMaterial({ color: 0x2b3650 }));
  post.position.y = -1.6;
  mesh.add(post);
  mesh.position.y = 1.7;
  scene.add(mesh);
  return { mesh, canvas, tex };
}

function setQuestion(){
  question = QUIZ.next(subject, Math.floor(score/6));
  ask.textContent = question.text;
  sub.textContent = "";
  judged = false;
  question.options.forEach((opt, i) => {
    drawLabel(gateSet[i].canvas, opt, "#eef1f7");
    gateSet[i].tex.needsUpdate = true;
    gateSet[i].mesh.position.set(LANES[i], 1.7, SPAWN_Z);
    gateSet[i].mesh.visible = true;
  });
}

function say(html, wrong){
  flash.innerHTML = html;
  flash.className = "on" + (wrong ? " wrong" : "");
  clearTimeout(say._t);
  say._t = setTimeout(() => { flash.className = ""; }, wrong ? 2200 : 700);
}

function judge(){
  judged = true;
  const chosen = question.options[lane];
  if (chosen === question.answer){
    score++;
    scoreEl.textContent = score;
    speed = Math.min(MAX_SPEED, speed + 1.3);
    say("<b>Yes</b>");
  } else {
    lives--;
    livesEl.textContent = "♥".repeat(Math.max(0,lives)) + "·".repeat(LIVES-Math.max(0,lives));
    speed = Math.max(START_SPEED, speed - 5);
    /* The teaching moment. A game that only says "wrong" teaches
       nothing, so this is the whole reason the questions carry a note. */
    say("<b>" + chosen + "</b> — it was <b>" + question.answer + "</b>" +
        (question.note ? "<br>" + question.note : ""), true);
    if (lives <= 0) return gameOver();
  }
  /* After a wrong one, wait. The explanation is on screen for two
     seconds and the next set of gates was arriving while you were still
     reading it - which at full speed means getting the next one wrong
     because you were learning why you got the last one wrong. */
  setTimeout(() => { if (running) setQuestion(); }, chosen === question.answer ? 120 : 1100);
}

function gameOver(){
  running = false;
  if (score > best){ best = score; try { localStorage.setItem("gr-best", String(best)); } catch(e){} }
  el("overScore").textContent = score;
  el("overBest").textContent = best;
  el("overTitle").textContent = score >= best && score > 0 ? "New best" : "Out of lives";
  el("overLede").textContent = score === 0
    ? "That one got away. The first few are gentle — go again."
    : "You cleared " + score + " gate" + (score===1?"":"s") + ".";
  el("overNote").textContent = "";
  el("overSheet").classList.add("on");
  saveScore(score);
}

/* ---------- input ---------- */
function moveTo(n){ lane = Math.max(0, Math.min(2, n)); }
addEventListener("keydown", (e) => {
  if (!running) {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); start(); }
    return;
  }
  if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") moveTo(lane-1);
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") moveTo(lane+1);
});
addEventListener("pointerdown", (e) => {
  if (!running) return;
  const third = innerWidth/3;
  if (e.clientX < third) moveTo(lane-1);
  else if (e.clientX > innerWidth - third) moveTo(lane+1);
  else moveTo(1);
});

/* ---------- the world ---------- */
function build(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f18);
  scene.fog = new THREE.Fog(0x0b0f18, 34, 104);

  camera = new THREE.PerspectiveCamera(66, innerWidth/innerHeight, 0.1, 130);
  camera.position.set(0, 3.5, 7.6);
  camera.lookAt(0, 1.4, -16);

  /* The lane markings are painted into the road's texture and scrolled
     by moving the texture, rather than being 88 separate objects shoved
     forward one at a time. That was most of the frame: eighty-eight
     draw calls and eighty-eight position updates, every frame, to draw
     some dashes. This is one object and one number. */
  const rc = document.createElement("canvas");
  rc.width = 190; rc.height = 64;
  const rg = rc.getContext("2d");
  rg.fillStyle = "#121a2b"; rg.fillRect(0, 0, rc.width, rc.height);
  rg.fillStyle = "#33415f";
  for (const x of [-2.8, 2.8]) rg.fillRect((x + 9.5) * 10 - 1.5, 0, 3, 38);
  roadTex = new THREE.CanvasTexture(rc);
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 21);
  roadTex.colorSpace = THREE.SRGBColorSpace;

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(19, 150),
    new THREE.MeshBasicMaterial({ map: roadTex }));
  road.rotation.x = -Math.PI/2;
  road.position.z = -58;
  scene.add(road);

  /* Edge rails and the stripes that give you a sense of speed - without
     something passing you, 60 units a second looks like standing still. */
  [-9.5, 9.5].forEach((x) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.5, 150),
      new THREE.MeshBasicMaterial({ color: 0x2a3b52 }));
    rail.position.set(x, 0.25, -58);
    scene.add(rail);
  });

  player = new THREE.Mesh(
    new THREE.ConeGeometry(0.8, 1.8, 4),
    new THREE.MeshBasicMaterial({ color: 0x6ea8ff }));
  player.rotation.x = Math.PI/2;
  player.position.set(0, 0.9, 0);
  scene.add(player);

  /* Not a child of the player: the player is turned on its nose to
     point down the track, and a child inherits that, so the glow ended
     up standing on its edge instead of lying on the ground. */
  glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({ color: 0x6ea8ff, transparent: true, opacity: 0.16 }));
  glow.rotation.x = -Math.PI/2;
  glow.position.set(0, 0.03, 0);
  scene.add(glow);

  for (let i = 0; i < 3; i++) gateSet.push(makeGate());
}

let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;
  if (!running) { renderer.render(scene, camera); return; }

  const move = speed * dt;

  roadTex.offset.y -= move / 150 * 21;

  for (const g of gateSet) g.mesh.position.z += move;

  if (!judged && gateSet[0].mesh.position.z >= JUDGE_Z) judge();
  if (gateSet[0].mesh.position.z > 14) for (const g of gateSet) g.mesh.visible = false;

  /* Slide rather than snap, and bank into the turn. */
  const target = LANES[lane];
  laneX += (target - laneX) * Math.min(1, dt*11);
  player.position.x = laneX;
  glow.position.x = laneX;
  player.rotation.z = (target - laneX) * 0.5;
  camera.position.x += (laneX*0.42 - camera.position.x) * Math.min(1, dt*5);

  renderer.render(scene, camera);
}

function start(){
  el("startSheet").classList.remove("on");
  el("overSheet").classList.remove("on");
  running = true; score = 0; lives = LIVES; speed = START_SPEED; lane = 1; laneX = 0;
  scoreEl.textContent = "0";
  livesEl.textContent = "♥♥♥";
  setQuestion();
}

/* Coming back to the tab after a while must not teleport you through
   twenty gates on one enormous frame. */
/* Coming back to the tab must not teleport you through twenty gates on
   one enormous frame - but it must not throw the run away either, which
   is what losing a life for answering the door would feel like. The
   frame time is clamped below, so simply resetting the clock is enough. */
addEventListener("visibilitychange", () => { last = performance.now(); });
addEventListener("resize", () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- scores ---------- */
function saveScore(n){ window.__saveScore && window.__saveScore(n); }

/* ---------- go ---------- */
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  build();
  try { best = Number(localStorage.getItem("gr-best")) || 0; } catch(e){ best = 0; }
  el("best").textContent = best;
  window.__gateRunStarted = true;
  requestAnimationFrame(frame);
} catch (err){
  window.__gateRunStarted = true;
  const n = el("note");
  if (n){ n.textContent = "This device can't run the 3d game. Everything else on the site still works."; n.style.color = "var(--bad)"; }
  console.error(err);
}

document.querySelectorAll("#subjectRow button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#subjectRow button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    subject = b.dataset.subject;
  });
});
/* A seam for the tests, so a browser can actually play the game rather
   than only check that it drew something. It exposes the question that
   is already on screen and the lane the player is already in - nothing
   a person could not read off the screen anyway. */
window.__gr = {
  get question(){ return question; },
  get lane(){ return lane; },
  get score(){ return score; },
  get lives(){ return lives; },
  get running(){ return running; },
  get speed(){ return speed; },
  moveTo: moveTo,
  gateZ: () => gateSet[0] && gateSet[0].mesh.position.z,
  /* How much the graphics card is asked to do per frame. Unlike a
     frame rate this means the same thing on every machine. */
  drawCalls: () => renderer.info.render.calls,
  triangles: () => renderer.info.render.triangles
};

el("startBtn").addEventListener("click", start);
el("againBtn").addEventListener("click", start);
