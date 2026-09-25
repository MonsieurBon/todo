import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Zone } from '../api/model';
import { TodoApi } from '../api/todo-api';
import { BoardStore } from '../board/board-store';
import { ReviewPage } from './review-page';

/** The sweep as a board: only what is due has a row, and a decided row goes. */
describe('the review board', () => {
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
    overSoftCap: false,
  });

  let reviewQueue: ReturnType<typeof vi.fn>;
  let markReviewed: ReturnType<typeof vi.fn>;
  let markAllReviewed: ReturnType<typeof vi.fn>;
  let online: WritableSignal<boolean>;

  const render = async (): Promise<ComponentFixture<ReviewPage>> => {
    const fixture = TestBed.createComponent(ReviewPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: ComponentFixture<ReviewPage>): string => fixture.nativeElement.textContent;

  const click = async (fixture: ComponentFixture<ReviewPage>, selector: string) => {
    fixture.nativeElement.querySelector(selector).click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    // What the server still counts as due: a decision that lands takes a task out of it.
    let due = [card(1, 'CRITICAL_NOW'), card(2, 'OPPORTUNITY_NOW'), card(3, 'OPPORTUNITY_NOW')];
    const settle = (...ids: number[]) => (due = due.filter((task) => !ids.includes(task.id)));
    reviewQueue = vi.fn(() => of(due));
    markReviewed = vi.fn((id: number) => (settle(id), of({})));
    markAllReviewed = vi.fn((ids: number[]) => (settle(...ids), of([])));
    online = signal(true);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TodoApi,
          useValue: {
            reviewQueue,
            markReviewed,
            markAllReviewed,
            board: () =>
              of({
                zones: [
                  load('CRITICAL_NOW', 3, 5),
                  load('OPPORTUNITY_NOW', 13, 20),
                  load('OVER_THE_HORIZON', 83),
                ],
                tasks: [],
              }),
          },
        },
        {
          provide: BoardStore,
          useValue: { online, lists: signal([]) },
        },
      ],
    });
  });

  it("gives each due task a row, and each zone the board's total", async () => {
    const fixture = await render();
    const zones = [...fixture.nativeElement.querySelectorAll('section.zone')].map(
      (zone: HTMLElement) => zone.textContent!.replace(/\s+/g, ' '),
    );

    expect(zones[0]).toContain('Task 1');
    expect(zones[0]).toContain('3 / 5');
    expect(zones[1]).toContain('Task 2');
    expect(zones[1]).toContain('13 / 20');
    expect(zones[2]).toContain('83');
    expect(zones[2]).toContain('Nothing due.');
  });

  it('takes a row away the moment it is marked reviewed', async () => {
    const fixture = await render();

    await click(fixture, 'button[aria-label="Mark Task 2 reviewed"]');

    expect(markReviewed).toHaveBeenCalledTimes(1);
    expect(text(fixture)).not.toContain('Task 2');
    expect(text(fixture)).toContain('2 left to review');
  });

  it('offers neither editing nor completing: those belong to the board', async () => {
    const fixture = await render();
    const labels = [...fixture.nativeElement.querySelectorAll('button')].map((b: Element) =>
      b.getAttribute('aria-label'),
    );

    expect(labels.filter((l) => l?.startsWith('Edit ') || l?.startsWith('Complete '))).toEqual([]);
  });

  it('ticks a whole zone from its header, and acts on the selection from the bar', async () => {
    const fixture = await render();

    await click(fixture, 'input[aria-label="Select everything due in Opportunity Now"]');

    expect(text(fixture)).toContain('2 selected');
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Mark Task 1 reviewed"]'),
    ).toBeNull();

    await click(fixture, '.bulk button.reviewed');

    expect(markAllReviewed).toHaveBeenCalledWith([2, 3]);
    expect(text(fixture)).not.toContain('Task 2');
    expect(text(fixture)).not.toContain('selected');
  });

  /** Replayed blind from the outbox, a move or a deferral is a silent overwrite. */
  it('needs a connection for anything done to a selection', async () => {
    online.set(false);
    const fixture = await render();

    await click(fixture, 'input[aria-label="Select everything due in Opportunity Now"]');

    const actions: HTMLButtonElement[] = [
      ...fixture.nativeElement.querySelectorAll('.bulk .actions button'),
    ];
    expect(actions.map((b) => b.textContent!.trim())).toEqual(['Reviewed', 'Move to…', 'Defer…']);
    expect(actions.every((b) => b.disabled)).toBe(true);
  });

  it('says there is nothing to review when nothing is due', async () => {
    reviewQueue.mockReturnValue(of([]));
    const fixture = await render();

    expect(text(fixture)).toContain('Nothing is due for review.');
  });
});
