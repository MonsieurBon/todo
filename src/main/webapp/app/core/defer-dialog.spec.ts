import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferDialog } from './defer-dialog';

describe('deferring to a date', () => {
  let fixture: ComponentFixture<DeferDialog>;
  let close: ReturnType<typeof vi.fn>;

  const host = (): HTMLElement => fixture.nativeElement;
  const defer = (): HTMLButtonElement =>
    [...host().querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Defer')!;

  const pick = async (date: string) => {
    const input = host().querySelector<HTMLInputElement>('input[type="date"]')!;
    input.value = date;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const opened = async (until?: string) => {
    close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: until },
      ],
    });
    fixture = TestBed.createComponent(DeferDialog);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('hands back the date picked, as it was picked', async () => {
    await opened();
    await pick('2026-12-24');
    defer().click();

    expect(close).toHaveBeenCalledWith('2026-12-24');
  });

  it('offers no deferral before a date is picked', async () => {
    await opened();
    expect(defer().disabled).toBe(true);

    await pick('2026-12-24');
    await pick('');

    expect(defer().disabled).toBe(true);
  });

  it('starts from the date a task is already deferred to', async () => {
    await opened('2026-12-24');

    expect(host().querySelector<HTMLInputElement>('input[type="date"]')!.value).toBe('2026-12-24');
    defer().click();
    expect(close).toHaveBeenCalledWith('2026-12-24');
  });

  it('defers when the form is submitted, as Enter in its field does', async () => {
    await opened();
    await pick('2026-12-24');

    host().querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(close).toHaveBeenCalledWith('2026-12-24');
  });
});
