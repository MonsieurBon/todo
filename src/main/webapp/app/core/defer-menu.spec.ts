import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Deferral } from '../api/model';
import { DeferDialog } from './defer-dialog';
import { DeferMenu } from './defer-menu';

@Component({
  imports: [DeferMenu, MatMenuTrigger],
  template: `
    <button type="button" [matMenuTriggerFor]="deferMenu.menu()">Defer</button>
    <app-defer-menu
      #deferMenu
      [deferredUntil]="deferredUntil()"
      [offerNow]="offerNow()"
      [defer]="defer"
      (now)="now = now + 1"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly deferredUntil = signal<string | undefined>(undefined);
  readonly offerNow = signal(false);
  readonly chosen: Deferral[] = [];
  readonly defer = (deferral: Deferral) => this.chosen.push(deferral);
  now = 0;
}

describe('the defer menu', () => {
  let fixture: ComponentFixture<Host>;
  let open: ReturnType<typeof vi.fn>;

  const choices = async (): Promise<HTMLButtonElement[]> => {
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    return [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  };

  const choose = async (label: string) => {
    (await choices()).find((c) => c.textContent!.trim() === label)!.click();
    await new Promise((resolve) => setTimeout(resolve));
  };

  beforeEach(async () => {
    open = vi.fn(() => ({ afterClosed: () => of('2026-12-24') }));
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: { open } }] });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('offers the dates it names, then any other date', async () => {
    expect((await choices()).map((c) => c.textContent!.trim())).toEqual([
      'Tomorrow',
      'Next week',
      'In a month',
      'Pick a date…',
    ]);
  });

  it('defers by days for the dates it names, leaving the server to say which date that is', async () => {
    await choose('Next week');

    expect(fixture.componentInstance.chosen).toEqual([{ days: 7 }]);
  });

  it('defers to the date picked in a dialog, which opens on the current one', async () => {
    fixture.componentInstance.deferredUntil.set('2030-01-01');
    fixture.detectChanges();

    await choose('Pick a date…');

    expect(open).toHaveBeenCalledWith(DeferDialog, expect.objectContaining({ data: '2030-01-01' }));
    expect(fixture.componentInstance.chosen).toEqual([{ until: '2026-12-24' }]);
  });

  // A dialog hands focus back to whatever had it when it opened; the menu's item is gone by then.
  it('opens the dialog once the menu has closed and given focus back to its trigger', async () => {
    let focused: Element | null = null;
    open.mockImplementation(() => {
      focused = document.activeElement;
      return { afterClosed: () => of(undefined) };
    });

    await choose('Pick a date…');

    expect(open).toHaveBeenCalled();
    expect(focused).toBe(fixture.nativeElement.querySelector('button'));
  });

  // A board refresh while the dialog is open can replace the row, e.g. for a task moved elsewhere.
  it('still defers when its host is gone by the time a date is picked', async () => {
    const picked = new Subject<string>();
    open.mockReturnValue({ afterClosed: () => picked });
    const host = fixture.componentInstance;

    await choose('Pick a date…');
    fixture.destroy();
    picked.next('2026-12-24');
    await new Promise((resolve) => setTimeout(resolve));

    expect(host.chosen).toEqual([{ until: '2026-12-24' }]);
  });

  // The menu opens in an overlay; left in the flow, its host is one more gap in a row's flexbox.
  it('takes no room where it is placed', () => {
    const host = fixture.nativeElement.querySelector('app-defer-menu');

    expect(getComputedStyle(host).display).toBe('none');
  });

  it('says that picking a date opens a dialog', async () => {
    const pick = (await choices()).find((c) => c.textContent!.trim() === 'Pick a date…')!;

    expect(pick.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('defers nothing when the dialog is closed without a date', async () => {
    open.mockReturnValue({ afterClosed: () => of(undefined) });

    await choose('Pick a date…');

    expect(fixture.componentInstance.chosen).toEqual([]);
  });

  it('offers to bring a task back now only when asked, first among the dates', async () => {
    fixture.componentInstance.offerNow.set(true);
    fixture.detectChanges();

    const offered = await choices();
    expect(offered[0].textContent!.trim()).toBe('Now');
    offered[0].click();

    expect(fixture.componentInstance.now).toBe(1);
    expect(fixture.componentInstance.chosen).toEqual([]);
  });
});
