import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardStore, BoardTask } from './board-store';
import { TaskDetail } from './task-detail';

/** The row truncates to one line, so this dialog is the only place the whole task is readable. */
describe('the task detail dialog', () => {
  const task: BoardTask = {
    id: 7,
    pendingId: null,
    title: 'Fix the tile',
    zone: 'OPPORTUNITY_NOW',
    labels: ['house', 'diy'],
    listId: 1,
    listName: 'Inbox',
    notes: 'Behind the bath.\nMeasure first.',
    dueDate: '2026-10-01',
  };

  let board: WritableSignal<BoardTask[]>;
  let read: WritableSignal<number>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    board = signal([task]);
    read = signal(0);
    close = vi.fn();
  });

  const rendered = async (detail: BoardTask, fromBoard = false) => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { task: detail, fromBoard } },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: BoardStore,
          useValue: {
            online: signal(true),
            lists: signal([
              { id: 1, name: 'Inbox' },
              { id: 2, name: 'Household' },
            ]),
            read,
            latest: (opened: BoardTask) => board().find((t) => t.id === opened.id),
            reopenable: () => true,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(TaskDetail);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const shown = async (detail: BoardTask, fromBoard = false): Promise<HTMLElement> =>
    (await rendered(detail, fromBoard)).nativeElement as HTMLElement;

  it('shows the notes in full, line breaks and all', async () => {
    const notes = (await shown(task)).querySelector('app-task-notes');

    expect(notes?.textContent).toContain('Behind the bath.');
    expect(notes?.textContent).toContain('Measure first.');
    expect(notes?.querySelector('br')).not.toBeNull();
  });

  it('renders markdown in the notes', async () => {
    const detail = await shown({ ...task, notes: 'Behind the **bath**.' });

    expect(detail.querySelector('app-task-notes strong')?.textContent).toBe('bath');
  });

  it('shows where the task sits: title, zone, list, topics and due date', async () => {
    const text = (await shown(task)).textContent ?? '';

    expect(text).toContain('Fix the tile');
    expect(text).toContain('Opportunity Now');
    expect(text).toContain('Inbox');
    expect(text).toContain('house');
    expect(text).toContain('diy');
    expect(text).toContain('2026-10-01');
  });

  it('says a task has no notes rather than leaving the space blank', async () => {
    expect((await shown({ ...task, notes: undefined })).textContent).toContain('No notes');
  });

  // A capture that has not synced has no server id, but every field shown here is already on the
  // device.
  it('opens for a task that is still waiting to sync, and says that it is', async () => {
    const text = (await shown({ ...task, id: null, pendingId: 'draft-1' })).textContent ?? '';

    expect(text).toContain('Behind the bath.');
    expect(text).toContain('waiting to sync');
  });

  it('does not call a synced task pending', async () => {
    expect((await shown(task)).textContent).not.toContain('waiting to sync');
  });

  const button = (host: HTMLElement, label: string): HTMLButtonElement | null =>
    host.querySelector(`button[aria-label="${label}"]`);

  /** Opened from the board, it is the board's task, so whatever the row offers, it offers too. */
  describe('opened from the board', () => {
    it("offers the row's actions", async () => {
      const host = await shown(task, true);

      expect(button(host, 'Complete Fix the tile')).not.toBeNull();
      expect(button(host, 'Edit Fix the tile')).not.toBeNull();
      expect(button(host, 'Delete Fix the tile')).not.toBeNull();
    });

    it('shows the task as the board has it now, rather than as it was opened', async () => {
      const fixture = await rendered(task, true);

      board.set([{ ...task, title: 'Fix the tile today', zone: 'CRITICAL_NOW' }]);
      fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(text).toContain('Fix the tile today');
      expect(text).toContain('Critical Now');
      expect(close).not.toHaveBeenCalled();
    });

    it('shows a task completed from it as done, so the completion can be taken back', async () => {
      const fixture = await rendered(task, true);

      board.set([{ ...task, done: true }]);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelector('.title')!.classList.contains('done')).toBe(true);
      expect(button(host, 'Reopen Fix the tile')).not.toBeNull();
    });

    it('closes once the task has left the board, showing it as last seen until then', async () => {
      const fixture = await rendered(task, true);
      board.set([{ ...task, title: 'Fix the tile today' }]);
      fixture.detectChanges();

      board.set([]);
      read.update((n) => n + 1);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(close).toHaveBeenCalled();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Fix the tile today');
    });
    // A sent capture leaves the outbox before the board that holds it has been read.
    it('stays open while the task is missing only until the board is read again', async () => {
      const fixture = await rendered(task, true);

      board.set([]);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(close).not.toHaveBeenCalled();

      board.set([{ ...task, title: 'Fix the tile today' }]);
      read.update((n) => n + 1);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(close).not.toHaveBeenCalled();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Fix the tile today');
    });
  });

  /** The sweep's own card places a task; here it is only read. */
  it('offers no actions when opened from the review sweep', async () => {
    const host = await shown(task);

    expect(host.querySelector('app-task-actions')).toBeNull();
    expect(button(host, 'Complete Fix the tile')).toBeNull();
  });
});
