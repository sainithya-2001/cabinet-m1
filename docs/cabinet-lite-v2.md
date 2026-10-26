# Cabinet Lite — Spec v2

Oct 25, 2026 · Replaces the full spec for the submission build. The full spec stays as the source for the engine's numbers.

## The game

**Cabinet: Run the country. Find the liar.**

Players run the fictional Republic of Veloria for 3 years. A game takes 3–4 minutes. The cabinet always has at least 5 ministers: every human player, plus bot ministers in the empty seats. One minister, human or bot, is secretly the Mole and wants Veloria to fail.

- **Players:** 2–6 humans, each on their own phone or computer, anywhere. No one needs to be in the same room or on a call. With 2–4 humans, bots fill the cabinet to 5. With 5 or 6 humans, there are no bots.
- **Joining:** the creator gets a link with the room code built in. Opening it asks only for a name. No accounts, no installs.
- **Winning:** if Veloria survives all 3 years, every player who correctly names the Mole in the final guess wins.
- **The Mole wins** if Veloria collapses, or if most human players guess wrong.

Design goal: learnable in 20 seconds, finished in 4 minutes, and every outcome shows why it happened.

### The landing page

The tagline, a big Play now button, and these three rules beside the join box, word for word:

1. **Get a secret clue.** A crisis hits. Only you know one number, and you can tell the truth or lie.
2. **Argue, then vote.** The Prime Minister splits 10 budget coins, and the cabinet votes yes or no.
3. **Survive and unmask.** Keep Veloria alive for 3 years, then name the Mole.

Below them, in small text: "Refreshing reconnects you."

### Rules that teach themselves

- **How to play:** the same three rules, reachable from a ? button in every phase.
- **Year 1 hints:** each phase shows a one-line instruction, for example "You're the PM: place 10 coins, then tap Submit."
- **Always visible:** every screen shows the current phase, what this player can do right now, and the time left.

## One year

The server sets and enforces every deadline. A phase ends early when every human taps Ready, but not before its minimum.

| Phase | What happens | Min | Max (Year 1) |
| --- | --- | --- | --- |
| Headline | Speaker Thunderbottom announces the crisis, newspaper style | 4 s | 4 s |
| Clue + chat | Each player sees their private clue; everyone argues in chat and can publish their clue | 15 s | 45 s (60 s) |
| Budget | The PM places 10 coins; the coins move live on every screen, with predicted effects | 0 s | 30 s (40 s) |
| Vote | Every minister votes Yes or No; votes fill in live | 0 s | 10 s (15 s) |
| Result | What changed and why, a headline, a Real world note | 0 s | 10 s (15 s) |

A year takes at most about 1.5 minutes, and usually less, because phases skip ahead when everyone is ready.

**Prime Minister order:** humans go first. Year 1's PM is a random human; each later year goes to the next human who hasn't been PM yet. Bots are PM only once every human has had a turn. With 2 humans, both are PM once, and a bot drafts Year 3.

## Rules

### Ministries and clues

Every seat is a ministry, and each year its minister sees one exact number nobody else sees. Seats are dealt in this order: Finance, Health, Defense, Education, Environment, then Economy for a 6th human.

| Ministry | Private clue each year |
| --- | --- |
| Finance | This year's exact revenue |
| Health | This year's Health need |
| Defense | This year's Security need |
| Education | This year's Education need |
| Environment | This year's Environment need |
| Economy (6 humans only) | This year's Economy need |

Clues are written as a short report with the number in bold, for example "Hospital report: 340 patients in corridors. Health needs **34**." Everyone else sees revenue as a range and each need at its normal level.

### Publish my clue

- Once per year, during Clue + chat, a minister can publish their clue to the chat with a Clue badge, for example "Finance: revenue is 92".
- The number starts at the true value and **can be edited before publishing** (revenue 60–140, needs 0–60). Anyone can lie.
- The server records the published value, the true value and the author. The truth stays hidden until the recap.

### Chat

- One room chat for everyone, open in every phase except Vote. Messages up to 140 characters, at most one per second.
- Quick buttons: "I trust that", "That's a lie", "Fund Health!", "Vote no".
- Bot ministers chat too, in character (see Bot ministers).

### The budget: 10 coins

- The PM places exactly 10 coins across 5 lines: Health, Education, Security, Environment and Economy. Each coin is 10% of the budget.
- The engine runs unchanged: Economy coins are split evenly between its Industry and Infrastructure lines, and Debt repayment is always 0.
- A borrow switch adds 0, 10 or 20 B to this year's money, and adds the matching debt.
- While the PM taps, every screen shows the coins moving live and the predicted effects as ranges, computed from public information only.
- Other players can tap a line to demand more or less. Demands show live on the PM's screen as arrows with the player's name.

### Vote

- Every minister votes. The budget passes if Yes votes outnumber No votes; a tie fails. A human who doesn't vote in time doesn't count.
- If it fails, the next seat redrafts (20 s) and the cabinet votes again. If that also fails, the government shuts down: last year's budget runs at 80% and Stability drops by 5.
- If an indicator crosses its collapse line, the game skips to the recap.

### The Mole and the final guess

- One seat, human or bot, is chosen at random as the Mole. A human Mole is told privately and has exactly the same actions as everyone else. A bot Mole keeps its personality but plays to sink the country.
- After Year 3, each human has 20 s to name one minister as the Mole. Bots don't guess.
- If Veloria survived, each human who named the Mole wins. The Mole wins if most humans guessed wrong.
- If Veloria collapsed, there is no guess: the Mole has won, and the recap reveals them.

## Bot ministers and the Speaker

All characters are original parody types based on well-known parliament meme moments. None uses a real person's name, face or signature catchphrase, and none refers to a real party, country or policy.

### Speaker Thunderbottom (narrator, not a player)

The classic shouting Speaker. He announces every phase in the newspaper banner: "ORDER! The vote is OPEN!", "ORDERRR! The Baroness will take her seat!", "The ayes have it! Probably!"

### The bot pool

Each game draws the bots it needs at random from this pool, so the cabinet changes from game to game.

| Bot | Meme type | Sample line | Tell (how it plays when loyal) |
| --- | --- | --- | --- |
| Sir Nodsalot | Asleep on the back benches | "Zzz… wha… aye. Aye, whatever." | Honest; votes at the last second |
| Baroness Slowclap | The slow sarcastic clap | "👏 Wow. 👏 Another 👏 budget." | Under-reports her clue by about 20%; votes against the PM |
| Sir Reginald Filibuster | The endless speech | "Before we vote, a brief history of potatoes…" | Honest; always votes No on a first draft |
| The Hon. Member for Shouting | The parliament brawl | "OUTRAGEOUS! Health needs EVERYTHING!" | Over-reports crisis needs by about 30% |
| Minister Low-Battery | On the phone mid-debate | "sorry what are we voting on lol" | Honest; copies the majority vote |
| The Paper-Tearer | Ripping up the speech | "*rips budget in half*" | Honest; votes No when Health or Education gets under 2 coins |
| Comrade Point-of-Order | The pedant | "POINT OF ORDER: that number is wrong." | Always honest; calls out published numbers far from normal |
| Lord Ribbon-Cutter | The photo-op minister | "Imagine the BRIDGE. Imagine the photos." | Over-reports and always asks for Economy coins |

### How bots behave

- **Loyal bots are predictable.** Each always shows its tell, so players can learn that a lowball from the Baroness is normal for her.
- **A Mole bot breaks its tell.** It keeps its name and voice, but lies in the direction that hurts the country (for example, Lord Ribbon-Cutter suddenly lowballing Health during an outbreak) and votes for budgets that underfund the crisis. Spotting the broken pattern is the deduction.
- **As PM,** a loyal bot uses the simulator's Balanced strategy, shifted toward its bias; a Mole bot uses the Mole strategy.
- **Chat is templates, not an AI model:** about 10 lines per bot, filled with real values from the game ("Health wants 34? In this economy?"). Each bot posts 1–3 lines per year.
- **Timing:** the server decides all bot moves when a phase starts and stamps each with a staggered time 3–20 s into the phase, so bots appear to type, publish and vote naturally on every screen.
- **Disconnects:** if a human is gone for more than 15 s, a bot plays their seat (with no personality, using the Balanced strategy, never lying) until they return. A human Mole's seat keeps playing as the Mole.

## After each year: what happened and why

The Result screen shows three things, all generated from what actually happened.

1. **The cause breakdown.** Each indicator's change split into causes that add up exactly, from the engine, for example "Happiness −8: Health underfunded during the floods −5, flood damage −4, Education +1".
2. **A headline,** filled from a template for the year's biggest cause, for example "HOSPITALS OVERWHELMED AS PM PRIYA GIVES HEALTH ONE COIN" or "NATION SHOCKED TO DISCOVER ROADS COST MONEY". Write 3 variants per cause type and pick one with the game's seeded random. The jokes target Veloria's fictional government, never real parties or politicians.
3. **One Real world note,** the learning moment. Pick the highest-priority trigger that fired this year, and never repeat a note within a game.

| Trigger (in priority order) | Real world note (concept) |
| --- | --- |
| Two failed votes, shutdown | When governments can't agree on a budget, services are cut while they argue (budget shutdowns). |
| A sector underfunded during its own crisis | Crises cost more when the system was already stretched (preparedness). |
| Money borrowed this year | Borrowing helps now, but interest takes money from every future budget (debt and interest). |
| Interest above 5 B | The interest bill is now competing with hospitals and schools (crowding out). |
| Environment fell mainly from Industry | Pollution is a real cost that isn't on the factory's bill (externalities). |
| Education spending above its need | Education pays back, but years later, which makes it easy to cut (delayed returns). |
| A sector funded far above its need | Each extra coin did less than the last (diminishing returns). |
| Revenue came in outside the public range's middle | Governments budget with forecasts, not certainties (fiscal uncertainty). |

Notes stay factual and non-partisan: they explain how a mechanism works, never which policy is right.

## The newspaper recap

The end screen is the front page of The Veloria Times, built only from the server's record of the game:

- **Lead story:** the outcome, the Mole unmasked (human or bot), and who guessed right.
- **Who lied:** every published clue next to its true value, with lies highlighted.
- **The three years:** for each year, the crisis, the PM, whether the budget passed, and the biggest change.
- **Chart:** the five indicators across the three years, with collapse lines marked.
- **What you learned:** the Real world notes this game triggered, in one box.

Nice to have: a button that downloads the front page as an image to share.

## Multiplayer on Supabase

The server decides everything; phones only display state and send requests. The existing engine runs inside the Edge Function, so there is one copy of the rules.

| Piece | Job |
| --- | --- |
| `game_rooms.game_state` (JSONB) | One row per room: the full game state plus a `version` number. Holds private data (`privateByPlayer`, Mole flag, true clue values), so the anon key must never be able to read this table. RLS on, no policies. |
| `cabinet-rooms` Edge Function | The only way in. Every state change goes through `mutateGameState` (read latest → validate → apply → save if `version` unchanged → retry up to 5 times). Public responses strip all private fields. |
| Supabase Realtime | Room-change notifications so every screen refreshes immediately; a broadcast channel per room for chat, live coin taps and demand arrows. Polling stays only as a fallback. |
| Vercel | Hosts the React app |

### Rules the builder must keep

- **Conflicting moves:** every write goes through `mutateGameState`; a save that finds `version` changed starts again from the read.
- **Timers:** each phase's deadline is stored in the state. The server moves on only if the deadline has really passed, and repeat calls change nothing. The browser countdown is display only.
- **Private state:** each phone fetches its own clue and role from the function with its player token. Published clues go into public state without their true value.
- **Reconnecting:** the player token lives in the phone's browser storage. Reloading the page puts the player back in their seat. A vote already cast stays counted.
- **Security:** row-level security on every table, with no anon read policies. The public key never reads player tokens, clues or the Mole flag directly.
- **Chat is not game state:** chat, coin taps and demand arrows run on the Realtime broadcast channel and are not stored in `game_state`. Only the submitted budget, votes, guesses, ready and published clues are game actions saved through the function.
- **Bots:** bot moves are computed by the Edge Function when a phase starts and stored with their reveal times, so every screen shows them at the same moment. A bot's clue and Mole status live only in private server state.

## Not in v1

Powers, secret agendas and individual scores, the mid-game no-confidence vote, Audit, Crisis mode, 5- and 8-year games, more than 6 humans, AI-generated bot chat, statistics, credits, and any new negotiation system. These stay in the full spec and come back only after v1 is tested and submitted.

## Done when

- [ ] 2 players in different places, on different networks and with no call, finish a 3-year game with 3 bot ministers, using only the link and the chat. Then 6 humans do the same, with identical public state on every screen.
- [ ] Reloading a phone mid-vote returns the player to their seat with their vote still counted.
- [ ] Browser network traffic on one phone never shows another player's clue or the Mole flag.
- [ ] Every Result breakdown adds up exactly to the change shown.
- [ ] The recap's lies, votes and years match the server's record.
- [ ] A first-time player finishes Year 1 using only the How to play screen and the tutorial, with no one explaining, in a real playtest.
- [ ] The deployed link works, and known limitations are written down.
- [ ] Bot ministers publish, chat, vote and draft at the same moments on every screen, and each loyal bot shows its tell every year.
- [ ] A full game takes under 5 minutes in a real playtest.
- [ ] No character uses a real person's name, face or signature catchphrase.
