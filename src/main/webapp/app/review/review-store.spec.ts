import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Zone } from '../api/model';
import { TodoApi } from '../api/todo-api';
import { BoardStore } from '../board/board-store';
import { Writes } from '../core/writes';
import { ReviewStore } from './review-store';

/**
 * The sweep is a board of what is due. What makes it honest is that a row goes the moment its
 * decision lands, and stays when the decision did not.
 */
describe('the review sweep', () => {
  const card = (id: number, zone: Zone) => ({
    id,
    title: `Task ${id}`,
    zone,
    state: 'TODO' as const,
    listId: 1,
    listName: 'Inbox',
    labels: [],
  });

  const load = (zone: Zone, open: number, softCap?: number) => ({
    zone,
    open,
    softCap,
    overSoftCap: softCap !== undefined && open > softCap,
  });

  const gone = () => throwError(() => ({ status: 404 }));
  const unreachable = () => throwError(() => ({ status: 0 }));

  let api: Record<string, ReturnType<typeof vi.fn>>;
  let board: Record<string, ReturnType<typeof vi.fn>>;
  /** What the server still counts as due: a decision that lands takes a task out of it. */
  let due: ReturnType<typeof card>[];
  const settle = (...ids: number[]) => (due = due.filter((task) => !ids.includes(task.id)));

  const store = async () => {
    const review = TestBed.inject(ReviewStore);
    await review.load();
    return review;
  };

  const ids = (review: ReviewStore) => review.zones().flatMap((z) => z.tasks.map((t) => t.id));

  beforeEach(() => {
    due = [card(1, 'CRITICAL_NOW'), card(2, 'OPPORTUNITY_NOW'), card(3, 'OPPORTUNITY_NOW')];
    api = {
      reviewQueue: vi.fn(() => of(due)),
      board: vi.fn(() =>
        of({
          zones: [
            load('CRITICAL_NOW', 3, 5),
            load('OPPORTUNITY_NOW', 13, 20),
            load('OVER_THE_HORIZON', 83),
          ],
          tasks: [],
        }),
      ),
      markReviewed: vi.fn((id: number) => (settle(id), of({}))),
      moveZone: vi.fn((id: number) => (settle(id), of({}))),
      defer: vi.fn((id: number) => (settle(id), of({}))),
      delete: vi.fn((id: number) => (settle(id), of(undefined))),
      markAllReviewed: vi.fn((ids: number[]) => (settle(...ids), of([]))),
      moveAllTo: vi.fn((ids: number[]) => (settle(...ids), of([]))),
      deferAll: vi.fn((ids: number[]) => (settle(...ids), of([]))),
    };
    board = { refresh: vi.fn(async () => undefined), sync: vi.fn(async () => undefined) };
    TestBed.configureTestingModule({
      providers: [
        ReviewStore,
        { provide: TodoApi, useValue: api },
        {
          provide: BoardStore,
          useValue: { ...board, filter: signal({ label: 'house' }), online: signal(true) },
        },
      ],
    });
  });

  it("gives a row only to what is due, and each zone the board's total", async () => {
    const review = await store();

    const [critical, opportunity, horizon] = review.zones();
    expect(critical.tasks.map((t) => t.id)).toEqual([1]);
    expect(critical.open).toBe(3);
    expect(opportunity.tasks.map((t) => t.id)).toEqual([2, 3]);
    expect(opportunity.open).toBe(13);
    expect(horizon.tasks).toEqual([]);
    expect(horizon.open).toBe(83);
  });

  /** Tasks are weighed against each other across topics and lists, and the caps count them all. */
  it('sweeps everything, whatever the board happens to be narrowed to', async () => {
    await store();

    expect(api['reviewQueue']).toHaveBeenCalledWith({});
    expect(api['board']).toHaveBeenCalledWith({});
  });

  it('recounts the zones after a decision, since a move changes two of them', async () => {
    const review = await store();

    await review.move(review.zones()[1].tasks[0], 'CRITICAL_NOW');

    expect(api['board']).toHaveBeenCalledTimes(2);
  });

  /** Stale counts are better than a decision that looks as if it failed. */
  it('keeps the counts it has when recounting fails after a decision landed', async () => {
    const review = await store();
    api['board'].mockReturnValue(unreachable());

    await expect(review.move(review.zones()[1].tasks[0], 'CRITICAL_NOW')).resolves.toBeUndefined();

    expect(ids(review)).toEqual([1, 3]);
    expect(review.zones()[0].open).toBe(3);
  });

  /** The row waits for nothing but its own write; the board catches up when it is next opened. */
  it('leaves the board alone, which the sweep never shows', async () => {
    const review = await store();

    await review.reviewed(review.zones()[1].tasks[0]);

    expect(board['refresh']).not.toHaveBeenCalled();
    expect(board['sync']).not.toHaveBeenCalled();
  });

  it('drops a task once it is marked reviewed', async () => {
    const review = await store();

    await review.reviewed(review.zones()[1].tasks[0]);

    expect(api['markReviewed']).toHaveBeenCalledWith(2);
    expect(ids(review)).toEqual([1, 3]);
    expect(review.remaining()).toBe(2);
  });

  it('drops a task moved or deferred, since deciding that was the review', async () => {
    const review = await store();
    const [first, second] = review.zones()[1].tasks;

    await review.move(first, 'CRITICAL_NOW');
    await review.defer(second, 7);

    expect(api['moveZone']).toHaveBeenCalledWith(2, 'CRITICAL_NOW');
    expect(api['defer']).toHaveBeenCalledWith(3, expect.any(String));
    expect(api['markReviewed']).not.toHaveBeenCalled();
    expect(ids(review)).toEqual([1]);
  });

  it('keeps a task whose decision never reached the server, since nothing was decided', async () => {
    api['markReviewed'].mockReturnValue(unreachable());
    const review = await store();

    await review.reviewed(review.zones()[1].tasks[0]);

    expect(ids(review)).toEqual([1, 2, 3]);
    expect(TestBed.inject(Writes).problem()).toMatch(/connection/i);
  });

  it('drops a task settled elsewhere rather than offering it again', async () => {
    api['delete'].mockImplementation((id: number) => (settle(id), gone()));
    const review = await store();

    await review.remove(review.zones()[0].tasks[0]);

    expect(ids(review)).toEqual([2, 3]);
    expect(TestBed.inject(Writes).problem()).toMatch(/completed or deleted/i);
  });

  it('selects everything due in a zone, and nothing else', async () => {
    const review = await store();

    review.selectZone('OPPORTUNITY_NOW', true);

    expect([...review.selected()]).toEqual([2, 3]);
    expect(review.selecting()).toBe(true);
  });

  it('settles a selection in one request, and drops it', async () => {
    const review = await store();
    review.selectZone('OPPORTUNITY_NOW', true);

    await review.reviewedAll();

    expect(api['markAllReviewed']).toHaveBeenCalledTimes(1);
    expect(api['markAllReviewed']).toHaveBeenCalledWith([2, 3]);
    expect(ids(review)).toEqual([1]);
    expect(review.selecting()).toBe(false);
  });

  it('moves and defers a selection the same way', async () => {
    const review = await store();
    review.toggle(review.zones()[0].tasks[0]);
    await review.moveAll('OVER_THE_HORIZON');
    review.toggle(review.zones()[1].tasks[0]);
    await review.deferAll(30);

    expect(api['moveAllTo']).toHaveBeenCalledWith([1], 'OVER_THE_HORIZON');
    expect(api['deferAll']).toHaveBeenCalledWith([2], expect.any(String));
    expect(ids(review)).toEqual([3]);
  });

  it('keeps a refused selection selected, so it can be tried again', async () => {
    api['markAllReviewed'].mockReturnValue(unreachable());
    const review = await store();
    review.selectZone('OPPORTUNITY_NOW', true);

    await review.reviewedAll();

    expect(ids(review)).toEqual([1, 2, 3]);
    expect([...review.selected()]).toEqual([2, 3]);
  });

  /**
   * The server refuses the lot without saying which task it has moved past, so ask it again — and
   * keep the rest selected, so the same choice can be sent again without it.
   */
  it('reloads rather than guesses when the server has moved past part of a selection', async () => {
    api['markAllReviewed'].mockReturnValue(
      throwError(() => ({ status: 409, error: { error: 'task_completed' } })),
    );
    const review = await store();
    review.selectZone('OPPORTUNITY_NOW', true);
    api['reviewQueue'].mockReturnValue(of([card(1, 'CRITICAL_NOW'), card(3, 'OPPORTUNITY_NOW')]));

    await review.reviewedAll();

    expect(api['reviewQueue']).toHaveBeenCalledTimes(2);
    expect(ids(review)).toEqual([1, 3]);
    expect([...review.selected()]).toEqual([3]);
    expect(TestBed.inject(Writes).problem()).toMatch(/none of them changed/i);
  });

  it('keeps the rows and the selection when that reload fails too', async () => {
    api['markAllReviewed'].mockReturnValue(
      throwError(() => ({ status: 409, error: { error: 'task_completed' } })),
    );
    const review = await store();
    review.selectZone('OPPORTUNITY_NOW', true);
    api['reviewQueue'].mockReturnValue(unreachable());

    await expect(review.reviewedAll()).resolves.toBeUndefined();

    expect(ids(review)).toEqual([1, 2, 3]);
    expect([...review.selected()]).toEqual([2, 3]);
  });

  /** Two decisions in quick succession ask twice, and the older answer may be the slower one. */
  it('lets only the newest answer stand, so a slow one cannot bring a settled row back', async () => {
    const review = await store();
    const [first, second] = review.zones()[1].tasks;
    const slow = new Subject<ReturnType<typeof card>[]>();
    api['reviewQueue'].mockReturnValueOnce(slow);
    api['reviewQueue'].mockReturnValueOnce(of([card(1, 'CRITICAL_NOW')]));

    const deciding = review.reviewed(first);
    await Promise.resolve();
    await review.reviewed(second);
    slow.next([card(1, 'CRITICAL_NOW'), card(3, 'OPPORTUNITY_NOW')]);
    slow.complete();
    await deciding;

    expect(ids(review)).toEqual([1]);
  });

  it('counts down what is left, against what has been settled so far', async () => {
    const review = await store();

    await review.reviewed(review.zones()[0].tasks[0]);

    expect(review.remaining()).toBe(2);
    expect(review.progress()).toBeCloseTo(100 / 3);
  });
});
