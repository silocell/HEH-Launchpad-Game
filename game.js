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
const MAX_LIVES   = 5;
const POWER_EVERY = 4;      /* correct answers between pick-ups */

/* Earned by playing, and that is the whole list. No coins, no shop, no
   advert you have to watch to carry on, no "continue for 99p" when you
   die. A game for a school should not teach anybody that losing is a
   thing you can pay to undo. */
const POWERS = [
  { key:"shield", word:"SHIELD", colour:"#6ea8ff", weight:3,
    says:"Shield up \u2014 it'll take the next wrong one" },
  { key:"slow",   word:"SLOW",   colour:"#3ddc97", weight:3,
    says:"Slowed down \u2014 more time to think" },
  { key:"double", word:"x2",     colour:"#ffc857", weight:2,
    says:"Double points for the next five" },
  { key:"fifty",  word:"50:50",  colour:"#c79bff", weight:3,
    says:"One wrong gate taken away on the next one" },
  { key:"heart",  word:"+LIFE",  colour:"#ff8fa3", weight:1,
    says:"An extra life" }
];

const el = (id) => document.getElementById(id);
const ask = el("ask"), sub = el("sub"), flash = el("flash");
const scoreEl = el("score"), livesEl = el("lives"), powersEl = el("powers");

let renderer, scene, camera, player, glow, gateSet = [];
let running = false, speed = START_SPEED, score = 0, lives = LIVES;
let lane = 1, laneX = 0, question = null, subject = "maths", judged = false;
let orb = null, orbLane = 0, orbPower = null, sinceOrb = 0;
let blocks = null; const blockAt = []; const BLOCKS = 44;
let dashes = null; const dashAt = []; const DASHES = 40;
const _flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2, 0, 0));
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion();
let shield = false, doubleLeft = 0, fiftyNext = false;
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
  g.strokeStyle = "rgba(27,36,48,.35)";
  g.lineWidth = 8;
  const r = 22, w = canvas.width-12, h = canvas.height-12;
  g.beginPath();
  g.moveTo(6+r,6); g.lineTo(6+w-r,6); g.quadraticCurveTo(6+w,6,6+w,6+r);
  g.lineTo(6+w,6+h-r); g.quadraticCurveTo(6+w,6+h,6+w-r,6+h);
  g.lineTo(6+r,6+h); g.quadraticCurveTo(6,6+h,6,6+h-r);
  g.lineTo(6,6+r); g.quadraticCurveTo(6,6,6+r,6);
  g.closePath(); g.fill(); g.stroke();

  g.fillStyle = "#17202b";
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
    new THREE.MeshLambertMaterial({ color: 0xe6ebf1 }));
  post.position.y = -1.6;
  mesh.add(post);
  mesh.position.y = 1.7;
  scene.add(mesh);
  return { mesh, canvas, tex };
}

function makeOrb(){
  const canvas = labelCanvas();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.35),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, canvas, tex };
}

function pickPower(){
  let total = 0;
  for (const p of POWERS) total += p.weight;
  let n = Math.random() * total;
  for (const p of POWERS){
    n -= p.weight;
    if (n <= 0) return p;
  }
  return POWERS[0];
}

/* Spawned half way between here and the gates, so it lands in the gap
   AFTER one question and BEFORE the next. Putting it level with the
   gates would have meant choosing between the power-up and the right
   answer, which is not a decision, it is a punishment. */
function spawnOrb(){
  orbPower = pickPower();
  orbLane = Math.floor(Math.random()*3);
  drawLabel(orb.canvas, orbPower.word, orbPower.colour);
  orb.tex.needsUpdate = true;
  orb.mesh.position.set(LANES[orbLane], 1.5, SPAWN_Z/2);
  orb.mesh.visible = true;
}

function takePower(p){
  if (p.key === "shield") shield = true;
  else if (p.key === "slow")   speed = Math.max(START_SPEED, speed - 9);
  else if (p.key === "double") doubleLeft = 5;
  else if (p.key === "fifty")  fiftyNext = true;
  else if (p.key === "heart")  lives = Math.min(MAX_LIVES, lives + 1);
  paintLives();
  paintPowers();
  say("<b>" + p.word + "</b><br>" + p.says);
}

function paintLives(){
  livesEl.textContent = "\u2665".repeat(Math.max(0,lives)) +
    "\u00b7".repeat(Math.max(0, LIVES - lives));
}

function paintPowers(){
  const bits = [];
  if (shield) bits.push("SHIELD");
  if (doubleLeft > 0) bits.push("x2 \u00d7" + doubleLeft);
  if (fiftyNext) bits.push("50:50");
  powersEl.textContent = bits.join("  \u00b7  ");
  powersEl.hidden = bits.length === 0;
}

function setQuestion(){
  question = QUIZ.next(subject, Math.floor(score/6));
  ask.textContent = question.text;
  sub.textContent = "";
  judged = false;
  /* 50:50 takes one wrong gate away. The blank one is still a wrong
     gate if you drive into it - it just stops pretending to be a
     choice. */
  let blanked = -1;
  if (fiftyNext){
    const wrong = question.options
      .map((o, i) => (o === question.answer ? -1 : i)).filter((i) => i >= 0);
    blanked = wrong[Math.floor(Math.random()*wrong.length)];
    fiftyNext = false;
    paintPowers();
  }

  question.options.forEach((opt, i) => {
    drawLabel(gateSet[i].canvas, i === blanked ? "\u2014" : opt,
              i === blanked ? "#c6cdd6" : "#ffffff");
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
    const worth = doubleLeft > 0 ? 2 : 1;
    if (doubleLeft > 0) doubleLeft--;
    score += worth;
    scoreEl.textContent = score;
    speed = Math.min(MAX_SPEED, speed + 1.3);
    paintPowers();
    say(worth > 1 ? "<b>Yes</b> ×2" : "<b>Yes</b>");

    sinceOrb++;
    if (sinceOrb >= POWER_EVERY && !orb.mesh.visible){ sinceOrb = 0; spawnOrb(); }
  } else if (shield){
    /* Earned, so it should feel earned: no life lost, no slowdown, and
       it says what it just did for you - and still teaches the answer,
       because that is the point of the game. */
    shield = false;
    paintPowers();
    say("<b>Shield took that one</b> — it was <b>" + question.answer + "</b>" +
        (question.note ? "<br>" + question.note : ""), true);
  } else {
    lives--;
    paintLives();
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
  /* The sky is a CSS gradient on the page, with the canvas transparent
     over it. Measured both ways on 21 Oct 2026: as a background texture
     it cost about five frames a second, because a texture stretched
     across the whole screen is a texture lookup for every pixel on the
     screen. The gradient is drawn once by the browser and never again. */
  scene.fog = new THREE.Fog(0xffd9a0, 40, 108);

  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1dd, 1.5);
  sun.position.set(-6, 10, 4);
  scene.add(sun);

  camera = new THREE.PerspectiveCamera(66, innerWidth/innerHeight, 0.1, 115);
  camera.position.set(0, 3.5, 7.6);
  camera.lookAt(0, 1.4, -16);

  /* Something to run over. Without it the track hangs in a void, which
     is the look this is getting away from. Flat, not lit: it fills most
     of the screen, and a flat green field under an overhead sun looks
     the same shaded or not. */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshBasicMaterial({ color: 0x8fd46a }));
  ground.rotation.x = -Math.PI/2;
  ground.position.set(0, -0.06, -58);
  scene.add(ground);

  /* Flat colour, no texture. The road fills a huge part of the screen,
     and a repeating texture on it meant a texture lookup for every one
     of those pixels - measured at about four frames a second. The lane
     markings are separate geometry instead, which covers a fraction of
     the pixels and is one draw call for the lot. */
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(19, 150),
    new THREE.MeshBasicMaterial({ color: 0x5a6b7d }));
  road.rotation.x = -Math.PI/2;
  road.position.z = -58;
  scene.add(road);

  const dashGeo = new THREE.PlaneGeometry(0.34, 4.2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf4f7fb });
  dashes = new THREE.InstancedMesh(dashGeo, dashMat, DASHES);
  dashes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < DASHES; i++){
    dashAt[i] = { x: (i % 2 ? 2.8 : -2.8), z: -Math.floor(i/2) * 8 };
  }
  scene.add(dashes);
  placeDashes();

  /* Edge rails and the stripes that give you a sense of speed - without
     something passing you, 60 units a second looks like standing still. */
  [-9.5, 9.5].forEach((x) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.5, 150),
      new THREE.MeshBasicMaterial({ color: 0xeef3f8 }));
    rail.position.set(x, 0.25, -58);
    scene.add(rail);
  });

  /* A group, not a rotated mesh with rotated children. A child inherits
     its parent's turn, so hanging a nose cone off a body that is itself
     tipped ninety degrees sent the nose straight up in the air - the
     same trap the ground shadow fell into earlier. Each part is placed
     in the group and turned on its own. */
  player = new THREE.Group();
  player.position.set(0, 0.72, 0);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1.3, 4, 14),
    new THREE.MeshLambertMaterial({ color: 0xff5a5f }));
  body.rotation.x = Math.PI/2;
  player.add(body);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.44, 0.85, 14),
    new THREE.MeshLambertMaterial({ color: 0xffd166 }));
  nose.rotation.x = -Math.PI/2;      /* tip towards -z, down the track */
  nose.position.z = -1.22;
  player.add(nose);

  const fin = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.42, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xffd166 }));
  fin.position.set(0, 0.38, 0.72);
  player.add(fin);
  scene.add(player);

  /* Not a child of the player: the player is turned on its nose to
     point down the track, and a child inherits that, so the glow ended
     up standing on its edge instead of lying on the ground. */
  glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 18),
    new THREE.MeshBasicMaterial({ color: 0x1b2430, transparent: true, opacity: 0.17 }));
  glow.rotation.x = -Math.PI/2;
  glow.position.set(0, 0.03, 0);
  scene.add(glow);

  /* Blocks whipping past on both sides - what actually sells speed.
     One InstancedMesh, so the whole lot is a single draw call however
     many there are; eighty separate meshes would have been eighty. */
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const blockMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  blocks = new THREE.InstancedMesh(blockGeo, blockMat, BLOCKS);
  blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const tint = new THREE.Color();
  for (let i = 0; i < BLOCKS; i++){
    const side = i % 2 ? 1 : -1;
    blockAt[i] = {
      x: side * (15 + Math.random()*20),
      z: -Math.random()*132,
      w: 2 + Math.random()*5,
      h: 3 + Math.random()*16,
      d: 2 + Math.random()*5
    };
    /* Right round the wheel rather than one shade of beige - a city
       of identical blocks is just a wall. */
    tint.setHSL(Math.random(), 0.35 + Math.random()*0.3, 0.6 + Math.random()*0.22);
    blocks.setColorAt(i, tint);
  }
  scene.add(blocks);
  placeBlocks();

  for (let i = 0; i < 3; i++) gateSet.push(makeGate());
  orb = makeOrb();
}

function placeDashes(){
  for (let i = 0; i < DASHES; i++){
    const d = dashAt[i];
    _v.set(1, 1, 1);
    _m.compose(new THREE.Vector3(d.x, 0.02, d.z), _flat, _v);
    dashes.setMatrixAt(i, _m);
  }
  dashes.instanceMatrix.needsUpdate = true;
}

function placeBlocks(){
  for (let i = 0; i < BLOCKS; i++){
    const b = blockAt[i];
    _v.set(b.w, b.h, b.d);
    _m.compose(new THREE.Vector3(b.x, b.h/2 - 0.06, b.z), _q, _v);
    blocks.setMatrixAt(i, _m);
  }
  blocks.instanceMatrix.needsUpdate = true;
}

let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;
  if (!running) { renderer.render(scene, camera); return; }

  const move = speed * dt;

  for (let i = 0; i < DASHES; i++){
    const d = dashAt[i];
    d.z += move;
    if (d.z > 14) d.z -= DASHES/2 * 8;
  }
  placeDashes();

  for (let i = 0; i < BLOCKS; i++){
    const b = blockAt[i];
    b.z += move;
    if (b.z > 18){
      b.z -= 150;
      b.h = 3 + Math.random()*16;
      b.x = (i % 2 ? 1 : -1) * (15 + Math.random()*20);
    }
  }
  placeBlocks();

  for (const g of gateSet) g.mesh.position.z += move;

  if (orb.mesh.visible){
    orb.mesh.position.z += move;
    orb.mesh.rotation.y = Math.sin(now/300) * 0.4;
    if (orb.mesh.position.z >= JUDGE_Z){
      orb.mesh.visible = false;
      if (lane === orbLane) takePower(orbPower);
    }
  }

  if (!judged && gateSet[0].mesh.position.z >= JUDGE_Z) judge();
  if (gateSet[0].mesh.position.z > 14) for (const g of gateSet) g.mesh.visible = false;

  /* Slide rather than snap, and bank into the turn. */
  const target = LANES[lane];
  laneX += (target - laneX) * Math.min(1, dt*11);
  player.position.x = laneX;
  glow.position.x = laneX;
  player.rotation.z = (target - laneX) * 0.5;
  /* A little bob, so it reads as moving rather than sliding. */
  player.position.y = 0.72 + Math.sin(now/110) * 0.07;
  camera.position.x += (laneX*0.42 - camera.position.x) * Math.min(1, dt*5);

  renderer.render(scene, camera);
}

function start(){
  el("startSheet").classList.remove("on");
  el("overSheet").classList.remove("on");
  running = true; score = 0; lives = LIVES; speed = START_SPEED; lane = 1; laneX = 0;

  /* Everything earned last time goes. Without this a shield picked up
     in one game was still sitting there at the start of the next, and
     so was any x2 left over - which quietly made the second run of the
     evening easier than the first. */
  shield = false; doubleLeft = 0; fiftyNext = false; sinceOrb = 0;
  if (orb) orb.mesh.visible = false;
  /* And the questions start forgetting from scratch, or a new game
     opens by refusing everything the last one already asked. */
  if (QUIZ.reset) QUIZ.reset();

  scoreEl.textContent = "0";
  paintLives();
  paintPowers();
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
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true,
                                       powerPreference: "high-performance" });
  renderer.setClearAlpha(0);
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
  get shield(){ return shield; },
  get doubleLeft(){ return doubleLeft; },
  get orbVisible(){ return orb && orb.mesh.visible; },
  get orbLane(){ return orbLane; },
  get orbPower(){ return orbPower && orbPower.key; },
  orbZ: () => orb && orb.mesh.position.z,
  giveOrb: (key) => { orbPower = POWERS.find(p => p.key === key); orbLane = lane;
    drawLabel(orb.canvas, orbPower.word, orbPower.colour); orb.tex.needsUpdate = true;
    orb.mesh.position.set(LANES[orbLane], 1.5, -12); orb.mesh.visible = true; },
  moveTo: moveTo,
  gateZ: () => gateSet[0] && gateSet[0].mesh.position.z,
  /* How much the graphics card is asked to do per frame. Unlike a
     frame rate this means the same thing on every machine. */
  scene: () => scene,
  renderer: () => renderer,
  drawCalls: () => renderer.info.render.calls,
  triangles: () => renderer.info.render.triangles
};

el("startBtn").addEventListener("click", start);
el("againBtn").addEventListener("click", start);
