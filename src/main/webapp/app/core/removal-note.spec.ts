import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RemovalNotes } from './removal-note';

describe('the removal note', () => {
  let notes: RemovalNotes;

  beforeEach(async () => {
    notes = TestBed.inject(RemovalNotes);
    const left = await notes.read();
    if (left) {
      await notes.clear(left);
    }
  });

  it('keeps what a sign-out left until it is finished', async () => {
    await notes.write({ endpoint: 'https://push.example/1', auth: 'AUTH' });

    expect(await notes.read()).toEqual({ endpoint: 'https://push.example/1', auth: 'AUTH' });
  });

  it('is cleared only by finishing the note it holds, never an older one', async () => {
    await notes.write({ endpoint: 'https://push.example/old', auth: 'OLD' });
    await notes.write({ endpoint: 'https://push.example/new', auth: 'NEW' });

    await notes.clear({ endpoint: 'https://push.example/old', auth: 'OLD' });
    expect(await notes.read()).toEqual({ endpoint: 'https://push.example/new', auth: 'NEW' });

    await notes.clear({ endpoint: 'https://push.example/new', auth: 'NEW' });
    expect(await notes.read()).toBeUndefined();
  });
});
