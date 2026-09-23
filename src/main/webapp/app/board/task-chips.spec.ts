import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TaskList } from '../api/model';
import { BoardStore, BoardTask } from './board-store';
import { TaskChips } from './task-chips';

/** One row of chips for three screens, so what each of them may hide is decided here. */
describe('a task’s chips', () => {
  const task: BoardTask = {
    id: 7,
    pendingId: null,
    title: 'Fix the tile',
    zone: 'OPPORTUNITY_NOW',
    labels: ['house', 'diy'],
    listId: 1,
    listName: 'Inbox',
    dueDate: '2026-10-01',
  };

  const list = (id: number, name: string) =>
    ({
      id,
      name,
      inbox: id === 1,
      owned: true,
      sharedWith: [],
    }) as unknown as TaskList;

  let lists: ReturnType<typeof signal<TaskList[]>>;

  const shown = async (of: Partial<BoardTask> = {}, showZone = false): Promise<string> => {
    const fixture = TestBed.createComponent(TaskChips);
    fixture.componentRef.setInput('task', { ...task, ...of });
    fixture.componentRef.setInput('showZone', showZone);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement.textContent as string;
  };

  beforeEach(() => {
    lists = signal<TaskList[]>([list(1, 'Inbox')]);
    TestBed.configureTestingModule({
      providers: [{ provide: BoardStore, useValue: { lists } }],
    });
  });

  /**
   * The deny path, and the one the stylesheet leans on: a host with no chips in it is hidden, so
   * a chip that rendered unconditionally would leave its caller's margin under every bare task.
   */
  it('renders nothing at all for a task that carries nothing', async () => {
    const text = await shown({ labels: [], dueDate: undefined, listName: null });

    expect(text.trim()).toBe('');
  });

  it('always says the topics and the due date', async () => {
    const text = await shown();

    expect(text).toContain('house');
    expect(text).toContain('diy');
    expect(text).toContain('2026-10-01');
  });

  it('names the list only when there is more than one list to be in', async () => {
    expect(await shown()).not.toContain('Inbox');

    lists.set([list(1, 'Inbox'), list(2, 'Household')]);

    expect(await shown()).toContain('Inbox');
  });

  it('marks a capture that has not synced, and only that one', async () => {
    expect(await shown({ pendingId: 'draft-1', id: null })).toContain('waiting to sync');
    expect(await shown()).not.toContain('waiting to sync');
  });

  // The board row and the review card both say the zone in their own layout already.
  it('says the zone only where it is asked for', async () => {
    expect(await shown()).not.toContain('Opportunity Now');
    expect(await shown({}, true)).toContain('Opportunity Now');
  });
});
