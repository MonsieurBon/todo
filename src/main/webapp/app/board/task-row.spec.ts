import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardStore, BoardTask } from './board-store';
import { TaskEdit } from './task-editor';
import { TaskRow } from './task-row';

/** An edit is two requests, so half of it landing is a state the row has to avoid. */
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

  let edit: ReturnType<typeof vi.fn>;
  let setLabels: ReturnType<typeof vi.fn>;
  let closedWith: TaskEdit;

  const edited = async () => {
    const fixture = TestBed.createComponent(TaskRow);
    fixture.componentRef.setInput('task', task);
    await fixture.whenStable();
    await (fixture.componentInstance as unknown as { edit(): Promise<void> }).edit();
  };

  beforeEach(() => {
    edit = vi.fn(async () => 'done');
    setLabels = vi.fn(async () => 'done');
    closedWith = { title: 'Fix it', notes: '', dueDate: '2026-10-01', labels: ['diy'] };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MatDialog,
          useValue: {
            open: () => ({ afterClosed: () => of(closedWith) }),
          },
        },
        {
          provide: BoardStore,
          useValue: { online: signal(true), lists: signal([]), edit, setLabels },
        },
      ],
    });
  });

  it('relabels once the edit itself has landed', async () => {
    await edited();

    expect(setLabels).toHaveBeenCalledWith(task, ['diy']);
  });

  it('does not relabel a task whose edit the server refused', async () => {
    edit.mockResolvedValue('refused');

    await edited();

    expect(setLabels).not.toHaveBeenCalled();
  });

  it('asks for the due date to be cleared when the editor comes back with none', async () => {
    closedWith = { ...closedWith, dueDate: '' };

    await edited();

    expect(edit).toHaveBeenCalledWith(task, expect.objectContaining({ clearDueDate: true }));
    expect(edit.mock.calls[0][1]).not.toHaveProperty('dueDate');
  });

  it('sends a due date the editor kept, and asks for nothing to be cleared', async () => {
    await edited();

    expect(edit).toHaveBeenCalledWith(task, expect.objectContaining({ dueDate: '2026-10-01' }));
    expect(edit.mock.calls[0][1]).not.toHaveProperty('clearDueDate');
  });
});
