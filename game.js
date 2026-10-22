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
/* It used to climb by a flat 1.3 a question to a top of 52, which is a
   straight line - and the questions get harder along a straight line
   too, so the two met near the end and nothing there was answerable.
   The gain now shrinks as it climbs: quick off the mark, a long
   plateau around CRUISE, then a crawl towards the ceiling that only a
   very long run ever reaches. */
const CRUISE_SPEED = 38;
const MAX_SPEED   = 44;
/* The real fix. Speeding up is only unfair if it eats your thinking
   time, so it is no longer allowed to: the question goes on screen
   first and the gates are held back until what is left of the run-up
   is worth this many seconds. You still go faster and faster; the
   stretch of open road in front of the next gates just gets longer to
   pay for it.

   And because the questions get harder as well, the harder ones buy
   more of it - that double squeeze was the thing that made the end
   impossible. */
const THINK_BASE  = 3.2;    /* seconds, at the easiest level */
const THINK_STEP  = 0.18;   /* added per difficulty level, up to four */
const LEAD_MAX    = 2.0;    /* longest stretch of empty road, in seconds */

/* The convoy. Every right answer in a row adds a car behind you and a
   wrong one scatters the lot - the one thing in the game you lose by
   being careless that is not a life, so there is something to protect
   even when you have hearts to spare. */
const CONVOY_MAX  = 5;
/* Wider apart than the cars are long, or the line reads as one long
   yellow slab rather than five cars. */
const CONVOY_GAP  = 1.45;
const CONVOY_Z0   = 2.2;
const CONFETTI    = 26;
/* Close enough that the answers are readable for most of the run-up.
   At 150 they were a smudge on the horizon until the last moment, which
   made it a reaction test rather than a maths one. */
const SPAWN_Z     = -96;    /* where a set of gates appears */
/* At the car's nose, not behind its back bumper. At 1.5 the gate had
   already passed through the car before it was judged, which gave a
   free window to change lanes after visibly driving through the wrong
   gate - 160ms of it at starting speed. */
const JUDGE_Z     = -1.4;
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
let ready = false;
let running = false, paused = false, speed = START_SPEED, score = 0, lives = LIVES;
/* A clock that only runs while the game does. setTimeout does not care
   that you have paused: the next question was arriving behind the pause
   screen, taking the explanation of the last one with it and moving the
   gates while you could not see them. Everything timed is measured
   against this instead, and it stops when the game stops. */
let gameClock = 0, nextAt = 0, flashUntil = 0, gatesAt = 0;
/* Correct answers, which is what difficulty now climbs with. It used
   to climb with the score - so an x2 pick-up, the reward for playing
   well, quietly brought the algebra forward by a couple of questions. */
let correct = 0;
let lane = 1, laneX = 0, question = null, subject = "maths", judged = false;
let orb = null, orbLane = 0, orbPower = null, sinceOrb = 0;
let blocks = null; const blockAt = []; const BLOCKS = 44;
let convoy = null, convoyTop = null, convoyN = 0, camBack = 0;
const convoyX = new Array(CONVOY_MAX).fill(0);
let confetti = null; const bits = []; let bitsShown = false;
let streak = 0, bestStreak = 0, shakeUntil = 0, lastTier = 0;
/* Asked their machine for less movement, so the camera does not get
   knocked about either. Read once - it is a setting, not a state. */
const calmer = typeof matchMedia === "function" &&
               matchMedia("(prefers-reduced-motion: reduce)").matches;
const wheels = [];
let dashes = null; const dashAt = []; const DASHES = 40;
const _flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2, 0, 0));
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _q = new THREE.Quaternion();
const _axis = new THREE.Vector3(0.4, 1, 0.6).normalize();
/* Reused rather than rebuilt: these two loops ran eighty-four times a
   frame and were making a fresh Vector3 every time. */
const _pos = new THREE.Vector3();
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
  /* Say what actually happened. Three of these can land when they have
     nothing to give - a second shield on top of one you are already
     holding, an extra life at five, a slow-down when you are already at
     the slowest - and announcing "Shield up" when nothing changed
     teaches somebody that the game lies to them. */
  let did = true;
  if (p.key === "shield"){ did = !shield; shield = true; }
  else if (p.key === "slow"){ did = speed > START_SPEED; speed = Math.max(START_SPEED, speed - 9); }
  else if (p.key === "double"){ doubleLeft = 5; }
  else if (p.key === "fifty"){ did = !fiftyNext; fiftyNext = true; }
  else if (p.key === "heart"){ did = lives < MAX_LIVES; lives = Math.min(MAX_LIVES, lives + 1); }
  paintLives();
  paintPowers();
  const spare = { shield: "You already have one", slow: "Already going as slow as it gets",
                  fifty: "You already have one", heart: "Already on full lives" };
  say("<b>" + p.word + "</b><br>" + (did ? p.says : (spare[p.key] || p.says)));
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

function level(){ return Math.floor(correct/7); }

/* How long the player should get, from the question appearing to the
   gate reaching the car. */
function thinkWanted(){
  return THINK_BASE + THINK_STEP * Math.min(4, level());
}

/* The question goes up now; the gates follow once the run-up left is
   short enough that the two together come to thinkWanted(). At the
   start there is no wait at all - the run-up alone is already worth
   four and a half seconds. */
function setQuestion(){
  question = QUIZ.next(subject, level());
  ask.textContent = question.text;
  sub.textContent = "";
  /* Stays judged until the gates are actually out there, or the frame
     loop would see the old set sitting past the car and judge a
     question nobody has been shown yet. */
  judged = true;
  for (const g of gateSet) g.mesh.visible = false;
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
  question.blanked = blanked;

  const runUp = (Math.abs(SPAWN_Z) - Math.abs(JUDGE_Z)) / speed;
  gatesAt = gameClock + Math.min(LEAD_MAX, Math.max(0.1, thinkWanted() - runUp));
}

function placeGates(){
  judged = false;
  const blanked = question.blanked;
  /* Back to plain white - the gate you drove through was tinted on
     the way past and these are the same three meshes reused. */
  for (const g of gateSet) g.mesh.material.color.setHex(0xffffff);
  question.options.forEach((opt, i) => {
    drawLabel(gateSet[i].canvas, i === blanked ? "\u2014" : opt,
              i === blanked ? "#c6cdd6" : "#ffffff");
    gateSet[i].tex.needsUpdate = true;
    gateSet[i].mesh.position.set(LANES[i], 1.7, SPAWN_Z);
    gateSet[i].mesh.visible = true;
  });
}

/* The bits that make it feel like something happened: the number
   punching, a +1 leaping off the gate, a knock when you get one
   wrong. None of it changes what the game does - all of it changes
   whether getting one right feels like anything. */
function replay(node, cls){
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth;          /* restart the animation */
  node.classList.add(cls);
}

function pop(text, good){
  const n = el("pop");
  if (!n) return;
  n.textContent = text;
  n.className = good ? "good" : "bad";
  replay(n, "go");
}

function paintStreak(){
  const n = el("streak");
  if (!n) return;
  if (streak < 3){ n.hidden = true; return; }
  n.hidden = false;
  n.textContent = streak + " IN A ROW";
  replay(n, "lit");
}

function tierBanner(){
  const n = el("tier");
  if (!n) return;
  n.textContent = "LEVEL " + (level()+1) + " \u2014 HARDER NOW";
  replay(n, "go");
}

function say(html, wrong){
  flash.innerHTML = html;
  flash.className = "on" + (wrong ? " wrong" : "");
  /* On the game clock, so pausing to read why you got one wrong does
     not make the reason disappear while you are reading it. */
  flashUntil = gameClock + (wrong ? 2.2 : 0.7);
}

function judge(){
  judged = true;
  /* A gate blanked by 50:50 shows a dash, so reporting the number that
     used to be printed on it - "48, it was 56" - names something the
     player never saw. */
  const chosen = (lane === question.blanked) ? "the blank gate" : question.options[lane];
  /* The gate itself goes green or red as it passes you. It is the
     thing you were looking at, so it is the thing that should
     answer. */
  const hit = gateSet[lane];
  if (hit) hit.mesh.material.color.setHex(chosen === question.answer ? 0x7dffb4 : 0xff8794);
  if (chosen === question.answer){
    const worth = doubleLeft > 0 ? 2 : 1;
    if (doubleLeft > 0) doubleLeft--;
    score += worth;
    correct++;
    streak++;
    if (streak > bestStreak) bestStreak = streak;
    scoreEl.textContent = score;
    replay(scoreEl, "punch");
    scoreEl.classList.toggle("hot", streak >= 5);
    pop("+" + worth, true);
    paintStreak();
    burst(LANES[lane], 1.7, JUDGE_Z);
    /* A car joins the line, up to the cap. */
    if (convoyN < CONVOY_MAX){ convoyX[convoyN] = laneX; convoyN++; }
    const wasTier = lastTier; lastTier = level();
    if (lastTier > wasTier) tierBanner();
    speed = Math.min(MAX_SPEED,
                     speed + Math.max(0.25, (CRUISE_SPEED - speed) * 0.11));
    paintPowers();
    /* No "Yes" card any more. The +1 leaping off the gate and the
       score punching say it already, and the card is wanted for the
       one thing only the card can do - telling you why you got one
       wrong. */

    sinceOrb++;
    if (sinceOrb >= POWER_EVERY && !orb.mesh.visible){ sinceOrb = 0; spawnOrb(); }
  } else if (shield){
    /* Earned, so it should feel earned: no life lost, no slowdown, and
       it says what it just did for you - and still teaches the answer,
       because that is the point of the game. */
    shield = false;
    paintPowers();
    pop("SHIELD", true);
    say("<b>Shield took that one</b> — it was <b>" + question.answer + "</b>" +
        (question.note ? "<br>" + question.note : ""), true);
  } else {
    lives--;
    paintLives();
    speed = Math.max(START_SPEED, speed - 5);
    /* The convoy scatters. Losing five cars you spent five right
       answers earning is the sting; the heart is the consequence. */
    streak = 0;
    scoreEl.classList.remove("hot");
    paintStreak();
    pop("\u2717", false);
    shakeUntil = gameClock + 0.35;
    if (renderer) replay(renderer.domElement, "knock");
    convoyN = 0;
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
  nextAt = gameClock + (chosen === question.answer ? 0.12 : 1.1);
}

function gameOver(){
  running = false;
  nextAt = 0;
  gatesAt = 0;
  /* The flash and the badges are now cleared inside the frame loop,
     which stops when the game does - so without this the red "it was
     X" card and a stale "SHIELD x2" badge sat blurred behind the
     game-over dialog until the next run. */
  flashUntil = 0;
  flash.className = "";
  streak = 0; convoyN = 0;
  el("streak").hidden = true;
  scoreEl.classList.remove("hot");
  if (convoy) placeConvoy();
  ask.textContent = "";
  sub.textContent = "";
  shield = false; doubleLeft = 0; fiftyNext = false;
  paintPowers();
  const beatIt = score > best;
  if (beatIt){ best = score; try { localStorage.setItem("gr-best", String(best)); } catch(e){} }
  el("overScore").textContent = score;
  el("overBest").textContent = best;
  el("overTitle").textContent = beatIt ? "New best" : "Out of lives";
  el("overLede").textContent = score === 0
    ? "That one got away. The first few are gentle — go again."
    : "You cleared " + score + " gate" + (score===1?"":"s") + ".";
  el("overNote").textContent = bestStreak >= 3
    ? "Longest run without a mistake: " + bestStreak + " in a row."
    : "";
  el("overSheet").classList.add("on");
  saveScore(score);
}

/* ---------- input ---------- */
function moveTo(n){ lane = Math.max(0, Math.min(2, n)); }
function setPaused(on){
  if (!running) return;
  paused = on;
  el("pauseSheet").classList.toggle("on", paused);
  last = performance.now();
}

addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "Esc"){
    e.preventDefault();
    if (running) setPaused(!paused);
    return;
  }
  if (!running) {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); start(); }
    return;
  }
  if (paused) return;
  if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") moveTo(lane-1);
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") moveTo(lane+1);
});
addEventListener("pointerdown", (e) => {
  if (!running || paused) return;
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

  /* A car, because this is a road through a city. A group, not a
     rotated mesh with rotated children: a child inherits its parent's
     turn, so hanging parts off a body that is itself tipped ninety
     degrees sent them off in directions of their own - the trap the
     ground shadow and the old nose cone both fell into. Everything
     here is placed in the group and turned on its own.

     Front is -z, the way the car is travelling. */
  player = new THREE.Group();
  player.position.set(0, 0, 0);

  const paint = new THREE.MeshLambertMaterial({ color: 0xff5a5f });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.46, 2.9), paint);
  body.position.y = 0.46;
  player.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.44, 1.35),
    new THREE.MeshLambertMaterial({ color: 0x2b3a4a }));
  cabin.position.set(0, 0.88, 0.12);
  player.add(cabin);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.5), paint);
  snout.position.set(0, 0.36, -1.6);
  player.add(snout);

  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  for (const lx of [-0.5, 0.5]){
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.1), lampMat);
    lamp.position.set(lx, 0.42, -1.84);
    player.add(lamp);
  }

  /* One geometry and one material shared by all four. */
  const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.26, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x23272e });
  for (const wx of [-0.88, 0.88]){
    for (const wz of [-0.95, 1.0]){
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI/2;      /* axle across the car */
      wheel.position.set(wx, 0.33, wz);
      player.add(wheel);
      wheels.push(wheel);
    }
  }
  scene.add(player);

  /* Not a child of the player: the player is turned on its nose to
     point down the track, and a child inherits that, so the glow ended
     up standing on its edge instead of lying on the ground. */
  glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 18),
    new THREE.MeshBasicMaterial({ color: 0x1b2430, transparent: true, opacity: 0.17 }));
  glow.scale.set(1.05, 1.75, 1);   /* a car-shaped smudge, not a dot */
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

  /* The convoy and the confetti are an InstancedMesh each, so the
     whole lot of them is two draw calls however many are on screen -
     the same trick as the buildings. */
  convoy = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.8, 0.4, 0.98),
    /* Flat colour, not lit. These sit close to the camera and so cover
       a lot of pixels, and a lit material is a lighting calculation on
       every one of them - measured at about three frames a second on a
       machine with no graphics card, which is exactly the machine this
       has to run on. Flat suits the look anyway. */
    new THREE.MeshBasicMaterial({ color: 0xf5b800 }), CONVOY_MAX);
  convoy.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  convoy.frustumCulled = false;
  scene.add(convoy);
  /* A dark roof on each, so they read as little cars rather than as
     bricks. A second instanced mesh is a second draw call and nothing
     else. */
  convoyTop = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.56, 0.28, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x2b3a4a }), CONVOY_MAX);
  convoyTop.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  convoyTop.frustumCulled = false;
  scene.add(convoyTop);
  placeConvoy();

  confetti = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    /* Per-instance colour, the same way the buildings do it - no
       vertexColors flag, which wants a colour attribute on the
       geometry and is not what setColorAt uses. */
    new THREE.MeshBasicMaterial({ color: 0xffffff }), CONFETTI);
  confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  confetti.frustumCulled = false;
  const cc = new THREE.Color();
  for (let i = 0; i < CONFETTI; i++){
    bits[i] = { life: 0, x:0, y:0, z:0, vx:0, vy:0, vz:0, spin: Math.random()*6 };
    cc.setHSL(Math.random(), 0.9, 0.6);
    confetti.setColorAt(i, cc);
  }
  scene.add(confetti);
  placeConfetti();

  for (let i = 0; i < 3; i++) gateSet.push(makeGate());
  orb = makeOrb();
}

function placeDashes(){
  for (let i = 0; i < DASHES; i++){
    const d = dashAt[i];
    _v.set(1, 1, 1);
    _pos.set(d.x, 0.02, d.z);
    _m.compose(_pos, _flat, _v);
    dashes.setMatrixAt(i, _m);
  }
  dashes.instanceMatrix.needsUpdate = true;
}

/* Each car follows the one in front rather than copying the player, so
   the line bends through a lane change instead of snapping sideways in
   one block. */
function placeConvoy(){
  for (let i = 0; i < CONVOY_MAX; i++){
    const on = i < convoyN ? 1 : 0.0001;
    const z = CONVOY_Z0 + i*CONVOY_GAP;
    _v.set(on, on, on);
    _pos.set(convoyX[i], 0.28, z);
    _m.compose(_pos, _q, _v);
    convoy.setMatrixAt(i, _m);
    _pos.set(convoyX[i], 0.56, z + 0.06);
    _m.compose(_pos, _q, _v);
    convoyTop.setMatrixAt(i, _m);
  }
  convoy.instanceMatrix.needsUpdate = true;
  convoyTop.instanceMatrix.needsUpdate = true;
}

function placeConfetti(){
  for (let i = 0; i < CONFETTI; i++){
    const b = bits[i];
    const k = b.life > 0 ? Math.min(1, b.life*1.6) : 0.0001;
    _v.set(k, k, k);
    _pos.set(b.x, b.y, b.z);
    _q.setFromAxisAngle(_axis, b.spin);
    _m.compose(_pos, _q, _v);
    confetti.setMatrixAt(i, _m);
  }
  _q.identity();
  confetti.instanceMatrix.needsUpdate = true;
}

function burst(x, y, z){
  for (let i = 0; i < CONFETTI; i++){
    const b = bits[i];
    b.life = 0.55 + Math.random()*0.35;
    b.x = x + (Math.random()-0.5)*1.6;
    b.y = y + (Math.random()-0.5)*1.2;
    b.z = z;
    b.vx = (Math.random()-0.5)*9;
    b.vy = 2 + Math.random()*7;
    b.vz = 4 + Math.random()*8;
    b.spin = Math.random()*6;
  }
}

function placeBlocks(){
  for (let i = 0; i < BLOCKS; i++){
    const b = blockAt[i];
    _v.set(b.w, b.h, b.d);
    _pos.set(b.x, b.h/2 - 0.06, b.z);
    _m.compose(_pos, _q, _v);
    blocks.setMatrixAt(i, _m);
  }
  blocks.instanceMatrix.needsUpdate = true;
}

let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  /* Capped so one long frame - a stall, a slow first paint - cannot
     teleport the car through a set of gates. The cap is also a speed
     limit on a slow machine: below 1/CAP frames a second the whole
     game runs in slow motion rather than skipping, which is the right
     way round, since you still get the same number of frames to react
     in. At 0.05 that kicked in under 20fps, which a weak Chromebook
     could plausibly sit at; 0.1 means it only starts slowing below 10. */
  const dt = Math.min(0.1, (now - last)/1000);
  last = now;
  /* Frozen: still drawn, so it does not go black, but nothing moves
     and nothing can be judged while you are not looking. */
  if (!running || paused) { renderer.render(scene, camera); return; }

  gameClock += dt;

  if (nextAt && gameClock >= nextAt){ nextAt = 0; setQuestion(); }
  if (gatesAt && gameClock >= gatesAt){ gatesAt = 0; placeGates(); }
  if (flashUntil && gameClock >= flashUntil){ flashUntil = 0; flash.className = ""; }

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

  /* The line of cars behind you, each one following the car in front
     rather than the player, so it bends through a lane change. */
  const follow = Math.min(1, dt*10);
  if (convoyN > 0){
    convoyX[0] += (laneX - convoyX[0]) * follow;
    for (let i = 1; i < convoyN; i++) convoyX[i] += (convoyX[i-1] - convoyX[i]) * follow;
    placeConvoy();
  }
  convoy.visible = convoyTop.visible = convoyN > 0;

  /* Twenty-six matrices rewritten every frame for confetti that is not
     on screen is twenty-six matrices wasted, and this has to run on a
     machine with no graphics card. */
  let anyBits = false;
  for (let i = 0; i < CONFETTI; i++){
    const bt = bits[i];
    if (bt.life <= 0) continue;
    anyBits = true;
    bt.life -= dt;
    bt.vy -= 22*dt;
    bt.x += bt.vx*dt; bt.y += bt.vy*dt; bt.z += (bt.vz + speed)*dt;
    bt.spin += dt*7;
    if (bt.y < 0.1 || bt.z > 16) bt.life = 0;
  }
  if (anyBits || bitsShown){ placeConfetti(); bitsShown = anyBits; }
  confetti.visible = anyBits;

  /* Slide rather than snap, and bank into the turn. */
  const target = LANES[lane];
  laneX += (target - laneX) * Math.min(1, dt*11);
  player.position.x = laneX;
  glow.position.x = laneX;
  player.rotation.z = (target - laneX) * 0.5;
  /* A little bob, so it reads as moving rather than sliding. */
  /* Wheels turn with the road rather than at some made-up rate, so
     slowing down actually looks like slowing down. */
  const spin = move / 0.33;
  for (const w of wheels) w.rotation.x -= spin;
  /* Pull back as the line grows, or the cars at the end of it end up
     behind the camera. The gates are forty-odd units away, so a couple
     of units of pull-back costs about five per cent of their size -
     which is why the convoy can exist at all. */
  /* Up as well as back: looking down the line is what makes it read
     as a line. Straight back and it fills the bottom of the screen. */
  /* Up as well as back: looking down the line is what makes it read
     as a line rather than a yellow smear at the bottom of the screen.
     Kept small - the gates are the thing you have to be able to read,
     and every unit of pull-back shrinks them. */
  camBack += (convoyN*0.62 - camBack) * Math.min(1, dt*2.5);
  camera.position.z = 7.6 + camBack;
  camera.position.y = 3.5 + camBack*0.5;
  let shakeX = 0;
  if (shakeUntil && gameClock < shakeUntil) shakeX = calmer ? 0 : (Math.random()-0.5)*0.5;
  else shakeUntil = 0;
  camera.position.x += (laneX*0.42 + shakeX - camera.position.x) * Math.min(1, dt*5);
  /* Re-aimed every frame. Without this the pull-back kept the original
     downward tilt, which walked the convoy straight off the bottom of
     the screen as it grew. */
  camera.lookAt(camera.position.x*0.55, 1.5, -18);

  renderer.render(scene, camera);
}

function start(){
  /* Without this, a machine with no WebGL - acceleration switched off,
     a locked-down Chromebook - showed the "can't run the 3d" note and
     then let you press Start anyway: the menu vanished, setQuestion()
     reached into an empty gateSet and threw, and the only way out was
     a reload. */
  if (!ready) return;
  el("startSheet").classList.remove("on");
  el("overSheet").classList.remove("on");
  running = true; paused = false;
  el("pauseSheet").classList.remove("on");
  score = 0; lives = LIVES; speed = START_SPEED; lane = 1; laneX = 0;

  /* Everything earned last time goes. Without this a shield picked up
     in one game was still sitting there at the start of the next, and
     so was any x2 left over - which quietly made the second run of the
     evening easier than the first. */
  gameClock = 0; nextAt = 0; gatesAt = 0; flashUntil = 0; flash.className = "";
  correct = 0;
  /* The convoy, the streak and the camera all go back too - a line of
     five cars left over from the last game is not a line you earned. */
  streak = 0; bestStreak = 0; convoyN = 0; camBack = 0; shakeUntil = 0; lastTier = 0;
  convoyX.fill(0);
  for (let i = 0; i < CONFETTI; i++) bits[i].life = 0;
  if (convoy) placeConvoy();
  if (confetti) placeConfetti();
  camera.position.set(0, 3.5, 7.6);
  scoreEl.classList.remove("hot");
  el("streak").hidden = true;
  el("pop").className = "";
  el("tier").className = "";
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

/* Switching away freezes it rather than letting the run carry on
   unwatched - and rather than throwing the run away, which is what
   losing a life for answering the door would feel like. */
addEventListener("visibilitychange", () => {
  if (document.hidden && running && !paused) setPaused(true);
  last = performance.now();
});
/* On two screens, or a tiled window, clicking into something else does
   not hide the tab - so the run carried on unwatched and lost lives. */
addEventListener("blur", () => { if (running && !paused) setPaused(true); });
/* Portrait phones are much narrower than they are tall, and the field
   of view is measured vertically - so on a 390-wide screen the left and
   right answers slid off the edges during the final approach, exactly
   when you are committing to one. This widens the view until the
   outermost gate is certain to be on screen. */
function fitCamera(){
  const aspect = innerWidth / innerHeight;
  camera.aspect = aspect;
  /* Half-width that must be visible at the distance gates are read
     from: the far edge of an outer gate, plus a margin. */
  const needHalf = Math.abs(LANES[2]) + 2.5 + 1.2;
  const atDist = 20;
  const wantH = Math.atan(needHalf / atDist);
  const vFov = 2 * Math.atan(Math.tan(wantH) / Math.max(0.2, aspect));
  camera.fov = Math.min(100, Math.max(66, vFov * 180 / Math.PI));
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

addEventListener("resize", () => { if (ready) fitCamera(); });

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
  fitCamera();
  ready = true;
  try { best = Number(localStorage.getItem("gr-best")) || 0; } catch(e){ best = 0; }
  el("best").textContent = best;
  window.__gateRunStarted = true;
  requestAnimationFrame(frame);

  /* Gate text is drawn into a canvas once and never redrawn, so starting
     before the webfont arrived baked the whole run in the fallback face
     while the question card above it was in the right one. If the font
     turns up later, redraw whatever is on the gates. */
  if (document.fonts && document.fonts.ready){
    document.fonts.ready.then(() => {
      if (!question) return;
      question.options.forEach((opt, i) => {
        drawLabel(gateSet[i].canvas, i === question.blanked ? "\u2014" : opt,
                  i === question.blanked ? "#c6cdd6" : "#ffffff");
        gateSet[i].tex.needsUpdate = true;
      });
    }).catch(() => {});
  }
} catch (err){
  window.__gateRunStarted = true;
  ready = false;
  const n = el("note");
  if (n){
    n.textContent = "This device can't run the 3d game \u2014 3d graphics look to be switched off or unavailable here. Everything else on the site still works.";
    n.style.color = "var(--bad)";
  }
  /* Say so on the button as well. A live Start that does nothing but
     wipe the menu is worse than one that admits it cannot run. */
  const go = el("startBtn");
  if (go){ go.disabled = true; go.textContent = "Can't run here"; go.style.opacity = ".6"; }
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
  get paused(){ return paused; },
  get clock(){ return gameClock; },
  get nextAt(){ return nextAt; },
  get gatesAt(){ return gatesAt; },
  get correct(){ return correct; },
  get thinkWanted(){ return thinkWanted(); },
  get judged(){ return judged; },
  setPaused: (v) => setPaused(v),
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
  /* Test seams for measuring where the frames go. */
  scene: () => scene,
  freezeCam: () => { camBack = 0; camera.position.set(0, 3.5, 7.6); },
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
el("resumeBtn").addEventListener("click", () => setPaused(false));
