# Cabinet — M1 engine starter

This is the first runnable implementation slice for Cabinet, based on the supplied Game Specification v1. It intentionally starts with the deterministic economy engine and tests before multiplayer.

## Requirements

* Node.js 20+

## Run it

```bash
npm install
npm test
npm run typecheck
npm run sim          # 1,000 seeds for a quick smoke run
SEEDS=10000 npm run sim
```

## Included

* Country starting state and indicator caps/collapse lines
* Budget validation and funding-effect function
* Crisis templates and shared crisis-category enum
* Pure `resolveYear` engine with delayed effects, labelled cause lines, clamping and collapse detection
* Exhaustive projection enumeration over revenue, severity and interest rate
* Deterministic PRNG
* Vitest starter tests
* Baseline seeded economy smoke simulator

## Important M1 scope note

This is a **starter implementation**, not yet a claim that the full M1 acceptance gate passes. The spec leaves some details to tune, and several M1 pieces still need implementing: exact shutdown budget scaling, power-aware resolution inputs, the four fully specified simulator strategies, full 10,000-seed result rows, and broad randomized/property tests. Treat all current balance outputs as smoke-test data only.

The projection API accepts an exact revenue override so the same `resolveYear` logic is used for projections and actual outcomes. Production integration should derive the allowed revenue values from the public 20-wide interval and the hidden modifiers, rather than passing arbitrary values into the public API.

