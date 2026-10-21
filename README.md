# Gate Run

A 3d maths and English game for Key Stage 3. Three gates come at you with
an answer on each; steer into the right one before you get there. It
speeds up as you go, a wrong gate costs a life — and tells you why.

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

Difficulty climbs with your score: the harder generators only appear
once you've got a few right, so nobody meets algebra in the first ten
seconds.

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

It's deliberately light: the whole scene is about 11 draw calls and 82
triangles, and it holds a playable frame rate under pure software
rendering with no graphics card at all — so a school laptop won't
struggle.

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

Add yours to the `MATHS` or `ENGLISH` array at the bottom. Two rules
worth keeping:

- **Wrong answers must be real mistakes.** A random number is free marks.
- **Whole numbers only.** A gate reading `2.6666666666666665` looks
  broken, and a decimal usually means the generator has a bug. There's a
  guard that drops them, but fix the maker rather than relying on it.

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
