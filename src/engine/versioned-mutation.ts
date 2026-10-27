export const MAX_VERSIONED_MUTATION_ATTEMPTS = 12;

export type VersionedState = { version: number };
export type StateRead<S, Status extends string = string> = { state: S | null; status: Status };
export type MutationDecision<S, Status extends string = string> = {
  state: S;
  status?: Status;
  changed?: boolean;
};
export type VersionedStateAdapter<S extends VersionedState, Status extends string = string> = {
  read(): Promise<StateRead<S, Status>>;
  compareAndSwap(expectedVersion: number | null, next: S, status: Status): Promise<boolean>;
};

/** Re-apply an action to the latest state and commit only against the version read. */
export async function mutateVersionedState<S extends VersionedState, Status extends string = string>(
  adapter: VersionedStateAdapter<S, Status>,
  apply: (latest: S | null, status: Status) => MutationDecision<S, Status>,
  maxAttempts = MAX_VERSIONED_MUTATION_ATTEMPTS,
): Promise<StateRead<S, Status>> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { state: latest, status } = await adapter.read();
    const decision = apply(latest, status);
    if (decision.changed === false && latest) return { state: latest, status };
    const next = { ...decision.state, version: (latest?.version ?? 0) + 1 } as S;
    const nextStatus = decision.status ?? (next as S & { status?: Status }).status ?? status;
    if (await adapter.compareAndSwap(latest?.version ?? null, next, nextStatus)) {
      return { state: next, status: nextStatus };
    }
  }
  throw new Error(`Please try again. Version conflict after ${maxAttempts} save attempts.`);
}
