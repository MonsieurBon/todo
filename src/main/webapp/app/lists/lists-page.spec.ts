import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoApi } from '../api/todo-api';
import { BoardStore } from '../board/board-store';
import { Writes } from '../core/writes';
import { ListsPage } from './lists-page';

/**
 * What the screen says when the server refuses a list name. Still driven through the rendered form
 * for the reason capture-page.spec.ts gives — a right message can never reach the DOM — but the
 * message itself now lands in the shell, so app.spec.ts is what proves it is shown.
 */
describe('the lists screen', () => {
  let createList: ReturnType<typeof vi.fn>;
  let writes: Writes;

  const failWith = (status: number, body: unknown) => {
    createList.mockReturnValue(throwError(() => ({ status, error: body })));
  };

  const nameField = (fixture: ComponentFixture<ListsPage>): HTMLInputElement =>
    fixture.nativeElement.querySelector('[name="newList"]');

  const addAList = async (fixture: ComponentFixture<ListsPage>, name = 'Household') => {
    const field = nameField(fixture);
    field.value = name;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();

    const add: HTMLButtonElement = [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.trim().startsWith('Add'),
    );
    add.click();
    await fixture.whenStable();
    fixture.detectChanges();
    return writes.problem() ?? '';
  };

  const render = async (): Promise<ComponentFixture<ListsPage>> => {
    const fixture = TestBed.createComponent(ListsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    createList = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: TodoApi, useValue: { createList } },
        {
          provide: BoardStore,
          useValue: {
            lists: signal([
              { id: 1, name: 'Inbox', slug: 'inbox', inbox: true, owned: true, sharedWith: [] },
            ]),
            online: signal(true),
            refresh: vi.fn(async () => undefined),
          },
        },
      ],
    });
    writes = TestBed.inject(Writes);
  });

  it('shows the server’s own sentence for a name already taken', async () => {
    failWith(400, {
      error: 'invalid_request',
      message: 'A list called "Household" already exists',
      fields: {},
    });
    const fixture = await render();
    const shown = await addAList(fixture);

    expect(shown).toContain('A list called "Household" already exists');
    expect(shown).not.toContain('Try again when you have a connection');
    // The name the message asks you to change has to still be there to change.
    expect(nameField(fixture).value).toBe('Household');
  });

  it('reads out the field that failed validation rather than the generic body message', async () => {
    failWith(400, {
      error: 'validation_failed',
      message: 'Request body is invalid',
      fields: { name: 'size must be between 0 and 255' },
    });
    const shown = await addAList(await render());

    expect(shown).toContain('size must be between 0 and 255');
    expect(shown).not.toContain('Request body is invalid');
    expect(shown).not.toContain('Try again when you have a connection');
  });

  it('still tells the user to wait for a connection when the request never landed', async () => {
    failWith(0, null);
    expect(await addAList(await render())).toContain('Try again when you have a connection');
  });

  // Only sharing 404s on a person; adding a list 404s on the list, and the server cannot tell
  // the two apart by status.
  it('says the list is gone when adding 404s, not that someone must sign in', async () => {
    failWith(404, null);
    const shown = await addAList(await render());

    expect(shown).toContain('no longer there');
    expect(shown).not.toContain('No account with that address yet');
  });
});
