import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardStore, BoardTask } from './board-store';
import { TaskDetail } from './task-detail';
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
  let complete: ReturnType<typeof vi.fn>;
  let moveZone: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;
  let closedWith: TaskEdit;

  const rendered = async () => {
    const fixture = TestBed.createComponent(TaskRow);
    fixture.componentRef.setInput('task', task);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const edited = async () => {
    const fixture = await rendered();
    await (fixture.componentInstance as unknown as { edit(): Promise<void> }).edit();
  };

  beforeEach(() => {
    edit = vi.fn(async () => 'done');
    setLabels = vi.fn(async () => 'done');
    complete = vi.fn(async () => 'done');
    moveZone = vi.fn(async () => 'done');
    remove = vi.fn(async () => 'done');
    closedWith = { title: 'Fix it', notes: '', dueDate: '2026-10-01', labels: ['diy'] };
    open = vi.fn(() => ({ afterClosed: () => of(closedWith) }));
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: { open } },
        {
          provide: BoardStore,
          useValue: {
            online: signal(true),
            lists: signal([]),
            edit,
            setLabels,
            complete,
            moveZone,
            remove,
          },
        },
      ],
    });
  });

  it('opens the task in a detail dialog when its body is clicked', async () => {
    const fixture = await rendered();

    fixture.nativeElement.querySelector('button.body').click();

    expect(open).toHaveBeenCalledWith(TaskDetail, { data: task });
  });

  const button = (host: HTMLElement, label: string): HTMLButtonElement =>
    host.querySelector(`button[aria-label="${label}"]`)!;

  /** The review board's left edge selects, so on the board it must not look like a tick box. */
  it('completes from a button after the title, not from one before it', async () => {
    const fixture = await rendered();
    const host: HTMLElement = fixture.nativeElement;
    const buttons = [...host.querySelectorAll('button')];

    const completing = button(host, 'Complete Fix the tile');
    expect(buttons.indexOf(completing)).toBeGreaterThan(
      buttons.indexOf(host.querySelector('button.body')!),
    );

    completing.click();
    expect(complete).toHaveBeenCalledWith(task);
  });

  it("offers the menu's actions as buttons, for a row with room to show them", async () => {
    const fixture = await rendered();
    const host: HTMLElement = fixture.nativeElement;

    button(host, 'Move Fix the tile to Opportunity Now').click();
    expect(moveZone).toHaveBeenCalledWith(task, 'OPPORTUNITY_NOW');

    button(host, 'Delete Fix the tile').click();
    expect(remove).toHaveBeenCalledWith(task);

    expect(button(host, 'Edit Fix the tile')).toBeTruthy();
    expect(button(host, 'Defer Fix the tile')).toBeTruthy();
  });

  it("greys out a step past the zone's edge rather than dropping it, so buttons line up", async () => {
    const fixture = await rendered();

    expect(button(fixture.nativeElement, 'Move Fix the tile up').disabled).toBe(true);
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
