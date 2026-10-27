
import { applyEconomicPower } from './engine/power-effects.ts';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { createGameSetup } from './engine/game.ts';
import { createGameFlow, advancePhase, getCurrentPrimeMinister } from './engine/game-flow.ts';
import {
  createInitialState,
  defaultBudget,
  makeCrisis,
  resolveYear,
  mulberry32,
} from './engine/index.ts';
import type { InterestRate, TradeModifier, Budget, YearInputs } from './engine/types.ts';
import { createConditions } from './simulator/simulation.ts';

const terminal = createInterface({ input: stdin, output: stdout });

async function ask(question: string): Promise<string> {
  return (await terminal.question(question)).trim();
}

async function askNumber(question: string, min: number, max: number): Promise<number> {
  while (true) {
    const value = Number(await ask(question));
    if (Number.isInteger(value) && value >= min && value <= max) return value;
    console.log(`Enter a whole number from ${min} to ${max}.`);
  }
}
function showCrisisBriefing(
  crisis: ReturnType<typeof makeCrisis>,
): void {
  const briefings: Record<string, string> = {
    Outbreak:
      'HOSPITALS UNDER PRESSURE: Medical services need support, and public confidence is at risk.',
    'Energy price spike':
      'ENERGY ALERT: Rising costs threaten industry and household stability.',
    Floods:
      'FLOOD WARNING: Communities need urgent help as infrastructure and the environment come under pressure.',
  };

  console.log('\n--- BREAKING NEWS ---');
  console.log(
    briefings[crisis.name] ??
      `NATIONAL ALERT: ${crisis.name} threatens the country. Your cabinet must decide how to respond.`,
  );
  console.log('Every budget choice has consequences. Choose carefully.');
}


async function parliamentaryQuestionTime(
  crisis: ReturnType<typeof makeCrisis>,
  primeMinister: string,
): Promise<number> {
  const questions: Record<string, string[]> = {
    Outbreak: [
      'Why were hospitals caught unprepared for this outbreak?',
      'Will patients come before the budget?',
      'Is the Health Ministry managing a crisis or the headlines?',
    ],
    'Energy price spike': [
      'What is the plan for families facing rising energy costs?',
      'How will businesses manage rising energy costs?',
      'Will the government act before the next electricity bill?',
    ],
    Floods: [
      'Were communities properly prepared for these floods?',
      'Why are we discussing repairs after the damage?',
      'Will the government protect residents or issue more statements?',
    ],
  };

  const fallbackQuestions = [
    `Prime Minister ${primeMinister}, what is the plan for this crisis?`,
    'How will the budget protect ordinary citizens?',
    'Will the cabinet accept responsibility if the plan fails?',
  ];

  const availableQuestions = questions[crisis.name] ?? fallbackQuestions;
  const question =
    availableQuestions[
      Math.floor(Math.random() * availableQuestions.length)
    ]!;

  console.log('\n========== PARLIAMENT QUESTION TIME ==========');
  console.log(`OPPOSITION: "${question}"`);
  console.log('\nChoose your parliamentary response:');
  console.log('1. Defend — stand by the government plan.');
  console.log('2. Concede — acknowledge the problem.');
  console.log('3. Fire back — challenge the opposition.');

  let response = '';

  while (!['1', '2', '3'].includes(response)) {
    response = await ask('Your response (1-3): ');
    if (!['1', '2', '3'].includes(response)) {
      console.log('Choose 1, 2, or 3.');
    }
  }

  if (response === '1') {
    console.log(
      `\n${primeMinister.toUpperCase()}: "This government has a plan. ` +
      'Shouting questions is not a substitute for governing."',
    );
    console.log('SPEAKER: "The House will judge the plan by its results."');
    console.log('Political support: unchanged.');
    return 0;
  }

  if (response === '2') {
    console.log(
      `\n${primeMinister.toUpperCase()}: "The criticism is fair. ` +
      'We must do better, and this cabinet will be held accountable."',
    );
    console.log('OPPOSITION: "We shall remember that promise!"');
    console.log('Political support: +1 for acknowledging the problem.');
    return 1;
  }

  console.log(
    `\n${primeMinister.toUpperCase()}: "If you have a better plan, ` +
    'we are listening. Preferably before the next election."',
  );
  console.log("SPEAKER: 'Order! The election is not on today's agenda.'");
  console.log('Political support: -1 for the confrontational response.');
  return -1;
}




async function ministerialGrilling(
  players: ReturnType<typeof createGameSetup>['players'],
): Promise<void> {
  console.log('\n========== MINISTERIAL GRILLING ==========');

  const ministers = players.filter((player) => player.ministry);

  for (const minister of ministers) {
    console.log(`\nOPPOSITION TO ${minister.name.toUpperCase()}:`);

    switch (minister.ministry) {
      case 'health':
        console.log('"Minister, are hospitals receiving care or another committee?"');
        break;
      case 'finance':
        console.log('"Minister, is this a budget or an expensive cry for help?"');
        break;
      case 'defense':
        console.log('"Minister, are we defending the country or the budget?"');
        break;
      case 'environment':
        console.log('"Are we recycling waste or just recycling press releases?"');
        break;
      case 'education':
        console.log('"What are students learning besides waiting for funding?"');
        break;
      case 'infrastructure':
        console.log('"Will the roads be repaired before the next election?"');
        break;
      case 'trade':
        console.log('"Is this a trade strategy or an expensive shopping trip?"');
        break;
      case 'intelligence':
        console.log('"If everything is secret, how can Parliament judge your work?"');
        break;
      default:
        console.log('"Minister, explain your department’s priorities!"');
        break;
    }

    console.log('\nChoose your response:');
    console.log('1. Defend your department');
    console.log('2. Admit a problem');
    console.log('3. Challenge the opposition');

    let response = '';

    while (!['1', '2', '3'].includes(response)) {
      response = await ask(`${minister.name}, choose (1-3): `);

      if (!['1', '2', '3'].includes(response)) {
        console.log('Please enter 1, 2, or 3.');
      }
    }

    if (response === '1') {
      console.log(
        `${minister.name.toUpperCase()}: "Our department has a plan. ` +
        'We are sticking to it."',
      );
      console.log('OPPOSITION: "We shall be watching!"');
    } else if (response === '2') {
      console.log(
        `${minister.name.toUpperCase()}: "Yes, there are problems. ` +
        'At least we are not pretending otherwise."',
      );
      console.log('SPEAKER: "An unusually honest answer. Order!"');
    } else {
      console.log(
        `${minister.name.toUpperCase()}: "If you have a better plan, ` +
        'the floor is yours!"',
      );
      console.log('OPPOSITION: "We were not expecting a practical question!"');
    }
  }

  console.log('\nSPEAKER: "The grilling is concluded. Parliament will proceed."');
}

function showCountry(country: ReturnType<typeof createInitialState>): void {
  console.log(
    `Economy ${country.economy} | Happiness ${country.happiness} | ` +
    `Stability ${country.stability} | Environment ${country.environment} | Debt ${country.debt}`,
  );
}

function showBudget(budget: Budget): void {
  for (const [sector, share] of Object.entries(budget.shares)) {
    console.log(`  ${sector}: ${share}%`);
  }
  console.log(`  Borrowing: ${budget.borrowing} B`);
}

async function draftBudget(previous: Budget | null): Promise<Budget> {
  console.log('\nBudget shares must add up to exactly 100%.');
  console.log('Enter the percentage for each sector. The last sector is calculated automatically.');

  const sectors: (keyof Budget['shares'])[] = [
    'health', 'education', 'security', 'infrastructure',
    'environment', 'industry', 'debtRepayment',
  ];
  const shares = {} as Budget['shares'];
  let remaining = 100;

  for (let i = 0; i < sectors.length - 1; i++) {
    const sector = sectors[i]!;
    const share = await askNumber(`${sector} (0-${remaining}% remaining): `, 0, remaining);
    shares[sector] = share;
    remaining -= share;
  }

  const lastSector = sectors[sectors.length - 1]!;
  shares[lastSector] = remaining;
  console.log(`${lastSector} automatically receives ${remaining}%.`);

  const borrowing = await askNumber('Borrowing (0-30 B, steps of 5): ', 0, 30);
  if (borrowing % 5 !== 0) {
    console.log('Borrowing must be in steps of 5 B. Using 0 B.');
    return { shares, borrowing: 0 };
  }

  const budget = { shares, borrowing };
  if (previous) {
    console.log('\nPrevious passed budget:');
    showBudget(previous);
  }
  return budget;
}

async function main(): Promise<void> {
  console.log('\n=== CABINET ===');
  console.log('A political strategy game\n');

  const count = await askNumber('How many players? (4-8): ', 4, 8);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    names.push(await ask(`Player ${i + 1} name: `));
  }

  const modeInput = (await ask('Mode: standard or crisis? ')).toLowerCase();
  const mode = modeInput === 'crisis' ? 'crisis' : 'standard';
  const lengthInput = (await ask('Game length: full or quick? ')).toLowerCase();
  const length = lengthInput === 'quick' ? 'quick' : 'full';
  const seed = Number(await ask('Random seed (whole number, e.g. 123): '));

  const setup = createGameSetup(seed, names, mode, length);
  let flow = createGameFlow(setup);
  let country = createInitialState();
let lastPassedBudget: Budget | null = null;
let politicalSupport = 0;
type GovernmentPromise = {
  year: number;
  text: string;
  status: 'In progress' | 'Kept' | 'Broken';
};

const governmentPromises: GovernmentPromise[] = [];
let keptPromises = 0;
let brokenPromises = 0;
let inProgressPromises = 0;
const conditions = createConditions(seed);

  console.log(`\nGame created: ${setup.mode}, ${setup.length}, ${setup.totalYears} years.`);
  console.log('For this local prototype, player roles are displayed together. Do not use this display for secret multiplayer play.');
  for (const player of setup.players) {
    console.log(`${player.seat + 1}. ${player.name} — ${player.ministry}` +
      (player.isMole ? ' — MOLE' : '') + ` — Agenda: ${player.agenda}`);
  }

  while (flow.phase !== 'finished' && !country.collapsed) {
    const yearIndex = flow.setup.year;
    const condition = conditions[yearIndex];
    if (!condition) break;

    const crisis = makeCrisis(condition.crisisId, condition.severity);


   const previousPromises = governmentPromises.filter(
  (promise) =>
    promise.year < yearIndex + 1 &&
    promise.status === 'In progress',
);

    if (previousPromises.length > 0) {
      console.log('\n========== PARLIAMENT REMEMBERS ==========');
      console.log('OPPOSITION: "Prime Minister, we have not forgotten!"');

      for (const promise of previousPromises) {
        console.log(`PROMISE UNDER REVIEW: ${promise}`);
      }

      console.log(
        'SPEAKER: "The government is invited to report its progress."',
      );
    }

    console.log(`\n========== YEAR ${yearIndex + 1} ==========`);
    console.log(`Phase: ${flow.phase}`);
    console.log(`Prime Minister: ${getCurrentPrimeMinister(flow)?.name ?? 'None'}`);
   console.log(`Crisis: ${crisis.name} (severity ${crisis.severity})`);
showCrisisBriefing(crisis);
console.log(`Interest rate: ${(condition.interestRate * 100).toFixed(0)}%`);
    console.log(`Trade modifier: ${condition.revenueTradeModifier}`);
    showCountry(country);

    flow = { ...flow, phase: 'draft' };
    const currentPM = getCurrentPrimeMinister(flow);

        if (currentPM) {
      politicalSupport += await parliamentaryQuestionTime(
        crisis,
        currentPM.name,
      );

      politicalSupport = Math.max(-5, Math.min(5, politicalSupport));

      console.log(
        `\nPUBLIC SUPPORT: ${politicalSupport >= 0 ? '+' : ''}${politicalSupport} points`,
      );

      await ministerialGrilling(setup.players);
    }
    let failedVotes = 0;
let yearExtraRevenue = 0;

let yearDelayedTradeEffects: {
  dueYear: number;
  indicator: 'stability';
  amount: number;
  cause: string;
}[] = [];
    let resolved = false;

    while (!resolved && !country.collapsed) {
      const pm = getCurrentPrimeMinister(flow);
      if (!pm) throw new Error('No eligible Prime Minister.');

      console.log(`\n${pm.name} is drafting the budget.`);
      let budget = await draftBudget(lastPassedBudget);

      const errors = (await import('./engine/economy.ts')).validateBudget(budget);
      if (errors.length) {
        console.log(`Budget invalid: ${errors.join(' ')}`);
        budget = defaultBudget();
        console.log('Using the default budget instead.');
      }

      console.log('\nProposed budget:');
      showBudget(budget);



const tradePlayer = flow.setup.players.find(
  (player) => player.ministry === 'trade' && !player.powerUsed,
);


if (tradePlayer && flow.phase === 'draft') {
  const useTradeDeal = (
    await ask(`${tradePlayer.name}, use Trade Deal (+15 revenue now, -6 stability next year)? (y/n): `)
  ).toLowerCase();

  if (useTradeDeal === 'y' || useTradeDeal === 'yes') {
    const powerResult = applyEconomicPower(
      flow,
      tradePlayer.id,
      'trade-deal',
      {
        revenueTradeModifier: condition.revenueTradeModifier as TradeModifier,
        interestRate: condition.interestRate as InterestRate,
        crisis,
      },
      budget,
    );

    flow = powerResult.flow;
    yearExtraRevenue += powerResult.inputs.extraRevenue ?? 0;
yearDelayedTradeEffects.push(...powerResult.delayedEffects);
    console.log('Trade Deal activated: +15 revenue this year; -6 stability next year.');
  }
}

      


console.log('\n========== GOVERNMENT NEGOTIATIONS ==========');
console.log('The opposition demands a commitment from the government.');
console.log('1. Make a public promise');
console.log('2. Refuse to make a promise');

let concessionChoice = '';

while (!['1', '2'].includes(concessionChoice)) {
  concessionChoice = await ask('Your choice (1-2): ');

  if (!['1', '2'].includes(concessionChoice)) {
    console.log('Please enter 1 or 2.');
  }
}

if (concessionChoice === '1') {
  const promise = await ask(
    'What will the government promise to address? ',
  );

  if (promise.trim().length > 0) {
    governmentPromises.push({
  year: flow.setup.year + 1,
  text: promise.trim(),
  status: 'In progress',
});

    console.log(`GOVERNMENT PROMISE RECORDED: "${promise.trim()}"`);
    console.log('OPPOSITION: "We shall hold you to that promise!"');
  } else {
    console.log('No promise was recorded because the response was empty.');
  }
} else {
  console.log('GOVERNMENT: "We will not make promises we cannot guarantee."');
  console.log('OPPOSITION: "The voters will remember this!"');
}

console.log(`Outstanding promises: ${governmentPromises.length}`);


console.log('\n========== PARLIAMENTARY VOTE ==========');
console.log(`Government political support: ${politicalSupport >= 0 ? '+' : ''}${politicalSupport}`);

if (politicalSupport <= -3) {
  console.log('PARLIAMENT: "This government has some explaining to do!"');
} else if (politicalSupport >= 3) {
  console.log('GOVERNMENT: "The public is giving us room to act!"');
}

let yes = 0;
let no = 0;

console.log('\nVoting begins. Each player must vote yes or no.');

for (const player of setup.players) {
  console.log(
    politicalSupport <= -3
      ? `${player.name}, the government is under pressure. Vote yes or no (y/n): `
      : `${player.name}, vote yes or no (y/n): `,
  );

  while (true) {
    const vote = (await ask('Your vote: ')).toLowerCase();

    if (vote === 'y' || vote === 'yes') {
      yes++;
      break;
    }

    if (vote === 'n' || vote === 'no') {
      no++;
      break;
    }

    console.log('Please enter y for yes or n for no.');
  }
}

console.log(`\nVote result: ${yes} yes, ${no} no.`);
const passed = yes > no;

      if (!passed && failedVotes === 0) {
        failedVotes = 1;
        console.log('Budget rejected. The next eligible player becomes Prime Minister and must redraft.');
        const next = setup.players.find(p => p.seat > pm.seat && p.connected && !p.expelled)
          ?? setup.players.find(p => p.connected && !p.expelled);
        if (!next) throw new Error('No eligible player to redraft.');
        flow = { ...flow, primeMinisterId: next.id, phase: 'draft' };
        continue;
      }

      let usedBudget = budget;
      let shutdown = false;
      if (!passed) {
        if (!lastPassedBudget) {
          console.log('No earlier passed budget exists; using the default budget as the shutdown fallback.');
          usedBudget = defaultBudget();
        } else {
          usedBudget = lastPassedBudget;
        }
        shutdown = true;
        console.log('Second vote failed: government shutdown rules apply.');
      } else {
        lastPassedBudget = budget;
        console.log('Budget passed!');
      }

      const inputs: YearInputs = {
  revenueTradeModifier: condition.revenueTradeModifier as TradeModifier,
  interestRate: condition.interestRate as InterestRate,
  crisis,
  shutdown,
  extraRevenue: yearExtraRevenue,
};

      const result = resolveYear(country, usedBudget, inputs);

country = {
  ...result.state,
  delayedEffects: [
    ...result.state.delayedEffects,
    ...yearDelayedTradeEffects,
  ],
};
      console.log(`\nRevenue: ${result.revenue} | Interest: ${result.interest} | Funds available: ${result.availableFunds}`);
      console.log(`Budget scale: ${result.budgetScale}`);
      console.log('Yearly outcome:');
      for (const indicator of ['economy', 'happiness', 'stability', 'environment', 'debt'] as const) {
        const change = result.changes[indicator];
        console.log(`  ${indicator}: ${change.before} → ${change.after}`);
      }

      const highlights = [
        { name: 'Economy', value: result.changes.economy.after - result.changes.economy.before },
        { name: 'Happiness', value: result.changes.happiness.after - result.changes.happiness.before },
        { name: 'Stability', value: result.changes.stability.after - result.changes.stability.before },
        { name: 'Environment', value: result.changes.environment.after - result.changes.environment.before },
        { name: 'Debt', value: result.changes.debt.after - result.changes.debt.before },
      ];

      const biggestChange = highlights.reduce((largest, current) =>
        Math.abs(current.value) > Math.abs(largest.value) ? current : largest,
      );

      console.log(
        `\nCABINET REPORT: ${biggestChange.name} changed most this year ` +
        `(${biggestChange.value > 0 ? '+' : ''}${biggestChange.value}).`,
      );
      if (country.collapsed) {
        console.log(`\nCOUNTRY COLLAPSED: ${country.collapseReasons.join(', ')}`);
        break;
      }

      ;

flow = { ...flow, phase: 'resolve' };
flow = advancePhase(flow);


      resolved = true;
    }
  }

  console.log('\n========== GAME OVER ==========');
  showCountry(country);
  console.log(country.collapsed ? 'The country collapsed.' : 'The game reached its end.');
}

main()
  .catch((error: unknown) => {
    console.error('\nCould not run game:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => terminal.close());
