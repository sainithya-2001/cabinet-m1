export type LiteCollapseVerdict = { outcome: "Mole wins"; reason: "collapse"; collapsedIndicator: string; moleName: string | undefined };
export function liteCollapseVerdict(collapsed: boolean, indicators: string[], moleName: string | undefined): LiteCollapseVerdict | null {
  if (!collapsed) return null;
  return { outcome: "Mole wins", reason: "collapse", collapsedIndicator: indicators[0] ?? "unknown", moleName };
}
