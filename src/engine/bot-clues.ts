export function botClueValue(botName: string, ministry: string, truth: number, isMole: boolean): number {
  const finance = ministry === 'Finance';
  const min = finance ? 60 : 0;
  const max = finance ? 140 : 60;
  let value = truth;
  if (isMole) {
    value = finance ? truth + 18 : truth - Math.max(1, Math.round(Math.abs(truth) * 0.2));
    if (botName === 'Baroness Slowclap' && !finance) value = truth * 1.2;
  } else if (botName === 'Baroness Slowclap') value = truth * 0.8;
  else if (botName === 'The Hon. Member for Shouting') value = truth * 1.3;
  else if (botName === 'Lord Ribbon-Cutter') value = truth * 1.2;
  return Math.max(min, Math.min(max, Math.round(value)));
}
