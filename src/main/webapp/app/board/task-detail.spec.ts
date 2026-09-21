import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it } from 'vitest';
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

  const shown = async (detail: BoardTask): Promise<HTMLElement> => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: detail },
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        {
          provide: BoardStore,
          useValue: {
            lists: signal([
              { id: 1, name: 'Inbox' },
              { id: 2, name: 'Household' },
            ]),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(TaskDetail);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

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
});
