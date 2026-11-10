import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardTask } from '../board/board-store';
import { TaskDetail } from '../board/task-detail';
import { DeferDialog } from '../core/defer-dialog';
import { ReviewRow } from './review-row';
import { ReviewStore } from './review-store';

describe('a row in the review sweep', () => {
  const task: BoardTask = {
    id: 7,
    pendingId: null,
    title: 'Fix the tile',
    zone: 'OPPORTUNITY_NOW',
    labels: [],
    listId: 1,
    listName: 'Inbox',
  };

  let open: ReturnType<typeof vi.fn>;
  let move: ReturnType<typeof vi.fn>;
  let defer: ReturnType<typeof vi.fn>;

  const rendered = async () => {
    const fixture = TestBed.createComponent(ReviewRow);
    fixture.componentRef.setInput('task', task);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    open = vi.fn();
    move = vi.fn(async () => undefined);
    defer = vi.fn(async () => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { open } },
        {
          provide: ReviewStore,
          useValue: {
            online: signal(true),
            selecting: signal(false),
            selected: signal(new Set()),
            move,
            defer,
          },
        },
      ],
    });
  });

  it('opens the same read-only details as the board', async () => {
    const host = await rendered();

    host.querySelector<HTMLButtonElement>('button.body')!.click();

    expect(open).toHaveBeenCalledWith(TaskDetail, { data: task, panelClass: 'task-dialog' });
  });

  it('moves a task up or down a zone', async () => {
    const host = await rendered();

    host
      .querySelector<HTMLButtonElement>('button[aria-label="Move Fix the tile to Critical Now"]')!
      .click();

    expect(move).toHaveBeenCalledWith(task, 'CRITICAL_NOW');
  });

  const item = (label: string): HTMLButtonElement =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (b) => b.textContent!.trim() === label,
    )!;

  const deferChoices = async (): Promise<HTMLButtonElement[]> => {
    const fixture = TestBed.createComponent(ReviewRow);
    fixture.componentRef.setInput('task', task);
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Defer Fix the tile"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    return [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  };

  it('defers a task to the date picked in a dialog', async () => {
    open.mockReturnValue({ afterClosed: () => of('2026-12-24') });

    await deferChoices();
    item('Pick a date…').click();
    await vi.waitFor(() => expect(defer).toHaveBeenCalled());

    expect(open).toHaveBeenCalledWith(DeferDialog, expect.anything());
    expect(defer).toHaveBeenCalledWith(task, { until: '2026-12-24' });
  });

  it('defers from the actions menu, for a row with no room for the buttons', async () => {
    open.mockReturnValue({ afterClosed: () => of('2026-12-24') });
    const host = await rendered();

    host.querySelector<HTMLButtonElement>('button[aria-label="Actions for Fix the tile"]')!.click();
    await vi.waitFor(() => expect(item('Defer')).toBeTruthy());
    item('Defer').click();
    await vi.waitFor(() => expect(item('Pick a date…')).toBeTruthy());
    item('Pick a date…').click();
    await vi.waitFor(() => expect(defer).toHaveBeenCalled());

    expect(defer).toHaveBeenCalledWith(task, { until: '2026-12-24' });
    await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).toBeNull());
  });
});
