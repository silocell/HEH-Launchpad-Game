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
   THE QUESTIONS

   Made here in the page, not by the AI. Three reasons, all of them
   decisive: the AI costs money per question and the explainer's ten a
   day would be gone in one go; it takes a second or two to answer,
   which is fatal in a game where a gate is coming at you; and it needs
   signal, so the game would die on the bus. Made here they are free,
   instant, endless and work with no connection at all.

   The wrong answers are the part that matters. Random numbers teach
   nothing and are easy to spot without doing the maths - if the other
   two gates say 91 and 4, you don't need to know that 7 x 8 is 56. So
   every wrong answer here is a mistake somebody actually makes: the
   next row of the times table, the subtraction done backwards, the
   apostrophe in the plural. Getting it wrong should feel like nearly
   getting it right.
   ==================================================================== */

var QUIZ = (function(){
  "use strict";

  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
  function range(lo, hi){ return lo + Math.floor(Math.random()*(hi-lo+1)); }

  /* Three gates, so one right and two wrong. Wrong ones must be
     different from each other and from the answer, and must not be
     silly (no negative gate on a question about how many apples). */
  function gates(answer, wrongs, allowNegative){
    var out = [];
    for (var i = 0; i < wrongs.length && out.length < 2; i++){
      var w = wrongs[i];
      if (w === null || w === undefined) continue;
      /* Never put a half-number on a gate. Every question here is meant
         to come out whole, so a fraction means the maker has a bug -
         better to drop that gate and fall through to a nudge than to
         show 2.6666666666666665 to a Year 7. */
      if (typeof w === "number" && !isFinite(w)) continue;
      if (typeof w === "number" && Math.floor(w) !== w) continue;
      if (String(w) === String(answer)) continue;
      if (out.some(function(x){ return String(x) === String(w); })) continue;
      if (!allowNegative && typeof w === "number" && w < 0) continue;
      out.push(w);
    }
    /* Ran out of sensible mistakes - nudge off the answer rather than
       leaving a blank gate. */
    var step = 1;
    while (out.length < 2){
      /* A gate reading "then?" looks like the game is broken, so a
         made-up wrong word doubles a letter instead - which is what a
         real misspelling looks like. */
      var n = (typeof answer === "number") ? answer + step
            : String(answer).replace(/([a-z])/i, "$1$1") + (step > 1 ? "e" : "");
      if (String(n) !== String(answer) && !out.some(function(x){ return String(x) === String(n); })
          && (allowNegative || typeof n !== "number" || n >= 0)) out.push(n);
      step = step > 0 ? -step : -step + 1;
    }
    var all = [answer, out[0], out[1]];
    /* Shuffle, or the answer is always on the left. */
    for (var j = all.length - 1; j > 0; j--){
      var k = Math.floor(Math.random()*(j+1));
      var t = all[j]; all[j] = all[k]; all[k] = t;
    }
    return all.map(String);
  }

  function q(text, answer, wrongs, note, allowNegative){
    return { text: text, answer: String(answer),
             options: gates(answer, wrongs, allowNegative), note: note || "" };
  }

  /* ---------------- maths ---------------- */

  function timesTable(level){
    var top = level < 2 ? 9 : level < 4 ? 12 : 15;
    var a = range(2, top), b = range(2, top);
    /* The classic slips: one row up, one row down, and the add. */
    return q(a + " × " + b, a*b,
      [a*(b+1), a*(b-1), (a+1)*b, a+b],
      a + " × " + b + " = " + (a*b));
  }

  function divide(level){
    var top = level < 3 ? 9 : 12;
    var b = range(2, top), ans = range(2, top), a = b*ans;
    return q(a + " ÷ " + b, ans,
      [ans+1, ans-1, a-b, b],
      a + " ÷ " + b + " = " + ans);
  }

  function addSub(level){
    var big = level < 2 ? 50 : level < 4 ? 200 : 999;
    var a = range(11, big), b = range(11, big);
    if (Math.random() < 0.5){
      return q(a + " + " + b, a+b, [a+b-10, a+b+10, a+b-1, a-b], "");
    }
    if (b > a){ var t = a; a = b; b = t; }
    /* Taking the small digit from the big one whichever way round it
       is - the most common subtraction mistake there is. */
    var backwards = Math.abs((a%10) - (b%10)) + Math.floor(a/10)*10 - Math.floor(b/10)*10;
    return q(a + " − " + b, a-b, [backwards, a-b-10, a-b+10, a-b-1], "");
  }

  function negatives(level){
    var a = range(-12, -1), b = range(2, 12);
    if (Math.random() < 0.5){
      /* -7 + 10: the slip is to ignore the sign. */
      return q(a + " + " + b, a+b, [Math.abs(a)+b, -(Math.abs(a)+b), a-b], "", true);
    }
    /* -7 - 4: the slip is to add instead. */
    return q(a + " − " + b, a-b, [a+b, Math.abs(a)-b, Math.abs(a-b)], "", true);
  }

  function fractionOf(level){
    var denom = pick(level < 3 ? [2,4,5,10] : [2,3,4,5,6,8,10]);
    var num = range(1, denom-1);
    var whole = denom * range(2, level < 3 ? 8 : 15);
    var ans = whole/denom*num;
    return q(num + "/" + denom + " of " + whole, ans,
      [whole/denom, whole-ans, whole/denom*(num+1), ans+denom],
      "One " + (denom===2?"half":denom===4?"quarter":"part") + " is " + (whole/denom) +
      ", so " + num + " of them is " + ans);
  }

  function percent(level){
    /* Twenties, not tens, and percentages that divide into 100 - so the
       answer is always a whole number. On tens, "25% of 30" came out as
       7.5 and the gates filled up with things like 2.6666666666666665,
       which is not a mistake anybody makes and looks broken besides. */
    var p = pick(level < 3 ? [10,25,50,100] : [5,10,15,20,25,50,75]);
    var whole = 20 * range(1, level < 3 ? 10 : 20);
    var ans = whole*p/100;
    return q(p + "% of " + whole, ans,
      [whole*p/10, whole/10, whole-ans, ans*2],
      "10% is " + (whole/10) + ", so " + p + "% is " + ans);
  }

  function bidmas(level){
    var a = range(2, 9), b = range(2, 9), c = range(2, 9);
    /* The whole point: left to right gives the wrong answer. */
    var leftToRight = (a+b)*c;
    return q(a + " + " + b + " × " + c, a + b*c,
      [leftToRight, a*b+c, a+b+c],
      "Times before plus: " + b + " × " + c + " = " + (b*c) + ", then + " + a);
  }

  function algebra(level){
    var x = range(2, 12), m = range(2, 9), c = range(1, 20);
    if (level < 3){
      return q(x*m + " = " + m + "n, so n =", x,
        [x*m - m, x+m, Math.round(x*m/2)], "");
    }
    return q(m + "n + " + c + " = " + (m*x + c) + ", so n =", x,
      [x+c, (m*x+c)/m, x*m], "Take " + c + " off both sides, then divide by " + m);
  }

  /* ---------------- english ---------------- */

  var HOMOPHONES = [
    ["___ going to be late.", "They're", ["Their","There"], "They're = they are"],
    ["Put it over ___.", "there", ["their","they're"], "there = a place"],
    ["___ bags are in the hall.", "Their", ["There","They're"], "their = belonging to them"],
    ["___ coming with us?", "You're", ["Your","Yours"], "You're = you are"],
    ["Is this ___ coat?", "your", ["you're","yours"], "your = belonging to you"],
    ["The dog hurt ___ paw.", "its", ["it's","its'"], "its = belonging to it. it's = it is"],
    ["___ raining again.", "It's", ["Its","Its'"], "It's = it is"],
    ["I want to come ___.", "too", ["to","two"], "too = also"],
    ["We walked ___ the park.", "to", ["too","two"], "to = towards"],
    ["___ did you put it?", "Where", ["Were","We're"], "where = which place"],
    ["___ going to the match.", "We're", ["Were","Where"], "We're = we are"],
    ["They ___ already here.", "were", ["where","we're"], "were = past tense of are"],
    ["He ate more ___ me.", "than", ["then","that"], "than = comparing"],
    ["We ate, ___ we left.", "then", ["than","when"], "then = next"],
    ["I can't ___ the music.", "hear", ["here","heer"], "hear = with your ears"],
    ["Come over ___.", "here", ["hear","heere"], "here = this place"],
    ["She gave me good ___.", "advice", ["advise","advices"], "advice = the noun"],
    ["Let me ___ you.", "advise", ["advice","adviced"], "advise = the verb"],
    ["The ___ of the story.", "effect", ["affect","effects"], "effect = the noun, the result"],
    ["It will ___ the result.", "affect", ["effect","efect"], "affect = the verb, to change"]
  ];

  var APOSTROPHES = [
    ["The ___ tails wagged. (more than one dog)", "dogs'", ["dog's","dogs"], "More than one dog, so the apostrophe goes after the s"],
    ["The ___ tail wagged. (one dog)", "dog's", ["dogs'","dogs"], "One dog, so apostrophe then s"],
    ["I bought three ___. (more than one apple)", "apples", ["apple's","apples'"], "Just a plural - no apostrophe at all"],
    ["The ___ coats are missing. (several children)", "children's", ["childrens'","childrens"], "Children is already plural, so add 's"],
    ["That is ___ book. (belonging to James)", "James's", ["James'","James"], "A name ending in s still takes 's"]
  ];

  var PLURALS = [
    ["knife", "knives", ["knifes","knive"]],
    ["child", "children", ["childs","childrens"]],
    ["tomato", "tomatoes", ["tomatos","tomatoe"]],
    ["mouse", "mice", ["mouses","mices"]],
    ["half", "halves", ["halfs","halfes"]],
    ["party", "parties", ["partys","partyes"]],
    ["sheep", "sheep", ["sheeps","sheepes"]],
    ["woman", "women", ["womans","womens"]],
    ["foot", "feet", ["foots","feets"]],
    ["leaf", "leaves", ["leafs","leafes"]],
    ["box", "boxes", ["boxs","boxen"]],
    ["person", "people", ["persons","peoples"]]
  ];

  /* Three spellings: the right one, the mistake people really make, and
     a second real mistake. The third used to be generated by doubling a
     letter, which produced things like "aachieve" - nobody has ever
     written that, so the gate was free to ignore and the question was
     really a two-way guess. */
  var SPELLINGS = [
    ["seperate","separate","seperete"], ["definately","definitely","definitly"],
    ["recieve","receive","receve"], ["neccessary","necessary","necesary"],
    ["occured","occurred","ocurred"], ["begining","beginning","beggining"],
    ["tommorow","tomorrow","tomorow"], ["embarass","embarrass","embarras"],
    ["arguement","argument","arguemant"], ["enviroment","environment","envirinment"],
    ["goverment","government","governent"], ["beleive","believe","beleave"],
    ["acheive","achieve","achive"], ["freind","friend","frend"],
    ["wierd","weird","weerd"], ["untill","until","untl"],
    ["accomodate","accommodate","acommodate"], ["existance","existence","existanse"]
  ];
  var SYNONYMS = [
    ["happy", "cheerful", ["gloomy","tired"]],
    ["enormous", "huge", ["tiny","ordinary"]],
    ["rapid", "quick", ["slow","steady"]],
    ["furious", "angry", ["calm","pleased"]],
    ["ancient", "very old", ["brand new","medium"]],
    ["reluctant", "unwilling", ["eager","certain"]],
    ["vital", "essential", ["optional","unusual"]],
    ["weary", "tired", ["awake","strong"]],
    ["courageous", "brave", ["frightened","careless"]],
    ["peculiar", "strange", ["normal","boring"]]
  ];

  function homophone(){
    var h = pick(HOMOPHONES);
    return q(h[0], h[1], h[2], h[3]);
  }
  function apostrophe(){
    var a = pick(APOSTROPHES);
    return q(a[0], a[1], a[2], a[3]);
  }
  function plural(){
    var p = pick(PLURALS);
    return q("More than one " + p[0] + ":", p[1], p[2],
      p[1] === p[0] ? "Some words don't change at all" : "");
  }
  function spelling(){
    var s = pick(SPELLINGS);
    return q("Which is spelt correctly?", s[1], [s[0], s[2]], "");
  }
  function synonym(){
    var s = pick(SYNONYMS);
    return q("“" + s[0] + "” means:", s[1], s[2], "");
  }

  var MATHS   = [timesTable, divide, addSub, negatives, fractionOf, percent, bidmas, algebra];
  var ENGLISH = [homophone, apostrophe, plural, spelling, synonym];

  /* Level climbs with the score; the harder makers only appear later so
     nobody meets algebra in the first ten seconds. */
  function next(subject, level){
    var pool;
    if (subject === "maths")   pool = MATHS.slice(0, Math.min(MATHS.length, 3 + level));
    else if (subject === "english") pool = ENGLISH;
    else pool = (Math.random() < 0.5 ? MATHS.slice(0, Math.min(MATHS.length, 3 + level)) : ENGLISH);
    return pick(pool)(level);
  }

  return { next: next, _makers: { timesTable:timesTable, divide:divide, addSub:addSub,
    negatives:negatives, fractionOf:fractionOf, percent:percent, bidmas:bidmas,
    algebra:algebra, homophone:homophone, apostrophe:apostrophe, plural:plural,
    spelling:spelling, synonym:synonym } };
})();

if (typeof module !== "undefined") module.exports = QUIZ;
