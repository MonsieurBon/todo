import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferDialog } from '../core/defer-dialog';
import { BoardStore, BoardTask } from './board-store';
import { TaskDetail } from './task-detail';
import { TaskEdit } from './task-editor';
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

  let edit: ReturnType<typeof vi.fn>;
  let complete: ReturnType<typeof vi.fn>;
  let moveZone: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;
  let defer: ReturnType<typeof vi.fn>;
  let undefer: ReturnType<typeof vi.fn>;
  let reopen: ReturnType<typeof vi.fn>;
  let reopenable: ReturnType<typeof vi.fn>;
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
    complete = vi.fn(async () => 'done');
    moveZone = vi.fn(async () => 'done');
    remove = vi.fn(async () => 'done');
    defer = vi.fn(async () => 'done');
    undefer = vi.fn(async () => 'done');
    reopen = vi.fn(async () => 'done');
    reopenable = vi.fn(() => true);
    closedWith = {
      title: 'Fix it',
      notes: '',
      dueDate: '2026-10-01',
      labels: ['diy'],
      recurrence: null,
    };
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
            complete,
            moveZone,
            remove,
            defer,
            undefer,
            reopen,
            reopenable,
          },
        },
      ],
    });
  });

  it('opens the task in a detail dialog when its body is clicked', async () => {
    const fixture = await rendered();

    fixture.nativeElement.querySelector('button.body').click();

    expect(open).toHaveBeenCalledWith(TaskDetail, { data: task, panelClass: 'task-dialog' });
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

  /** Deleting one needs a connection like any other task, and then it has been sent. */
  it('offers nothing but completing a capture that has not been sent', async () => {
    const fixture = TestBed.createComponent(TaskRow);
    fixture.componentRef.setInput('task', { ...task, id: null, pendingId: 'queued-1' });
    await fixture.whenStable();
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(button(host, 'Complete Fix the tile')).toBeTruthy();
    expect(button(host, 'Actions for Fix the tile')).toBeNull();
    expect(button(host, 'Delete Fix the tile')).toBeNull();
  });

  const menuItem = (label: string): HTMLButtonElement =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (item) => item.textContent!.trim() === label,
    )!;

  const deferChoices = async (deferUntil?: string): Promise<HTMLButtonElement[]> => {
    const fixture = TestBed.createComponent(TaskRow);
    fixture.componentRef.setInput('task', { ...task, deferUntil });
    await fixture.whenStable();
    fixture.detectChanges();
    button(fixture.nativeElement, 'Defer Fix the tile').click();
    fixture.detectChanges();
    await fixture.whenStable();
    return [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  };

  it('offers to bring a deferred task back now, first among the dates', async () => {
    const choices = await deferChoices('2030-01-01');

    expect(choices[0].textContent?.trim()).toBe('Now');
    choices[0].click();
    expect(undefer).toHaveBeenCalledWith({ ...task, deferUntil: '2030-01-01' });
  });

  it('offers no "now" for a task that is not deferred: it is already here', async () => {
    const choices = await deferChoices();

    expect(choices.map((c) => c.textContent?.trim())).not.toContain('Now');
  });

  it('defers to the date picked, starting from the one the task already has', async () => {
    open.mockReturnValue({ afterClosed: () => of('2026-12-24') });
    await deferChoices('2030-01-01');

    menuItem('Pick a date…').click();
    await vi.waitFor(() => expect(defer).toHaveBeenCalled());

    expect(open).toHaveBeenCalledWith(DeferDialog, expect.objectContaining({ data: '2030-01-01' }));
    expect(defer).toHaveBeenCalledWith(
      { ...task, deferUntil: '2030-01-01' },
      { until: '2026-12-24' },
    );
  });

  it('defers from the actions menu, for a row with no room for the buttons', async () => {
    open.mockReturnValue({ afterClosed: () => of('2026-12-24') });
    const fixture = await rendered();

    button(fixture.nativeElement, 'Actions for Fix the tile').click();
    fixture.detectChanges();
    await fixture.whenStable();
    menuItem('Defer').click();
    fixture.detectChanges();
    await fixture.whenStable();
    menuItem('Pick a date…').click();
    await vi.waitFor(() => expect(defer).toHaveBeenCalled());

    expect(defer).toHaveBeenCalledWith(task, { until: '2026-12-24' });
    await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).toBeNull());
  });

  it("greys out a step past the zone's edge rather than dropping it, so buttons line up", async () => {
    const fixture = await rendered();

    expect(button(fixture.nativeElement, 'Move Fix the tile up').disabled).toBe(true);
  });

  it('greys out a task the server sent as deferred, and no other', async () => {
    const row = async (deferUntil?: string) => {
      const fixture = TestBed.createComponent(TaskRow);
      fixture.componentRef.setInput('task', { ...task, deferUntil });
      await fixture.whenStable();
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelector('.task')!.classList;
    };

    expect((await row('2000-01-01')).contains('deferred')).toBe(true);
    expect((await row()).contains('deferred')).toBe(false);
  });

  it('sends the topics with the rest of the edit, as one request', async () => {
    await edited();

    expect(edit).toHaveBeenCalledOnce();
    expect(edit).toHaveBeenCalledWith(
      task,
      expect.objectContaining({ title: 'Fix it', labels: ['diy'] }),
    );
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

  it('asks for the repeat to be stopped when the editor comes back with none', async () => {
    await edited();

    expect(edit).toHaveBeenCalledWith(task, expect.objectContaining({ clearRecurrence: true }));
    expect(edit.mock.calls[0][1]).not.toHaveProperty('recurrence');
  });

  it('sends the repeat the editor came back with, and asks for nothing to be stopped', async () => {
    closedWith = { ...closedWith, recurrence: { every: 3, unit: 'DAYS' } };

    await edited();

    expect(edit).toHaveBeenCalledWith(
      task,
      expect.objectContaining({ recurrence: { every: 3, unit: 'DAYS' } }),
    );
    expect(edit.mock.calls[0][1]).not.toHaveProperty('clearRecurrence');
  });

  /** A completed task is read-only, so taking the completion back is all it offers. */
  describe('for a task just completed', () => {
    const done = async () => {
      const fixture = TestBed.createComponent(TaskRow);
      fixture.componentRef.setInput('task', { ...task, done: true });
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('offers to reopen it where the complete button was, and nothing else', async () => {
      const host = await done();

      expect(host.querySelector('.task')!.classList.contains('done')).toBe(true);
      expect(button(host, 'Complete Fix the tile')).toBeNull();
      expect(button(host, 'Delete Fix the tile')).toBeNull();
      expect(button(host, 'Actions for Fix the tile')).toBeNull();

      button(host, 'Reopen Fix the tile').click();
      expect(reopen).toHaveBeenCalledWith({ ...task, done: true });
    });

    it('greys out reopening when the board cannot take the completion back', async () => {
      expect(button(await done(), 'Reopen Fix the tile').disabled).toBe(false);

      reopenable.mockReturnValue(false);
      expect(button(await done(), 'Reopen Fix the tile').disabled).toBe(true);
    });
  });
});
