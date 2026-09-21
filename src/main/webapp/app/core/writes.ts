import { Injectable, signal } from '@angular/core';

/**
 * What a write did. `settled` means the server has already moved past the thing being changed, so a
 * caller holding its own copy of it — a review card — should let that copy go rather than leave it
 * to be decided again.
 */
export type WriteResult = 'done' | 'settled' | 'refused';

interface Failure {
  status?: number;
  error?: { error?: string; message?: string; fields?: Record<string, string> };
}

/** Never throws: it runs inside the one catch that has no catch of its own. */
const asFailure = (error: unknown): Failure => (error as Failure | null) ?? {};

/**
 * A refusal that means the caller is acting on a copy the server has moved past: the task was
 * completed or deleted, the list is gone. Nothing is wrong with the decision — the screen is out of
 * date, so the caller should let go of what it was holding rather than offer a retry.
 *
 * A 404 qualifies on its status alone, because one that carries no body at all still means the
 * thing is not there. A 409 does not: it is the answer to any state refusal, so only the one that
 * names a completed task says the screen is behind.
 */
const isStale = (error: unknown): boolean => {
  const failure = asFailure(error);
  return (
    failure.status === 404 || (failure.status === 409 && failure.error?.error === 'task_completed')
  );
};

const REFUSED = 'The server would not accept that.';

/**
 * A status cannot say what was asked for — the same 404 answers a missing list and a missing
 * account — so the caller supplies the sentence for a stale refusal. Every other refusal on its
 * merits carries its own: `validation_failed` says only "Request body is invalid", so its fields
 * are read out instead, and anything else has already written a sentence for a person. What is
 * left is shown as a connection problem, because that is what it almost always is.
 */
const reasonFor = (error: unknown, stale: string): string => {
  if (isStale(error)) {
    return stale;
  }
  const { status, error: body } = asFailure(error);
  const fields = Object.values(body?.fields ?? {}).join(' ');
  if (status === 400) {
    return body?.error === 'validation_failed'
      ? fields || body.message || REFUSED
      : body?.message || fields || REFUSED;
  }
  if (status === 409) {
    return body?.message || REFUSED;
  }
  return 'That did not work. Try again when you have a connection.';
};

/**
 * The one place that says a write failed — a refused change that is only rolled back off the screen
 * reads exactly like a click that did nothing. Writes with an offline story do not come through
 * here: the outbox keeps those, so there is nothing yet to report.
 *
 * Reloading afterwards is the caller's, because the screens disagree about it for a reason: the
 * board reloads even on a refusal, since a refusal usually means the board is stale.
 */
@Injectable({ providedIn: 'root' })
export class Writes {
  private readonly failure = signal<string | null>(null);

  readonly problem = this.failure.asReadonly();

  /** `stale` is what to say when the server has moved past the thing the caller is changing. */
  async attempt(change: () => Promise<unknown>, stale: string): Promise<WriteResult> {
    this.failure.set(null);
    try {
      await change();
      return 'done';
    } catch (error) {
      this.failure.set(reasonFor(error, stale));
      return isStale(error) ? 'settled' : 'refused';
    }
  }

  dismiss(): void {
    this.failure.set(null);
  }
}
