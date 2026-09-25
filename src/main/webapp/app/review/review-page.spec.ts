import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoApi } from '../api/todo-api';
import { BoardStore } from '../board/board-store';
import { ReviewPage } from './review-page';

/**
 * A sweep is a queue held on the client, so a card can go stale mid-sweep — the task completed on
 * another device. Every decision then refuses, and the sweep has to survive that.
 */
describe('the review sweep', () => {
  const card = (id: number, title: string) => ({
    id,
    title,
    zone: 'OPPORTUNITY_NOW' as const,
    state: 'TODO' as const,
    listId: 1,
    listName: 'Inbox',
    labels: [],
  });

  let reviewQueue: ReturnType<typeof vi.fn>;
  let markReviewed: ReturnType<typeof vi.fn>;
  let moveZone: ReturnType<typeof vi.fn>;

  const press = async (fixture: ComponentFixture<ReviewPage>, label: string) => {
    const button: HTMLButtonElement = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim().startsWith(label),
    );
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement.textContent as string;
  };

  const render = async (): Promise<ComponentFixture<ReviewPage>> => {
    const fixture = TestBed.createComponent(ReviewPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    reviewQueue = vi.fn(() =>
      of([card(1, 'Fix the tile'), card(2, 'Renew passport'), card(3, 'Book the dentist')]),
    );
    markReviewed = vi.fn(async () => 'done');
    moveZone = vi.fn(async () => 'done');
    TestBed.configureTestingModule({
      providers: [
        { provide: TodoApi, useValue: { reviewQueue } },
        {
          provide: BoardStore,
          useValue: {
            filter: signal({}),
            online: signal(true),
            lists: signal([]),
            markReviewed,
            moveZone,
            defer: vi.fn(async () => 'done'),
            complete: vi.fn(async () => 'done'),
            remove: vi.fn(async () => 'done'),
          },
        },
      ],
    });
  });

  it('moves on when a decision is accepted', async () => {
    const fixture = await render();
    expect(await press(fixture, 'Leave it')).toContain('Renew passport');
  });

  /**
   * The count is the assertion that bites: advancing past the card blindly would also show the
   * next title, but it would still claim three cards are due when only two are.
   */
  it('drops a card settled elsewhere rather than sticking, and does not count it', async () => {
    // Completed on another device mid-sweep, so the server refuses every change to it.
    markReviewed.mockResolvedValue('settled');
    const fixture = await render();

    const shown = await press(fixture, 'Leave it');

    expect(shown).toContain('Renew passport');
    expect(shown).not.toContain('Fix the tile');
    expect(shown).toContain('1 of 2');
    expect(reviewQueue).toHaveBeenCalledTimes(1);
  });

  it('drops it for a refused promote too, not only for the simplest decision', async () => {
    moveZone.mockResolvedValue('settled');
    const fixture = await render();

    const shown = await press(fixture, 'Critical Now');

    expect(shown).toContain('Renew passport');
    expect(shown).toContain('1 of 2');
    expect(markReviewed).not.toHaveBeenCalled();
  });

  it('lets a move stand as the review, since the server records it with the move', async () => {
    const fixture = await render();

    const shown = await press(fixture, 'Critical Now');

    expect(moveZone).toHaveBeenCalledTimes(1);
    expect(markReviewed).not.toHaveBeenCalled();
    expect(shown).toContain('Renew passport');
  });

  it('keeps the card when the decision never reached the server, since nothing was decided', async () => {
    markReviewed.mockResolvedValue('refused');
    const fixture = await render();

    const shown = await press(fixture, 'Leave it');

    expect(shown).toContain('Fix the tile');
    expect(shown).toContain('1 of 3');
  });
});
