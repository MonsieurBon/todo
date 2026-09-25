import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardPage } from './board-page';
import { BoardStore } from './board-store';

describe('the board', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn(async () => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: BoardStore,
          useValue: {
            zones: signal([]),
            lists: signal([]),
            labels: signal([]),
            filter: signal({}),
            loading: signal(false),
            sync,
          },
        },
      ],
    });
  });

  /** Whatever is on the device when the connection goes is all the board has until it is back. */
  it('syncs each time it is opened, so it goes offline as fresh as it can', async () => {
    TestBed.createComponent(BoardPage);
    TestBed.createComponent(BoardPage);

    expect(sync).toHaveBeenCalledTimes(2);
  });
});
