import { Injectable } from '@angular/core';
import { IDBPDatabase, openDB } from 'idb';

/**
 * A subscription this device is done with, still to be ended at the push service and removed from
 * the server. Both need a connection a sign-out may not have, so they are finished by whoever is
 * online first: the next start, or the worker when the next push arrives (`public/push-worker.js`,
 * which reads this same store and must agree on its names).
 */
export interface RemovalNote {
  endpoint: string;
  auth: string;
}

export const NOTE_DB = 'todo-push';
export const NOTE_STORE = 'removal';
export const NOTE_KEY = 'pending';

@Injectable({ providedIn: 'root' })
export class RemovalNotes {
  private db: Promise<IDBPDatabase> | null = null;

  async read(): Promise<RemovalNote | undefined> {
    return (await this.open()).get(NOTE_STORE, NOTE_KEY);
  }

  async write(note: RemovalNote): Promise<void> {
    await (await this.open()).put(NOTE_STORE, note, NOTE_KEY);
  }

  /** Only the note it was given: a later sign-out may have left another one meanwhile. */
  async clear(note: RemovalNote): Promise<void> {
    const db = await this.open();
    const current = (await db.get(NOTE_STORE, NOTE_KEY)) as RemovalNote | undefined;
    if (current?.endpoint === note.endpoint) {
      await db.delete(NOTE_STORE, NOTE_KEY);
    }
  }

  private open(): Promise<IDBPDatabase> {
    this.db ??= openDB(NOTE_DB, 1, {
      upgrade(db) {
        db.createObjectStore(NOTE_STORE);
      },
    });
    return this.db;
  }
}
