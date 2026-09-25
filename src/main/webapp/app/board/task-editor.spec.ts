import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_LABEL_LENGTH } from '../api/model';
import { BoardStore, BoardTask } from './board-store';
import { TaskEditor } from './task-editor';

describe('the task editor', () => {
  let fixture: ComponentFixture<TaskEditor>;
  let close: ReturnType<typeof vi.fn>;

  const field = (name: string): HTMLInputElement =>
    fixture.nativeElement.querySelector(`[name="${name}"]`);

  const set = async (name: string, value: string) => {
    field(name).value = value;
    field(name).dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const save = (): HTMLButtonElement =>
    Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => (button as HTMLElement).textContent!.trim() === 'Save',
    ) as HTMLButtonElement;

  const open = async (task: Partial<BoardTask> = {}) => {
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { id: 1, title: 'Fix the roof', labels: ['house'], ...task },
        },
        { provide: BoardStore, useValue: { labels: signal(['house', 'work']) } },
      ],
    });
    fixture = TestBed.createComponent(TaskEditor);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('hands back the topics it was given, plus one typed in', async () => {
    await open();
    await set('labels', 'roof');
    save().click();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({ labels: ['house', 'roof'] }));
  });

  // The deny path: the button must be dead rather than swallowing the click, or an edit looks
  // saved and is not.
  it('will not save while a topic is longer than the server allows', async () => {
    await open();
    await set('labels', 'l'.repeat(MAX_LABEL_LENGTH + 1));

    expect(save().disabled).toBe(true);
    save().click();

    expect(close).not.toHaveBeenCalled();
  });

  it('will not save without a title', async () => {
    await open();
    await set('title', '  ');

    expect(save().disabled).toBe(true);
    save().click();

    expect(close).not.toHaveBeenCalled();
  });
});
