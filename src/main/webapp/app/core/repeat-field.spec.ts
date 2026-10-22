import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_RECURRENCE_EVERY, Recurrence } from '../api/model';
import { RepeatField } from './repeat-field';

@Component({
  imports: [RepeatField],
  template: `<app-repeat-field [(recurrence)]="recurrence" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly recurrence = signal<Recurrence | null>(null);
}

describe('the repeat field', () => {
  let fixture: ComponentFixture<Host>;

  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const every = (): HTMLInputElement | null =>
    fixture.nativeElement.querySelector('input[name="every"]');

  const choose = async (option: string) => {
    fixture.nativeElement.querySelector('.mat-mdc-select-trigger').click();
    await settle();
    const match = Array.from(document.querySelectorAll('mat-option')).find(
      (o) => o.textContent!.trim() === option,
    ) as HTMLElement;
    match.click();
    await settle();
  };

  const typeEvery = async (value: string) => {
    every()!.value = value;
    every()!.dispatchEvent(new Event('input'));
    await settle();
  };

  const field = () => fixture.debugElement.children[0].componentInstance as RepeatField;

  const render = async (initial: Recurrence | null = null) => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.recurrence.set(initial);
    await settle();
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('repeats nothing until told to, and asks for no interval', async () => {
    await render();

    expect(fixture.componentInstance.recurrence()).toBeNull();
    expect(every()).toBeNull();
  });

  it('repeats every day once daily is chosen', async () => {
    await render();
    await choose('Daily');

    expect(fixture.componentInstance.recurrence()).toEqual({ every: 1, unit: 'DAYS' });
    expect(every()!.value).toBe('1');
  });

  it('repeats every few weeks when the interval is changed', async () => {
    await render();
    await choose('Weekly');
    await typeEvery('3');

    expect(fixture.componentInstance.recurrence()).toEqual({ every: 3, unit: 'WEEKS' });
    const labels = fixture.nativeElement.querySelectorAll('mat-label');
    expect(labels[labels.length - 1].textContent).toContain('Every … weeks');
  });

  it('shows the interval it was given', async () => {
    await render({ every: 2, unit: 'MONTHS' });

    expect(every()!.value).toBe('2');
    expect(fixture.nativeElement.querySelector('mat-select').textContent).toContain('Monthly');
  });

  it('stops repeating when that is chosen', async () => {
    await render({ every: 2, unit: 'WEEKS' });
    await choose('Doesn’t repeat');

    expect(fixture.componentInstance.recurrence()).toBeNull();
    expect(every()).toBeNull();
  });

  // The deny path: an interval the server refuses would be dropped from the outbox unseen.
  it.each(['0', String(MAX_RECURRENCE_EVERY + 1), '1.5', ''])(
    'calls an interval of "%s" invalid, and says what is allowed',
    async (value) => {
      await render();
      await choose('Daily');
      await typeEvery(value);

      expect(field().invalid()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain(String(MAX_RECURRENCE_EVERY));
    },
  );

  it('lets an interval exactly at the limit through', async () => {
    await render();
    await choose('Daily');
    await typeEvery(String(MAX_RECURRENCE_EVERY));

    expect(field().invalid()).toBe(false);
    expect(fixture.componentInstance.recurrence()).toEqual({
      every: MAX_RECURRENCE_EVERY,
      unit: 'DAYS',
    });
  });
});
