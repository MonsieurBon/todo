import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardTask } from '../board/board-store';
import { TaskDetail } from '../board/task-detail';
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
          },
        },
      ],
    });
  });

  it('opens the same read-only details as the board', async () => {
    const host = await rendered();

    host.querySelector<HTMLButtonElement>('button.body')!.click();

    expect(open).toHaveBeenCalledWith(TaskDetail, { data: task });
  });

  it('moves a task up or down a zone', async () => {
    const host = await rendered();

    host
      .querySelector<HTMLButtonElement>('button[aria-label="Move Fix the tile to Critical Now"]')!
      .click();

    expect(move).toHaveBeenCalledWith(task, 'CRITICAL_NOW');
  });
});
