import type { CrisisCard, CrisisCategory } from './types.ts';

export const CRISIS_CATEGORIES: CrisisCategory[] = ['Health', 'Disaster', 'Security', 'Economy', 'Climate', 'Social'];

/** Card templates use severity 1 as the multiplier; scaleCrisis applies the chosen severity. */
export const CRISIS_TEMPLATES: Omit<CrisisCard, 'severity' | 'unavoidableHits' | 'needChanges' | 'revenueChange'>[] = [
  { id: 'outbreak', name: 'Outbreak', category: 'Health' },
  { id: 'floods', name: 'Floods', category: 'Disaster' },
  { id: 'border-tension', name: 'Border tension', category: 'Security' },
  { id: 'recession', name: 'Recession', category: 'Economy' },
  { id: 'heatwave', name: 'Heatwave', category: 'Climate' },
  { id: 'teacher-strike', name: 'Teacher strike', category: 'Social' },
  { id: 'cyberattack', name: 'Cyberattack', category: 'Security' },
  { id: 'housing-shortage', name: 'Housing shortage', category: 'Social' },
  { id: 'energy-price-spike', name: 'Energy price spike', category: 'Economy' },
  { id: 'protests', name: 'Protests', category: 'Social' },
  { id: 'export-boom', name: 'Export boom', category: 'Economy' },
  { id: 'tech-breakthrough', name: 'Tech breakthrough', category: 'Economy' },
];

export function makeCrisis(id: string, severity: 1 | 2 | 3): CrisisCard {
  const templates: Record<string, Omit<CrisisCard, 'severity'>> = {
    outbreak: { id, name: 'Outbreak', category: 'Health', unavoidableHits: { happiness: -3 * severity }, needChanges: { health: 8 * severity } },
    floods: { id, name: 'Floods', category: 'Disaster', unavoidableHits: { economy: -2 * severity }, needChanges: { infrastructure: 8 * severity } },
    'border-tension': { id, name: 'Border tension', category: 'Security', unavoidableHits: { stability: -3 * severity }, needChanges: { security: 8 * severity } },
    recession: { id, name: 'Recession', category: 'Economy', unavoidableHits: { happiness: -1 * severity }, needChanges: {}, revenueChange: -6 * severity },
    heatwave: { id, name: 'Heatwave', category: 'Climate', unavoidableHits: { environment: -3 * severity, happiness: -1 * severity }, needChanges: { environment: 6 * severity } },
    'teacher-strike': { id, name: 'Teacher strike', category: 'Social', unavoidableHits: { happiness: -2 * severity }, needChanges: { education: 6 * severity } },
    cyberattack: { id, name: 'Cyberattack', category: 'Security', unavoidableHits: { economy: -2 * severity }, needChanges: { security: 5 * severity, infrastructure: 4 * severity } },
    'housing-shortage': { id, name: 'Housing shortage', category: 'Social', unavoidableHits: { happiness: -2 * severity }, needChanges: { infrastructure: 6 * severity } },
    'energy-price-spike': { id, name: 'Energy price spike', category: 'Economy', unavoidableHits: { economy: -2 * severity }, needChanges: { industry: 6 * severity } },
    protests: { id, name: 'Protests', category: 'Social', unavoidableHits: { stability: -3 * severity }, needChanges: { security: 4 * severity } },
    'export-boom': { id, name: 'Export boom', category: 'Economy', unavoidableHits: {}, needChanges: {}, revenueChange: 6 * severity },
    'tech-breakthrough': { id, name: 'Tech breakthrough', category: 'Economy', unavoidableHits: { economy: 2 * severity }, needChanges: {} },
  };
  const card = templates[id];
  if (!card) throw new Error(`Unknown crisis: ${id}`);
  return { ...card, severity };
}
