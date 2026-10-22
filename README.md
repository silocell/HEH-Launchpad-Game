# Gate Run

A 3d maths and English game for Key Stage 3. Three gates come at you with
an answer on each; steer into the right one before you get there. It
speeds up as you go, a wrong gate costs a life — and tells you why.
It never speeds up past the point of being answerable.

Built for a Year 7 homework site, and usable on its own.

**Play it:** open `index.html`. That's the whole installation.

---

## The idea

The answering *is* the steering. You aren't picking option B, you're
moving into a lane before you arrive, while the track gets faster. That
is the only reason to make this in 3d: a spinning cube behind a
multiple-choice box would be a quiz with decoration on it.

Two decisions do most of the work:

**The questions are generated in the page, never by an AI.** They're
free, instant, endless, and they work with no connection at all. An AI
would cost money per question and take a second or two to answer, which
is fatal when a gate is already coming at you.

**The wrong answers are mistakes people actually make.** This matters
more than it sounds. If the gates read 56, 91 and 4, you don't need to
know that 7 × 8 is 56 — you can rule the others out on sight. So every
wrong answer is a real slip: the next row of the times table, the
subtraction done the wrong way round, left-to-right instead of BIDMAS,
the apostrophe stuck into a plural. Getting it wrong should feel like
nearly getting it right.

Then it tells you what the answer was and why, and holds the next gates
back while you read it. A game that only says "wrong" teaches nothing.

## What it asks

**Maths** — times tables, division, addition and subtraction, negative
numbers, fractions of an amount, percentages, BIDMAS, one-step algebra.
Every answer is a whole number; nothing produces 7.5 apples.

**English** — homophones (their/there/they're, its/it's, affect/effect),
apostrophes, irregular plurals, commonly misspelt words, synonyms.

Difficulty climbs with the number you get **right** — not with your
score, which would mean an x2 pick-up, the reward for playing well,
quietly bringing the algebra forward. The harder generators only appear
once you've got a few right, so nobody meets algebra in the first ten
seconds.

Nothing asks for more than mental arithmetic. The top tier used to
reach the fifteen times table and three-digit subtraction, which are
things you do on paper — a gate is not the place to find out whether
you can hold 723 − 486 in your head.

## Speeding up without becoming impossible

The first version got 1.3 faster every question up to a hard ceiling,
in a straight line. The questions got harder in a straight line too,
and the two lines met near the end: about **1.8 seconds** to read a
BIDMAS question, read three gates, decide and steer. The tester's
verdict was that the end was impossible, and he was right.

Two things fix it, and neither of them is "make it slower".

**The speed eases off instead of climbing forever.** The gain shrinks
as it rises — quick off the mark, a long plateau, then a crawl that
only a very long run ever notices. You still feel it building; it just
stops building *at the same rate* once it's already fast.

**The clock is on the question, not the track.** The question goes on
screen first, and the gates are held back until what's left of the
run-up is worth a fixed number of seconds. Go faster and the stretch of
empty road before the next gates simply gets longer to pay for it. The
scenery still whips past harder and harder — the thinking time is what
stops shrinking.

And because the questions get harder as well, the harder ones buy more
of it: the floor starts at 3.2 seconds and rises with the difficulty
tier. That double squeeze — less time *and* harder sums — was the whole
problem.

The effect is a game that keeps getting more demanding to *play* while
staying possible to *answer*, which is the right way round for
something meant to teach.

## How it feels

Getting one right should feel like something, and the game says so
four ways at once: a **+1 leaps off the gate** you drove through, the
gate itself **goes green** as it passes, the **score punches**, and a
**car joins the line behind you**.

The convoy is the one worth explaining. Every right answer in a row
adds a car to the tail; a wrong one scatters the lot. It costs you
nothing you need — no life, no points — which is exactly why it works:
there is something to protect even when you have hearts to spare, and
a five-car tail is the only part of the screen that says *how well you
are doing right now* rather than how well you have done. The camera
eases back as it grows. That pull-back costs the gates about five per
cent of their size, which is affordable only because they are forty
units away when you are reading them.

Get one wrong and the screen takes a knock, the gate goes red, the
tail scatters and the card tells you what the answer was. And when the
questions step up a tier there's a banner for it, so it's a moment
rather than something you work out from suddenly getting them wrong.

Anyone whose machine asks for less movement (`prefers-reduced-motion`)
gets none of the shaking, leaping or confetti, and loses nothing: the
colours, the numbers and the words carry all of it.

**It has a night.** In dark mode — the device setting, or the choice
saved on the homework site, which shares this origin — the noon sky
goes, and you get a night drive: a city in silhouette, lit gates,
dark cards. Nobody wants a bright blue sky at full brightness in a dark
room, and it's the better-looking of the two anyway.

## Power-ups

Every four correct answers one appears on the track, in a lane of its
own, in the gap *before* the next set of gates — so grabbing it is never
a choice between the power-up and the right answer.

| | What it does |
|---|---|
| **SHIELD** | Takes the next wrong answer for you. No life lost — and it still tells you what the answer was, because that's the point of the game. |
| **SLOW** | Drops the speed. More time to think, which is a reward worth having here rather than a consolation. (More with better brakes.) |
| **x2** | Double points for your next five. |
| **50:50** | Blanks one wrong gate on the next question. |
| **+LIFE** | An extra heart, up to five. Rare. |

**They are earned by playing.** No advert to sit through, nothing that
costs money, no tracking of any kind.

## Upgrades

Every gate you have ever cleared is a point in the bank, and the bank
buys permanent upgrades from the game-over screen: a fourth and fifth
heart, a shield to start every run with, better brakes, power-ups more
often, and a **second chance** — once a run, when you're out of lives,
carry on with one.

That last one is the "continue for 99p" every one of those games sells
when you die. Here the only currency is questions you've answered. The
shape is the same as the games this is modelled on, because that shape
works — the difference is what it costs. A game aimed at a school
shouldn't teach anybody that losing is something you can pay to undo;
it can teach that it's something you can *earn* your way out of.

Upgrades live in the browser (`localStorage`), like your best score.

## Running it

No build step, no dependencies to install, no server required for the
game itself. Three.js is loaded from a CDN by import map.

```
git clone <this repo>
cd gate-run
open index.html          # or: python3 -m http.server
```

A module script plus an import map needs a modern browser (Chrome 89+,
Firefox 108+, Safari 16.4+). Anything older gets a plain message saying
so rather than a black screen.

It's deliberately light: the whole scene is around 20 draw calls and
1,300 triangles, and it holds a playable frame rate under pure software
rendering with no graphics card at all — so a school laptop won't
struggle. Everything that there are a lot of is one `InstancedMesh`
apiece: the buildings, the lane markings, the convoy, the confetti.
Eighty separate meshes would have been eighty draw calls.

If a machine still can't hold the frame rate, the game lowers its own
render scale a notch at a time rather than turning into a slideshow —
the scene is flat-shaded blocks, so three-quarter scale looks soft, not
broken. Measured under software rendering: 12 → 20 frames a second.

## Adding questions

Everything lives in `questions.js`. A maker returns a question, the
right answer, and a list of plausible wrong ones — the helper picks two
of them, drops any that are silly, and shuffles the gates.

```js
function timesTable(level){
  var top = level < 2 ? 9 : level < 4 ? 12 : 15;
  var a = range(2, top), b = range(2, top);
  return q(a + " × " + b, a*b,
    [a*(b+1), a*(b-1), (a+1)*b, a+b],      // the usual slips
    a + " × " + b + " = " + (a*b));        // shown if they get it wrong
}
```

Add yours to the `MATHS` or `ENGLISH` array at the bottom. The last two
dozen questions are remembered and refused, and the same generator is
never used twice running — picking at random with no memory is not the
same as feeling random, and once you've seen a question you're
remembering an answer rather than working it out.

Three rules worth keeping:

- **Wrong answers must be real mistakes.** A random number is free marks.
- **Whole numbers only.** A gate reading `2.6666666666666665` looks
  broken, and a decimal usually means the generator has a bug. There's a
  guard that drops them, but fix the maker rather than relying on it.
- **Give it plenty to draw from.** A list of five gets exhausted fast,
  and the no-repeat memory can only refuse what it has an alternative
  to.

## Scores (optional)

Out of the box, your best is kept in your own browser and nothing
touches the network. If you want one shared high score, edit the
`window.GATE_RUN` block at the bottom of `index.html` with your own
[Supabase](https://supabase.com) project, then run this once:

```sql
create table if not exists public.game_scores (
  id      bigserial primary key,
  user_id uuid        not null default auth.uid(),
  game    text        not null default 'gaterun',
  score   int         not null check (score >= 0 and score <= 250),
  made_at timestamptz not null default now()
);
alter table public.game_scores enable row level security;

grant select, insert on public.game_scores to authenticated;
revoke all on public.game_scores from anon;

create policy "own scores" on public.game_scores
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One integer. No name, no id, no date.
create or replace function public.top_score(g text default 'gaterun')
returns int language sql security definer stable set search_path = public as $$
  select coalesce(max(score), 0) from public.game_scores
   where game = g and made_at > now() - interval '120 days';
$$;
grant execute on function public.top_score(text) to authenticated;
```

**A number to beat, never a name.** That's deliberate. A leaderboard
means somebody is always bottom of it with their name attached, in front
of everyone they go to school with — which is a ready-made way to get at
people. One number gives you the competition and hands nobody a stick.

**Be honest about the limit:** this is a game that runs in the browser,
so the score is whatever the browser says it is. Anyone who opens the
developer tools can send a number they didn't earn. That's true of every
browser game and can't be fixed from the page. The `check` constraint
caps it at something humanly possible so the display can't be wrecked
entirely, and with no names attached the only prize for cheating is a
number nobody can admire you for.

## Licence

GNU General Public License v3.0 — see [LICENSE](LICENSE).

If you use it in a school, I'd genuinely like to know how it goes.
