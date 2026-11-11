import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardStore, BoardTask } from './board-store';
import { TaskDetail } from './task-detail';
import { TaskRow } from './task-row';

describe('a task row', () => {
  const task: BoardTask = {
    id: 7,
    pendingId: null,
    title: 'Fix the tile',
    zone: 'CRITICAL_NOW',
    labels: ['house'],
    listId: 1,
    listName: 'Inbox',
    dueDate: '2026-10-01',
  };

  let open: ReturnType<typeof vi.fn>;
  let complete: ReturnType<typeof vi.fn>;

  const rendered = async (shown: BoardTask = task): Promise<HTMLElement> => {
    const fixture = TestBed.createComponent(TaskRow);
    fixture.componentRef.setInput('task', shown);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const button = (host: HTMLElement, label: string): HTMLButtonElement =>
    host.querySelector(`button[aria-label="${label}"]`)!;

  beforeEach(() => {
    open = vi.fn();
    complete = vi.fn(async () => 'done');
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { open } },
        {
          provide: BoardStore,
          useValue: {
            online: signal(true),
            lists: signal([]),
            complete,
            reopenable: () => true,
          },
        },
      ],
    });
  });

  it('opens the task in a detail dialog when its body is clicked', async () => {
    (await rendered()).querySelector<HTMLButtonElement>('button.body')!.click();

    expect(open).toHaveBeenCalledWith(TaskDetail, { data: task, panelClass: 'task-dialog' });
  });

  /** The review board's left edge selects, so on the board it must not look like a tick box. */
  it('completes from a button after the title, not from one before it', async () => {
    const host = await rendered();
    const buttons = [...host.querySelectorAll('button')];

    const completing = button(host, 'Complete Fix the tile');
    expect(buttons.indexOf(completing)).toBeGreaterThan(
      buttons.indexOf(host.querySelector('button.body')!),
    );

    completing.click();
    expect(complete).toHaveBeenCalledWith(task);
  });

  it('greys out a task the server sent as deferred, and no other', async () => {
    const row = async (deferUntil?: string) =>
      (await rendered({ ...task, deferUntil })).querySelector('.task')!.classList;

    expect((await row('2000-01-01')).contains('deferred')).toBe(true);
    expect((await row()).contains('deferred')).toBe(false);
  });

  it('strikes through a task just completed', async () => {
    const host = await rendered({ ...task, done: true });

    expect(host.querySelector('.task')!.classList.contains('done')).toBe(true);
  });
});
