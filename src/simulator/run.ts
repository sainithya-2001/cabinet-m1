import { PARAMS_VERSION } from '../engine/index.js';
import { runSimulation } from './simulation.js';

const seeds = Math.max(
  1,
  Math.floor(Number(process.env.SEEDS ?? 1000))
);

const simulation = runSimulation({ seeds });

console.log(
  JSON.stringify(
    {
      ...simulation,
      paramsVersion: PARAMS_VERSION,
    },
    null,
    2
  )
);