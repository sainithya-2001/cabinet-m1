# Build log — Cabinet

Cabinet was built by writing a specification, approving plans, and directing AI coding assistants, then verifying each change with tests, deployments and full playthroughs. This log records the bugs that taught the most: what broke, how it was pinpointed, how it was described to the AI, and what fixed it.

The working rule throughout: **don't accept "it should work" — reproduce it, find the exact cause, and describe it precisely.**

---

## 1. Two balance targets that could never both be true

**Symptom.** The spec asked for a balanced cabinet to survive 75–90% of games *and* for the Mole to win 30–45% against a balanced cabinet. In Standard mode the Mole is always present, so those numbers contradict each other.

**How it was found.** Reviewing the simulator's first report, which showed 97% survival — "too easy" by one target, meaningless by the other.

**Fix.** Split them into two separate measurements: an *economy baseline* (all-loyal cabinet, no Mole) and *traitor strength* (one Mole among loyal players). The rule "no game parameter changes without a report and approval" stayed in place.

**Lesson.** A requirement can be wrong. Check targets for consistency before tuning code to hit them.

---

## 2. A privacy filter that used a blocklist

**Symptom.** None visible in play — which was the danger.

**How it was found.** A test deliberately planted secret fields (a clue's true value, the Mole flag, private clue text) inside a published clue, then checked the "public" output. The secrets came straight through.

**Described to the AI as.** "`toPublicGameState` passes published clues through with planted `trueValue`, `isMole` and private `clue` text. Rewrite it as an allowlist: build each public object by copying only the fields browsers may see."

**Fix.** Every public object is now built from an explicit list of allowed fields, so anything new added to the state is private by default.

**Lesson.** Remove-what's-secret filters fail silently. Copy-what's-public filters fail safe.

---

## 3. `.js` imports that worked on the website but broke the server

**Symptom.** Typecheck, tests and the website build all passed, but deploying the Edge Function failed: `Module not found ".../src/engine/parameters.js"`.

**How it was found.** Reading the deploy error: the files were `.ts`, but the imports said `.js`. Vite maps one to the other; Supabase's Deno runtime does not.

**Fix.** Import `.ts` files by their real names, allow it in `tsconfig.json`, and add the server code to typechecking so this class of error shows up locally instead of at deploy.

**Lesson.** "All green locally" only covers what your checks actually check.

---

## 4. The endless `409 Conflict` loop

**Symptom.** After starting a game, both screens went blank and the browser console filled with hundreds of `409 (Conflict)` errors.

**How it was found.** The browser console showed the server's own message: `Invalid budget: Budget shares must sum to 100.` When a phase timed out, the server built an automatic budget whose percentages added up to 88 — a leftover from an earlier fix that removed a 12% debt-repayment share without redistributing it. The engine rejected it, every poll retried the same failing step, and because the failure blocked the state request, the page never received any state to draw.

**Described to the AI as.** "Root cause from the console: `Invalid budget: Budget shares must sum to 100`. Make every automatic budget path produce exactly 10 coins through the same conversion a submitted budget uses. A rules error must never return 409 or block reading the state."

**Fix.** One shared coin-to-engine conversion for every budget path, a test that runs a full game where every phase times out, and state reads that always succeed.

**Lesson.** A misleading status code (409 = "conflict") hid a plain rules bug. Read the error body, not just the status.

---

## 5. The game screen that was there all along

**Symptom.** After the server bug was fixed, every request returned `200` and the console was clean — but both screens still showed only a header and footer.

**How it was found.** No error, no crash, correct data arriving: so the page was rendering something it then hid. The cause was one CSS rule, `.in-game .hero { display: none }`, written to hide the lobby — but the live game screen was nested inside the same container.

**Fix.** Remove the rule and hide only the lobby elements. Also added a guard that shows a visible "Unknown game state" message for any state the UI doesn't recognise, so a blank page can't happen silently again.

**Lesson.** A blank screen with no errors is usually layout, not logic.

---

## 6. A click event sent as game data

**Symptom.** After pressing Start, the page showed `Converting circular structure to JSON … HTMLButtonElement … FiberNode`.

**How it was found.** The message names a DOM button and a React internal object being serialised — the signature of `onClick={handleStartGame}`, where React passes the click event in as the first argument. Here that argument was `solo`, so every Start was being treated as a solo game.

**Fix.** `onClick={() => handleStartGame()}`, plus a request builder that only accepts plain values.

---

## 7. The collapse ending that froze

**Symptom.** In a game where the economy was deliberately starved, Veloria collapsed — and the game stayed stuck on the result screen, with "The game has not started" errors on Ready.

**How it was found.** An automated playthrough in "collapse mode" reproduced it every time. Reading the server code showed five places that resolve a year; the first fix had updated three of them. The two it missed handle the common case where everyone votes before the timer runs out.

**Described to the AI as.** "The vote action's resolution paths (around lines 446 and 454) still set `phase:"result"` on collapse. Put the shared year-resolution logic in one helper used by all five paths."

**Fix.** One `applyYearResolution` helper used everywhere; collapse goes straight to the finale.

**Lesson.** When the same rule lives in five places, fixing four is the same as fixing none. Consolidate first.

---

## 8. Bots that sounded identical

**Symptom.** In a game where no human typed, two different bots said the same line back to back, and three bots said "The result is in. I shall pretend I expected it." The next version named whose number was being discussed — but pasted a full sentence into the middle of others: "*inspects Alice says revenue is 119, then tears up the paperwork*".

**How it was found.** Capturing every chat message from an automated silent game and counting duplicates.

**Fix.** Lines belong to exactly one character, are never repeated within a game, and use noun phrases that read naturally: "Bob's Health number (24)?! EITHER A MASTERSTROKE OR A NATIONAL DISGRACE!" The final run: 33 bot lines, 33 unique.

---

## How changes were verified

Every change went through the same loop:

1. A small, specific instruction to the AI — one fix per request, with the exact error text and file location.
2. `npm run typecheck`, `npm test` and `npm run build` on the pushed commit.
3. Redeploy the Edge Function when server code changed.
4. A full automated playthrough in a headless browser with two independent players (desktop and phone sizes), checking the console, every server response for leaked private fields, and screenshots of every phase.

Larger requests ("fix these six things") stalled or came back half-done; single-purpose requests with precise evidence were fixed correctly on the first try.
