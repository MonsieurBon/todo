import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_LABEL_LENGTH } from '../api/model';
import { TopicsField } from './topics-field';

@Component({
  imports: [TopicsField],
  template: `<app-topics-field [(topics)]="topics" [known]="known()" />`,
})
class Host {
  readonly topics = signal<string[]>([]);
  readonly known = signal<string[]>(['house', 'household', 'work', 'Küche']);
}

/**
 * The field must accept a topic nobody has used before — the dropdown is an offer, not the set of
 * allowed values — and must never hand the form a topic the server would refuse.
 */
describe('the topics field', () => {
  let fixture: ComponentFixture<Host>;

  const input = (): HTMLInputElement => fixture.nativeElement.querySelector('input');

  const type = async (value: string) => {
    input().focus();
    input().dispatchEvent(new FocusEvent('focusin'));
    input().value = value;
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const enter = async () => {
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 }));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const offered = (): string[] =>
    Array.from(document.querySelectorAll('mat-option')).map((o) => o.textContent!.trim());

  const chips = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('mat-chip-row')).map((chip) =>
      (chip as HTMLElement).textContent!.trim(),
    );

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('offers the existing topics that match what is being typed', async () => {
    await type('hou');

    expect(offered()).toEqual(['house', 'household']);
  });

  /**
   * The offer is a search, and deliberately more generous than the column: the board matches a
   * topic only by its exact spelling, so a narrow search would hide a topic that exists while a
   * generous one costs a row in a list.
   */
  it('offers a topic whose accents differ from what is being typed', async () => {
    await type('kuc');

    expect(offered()).toEqual(['Küche']);
  });

  /**
   * Holding one spelling does not hide another: they are two topics, and the offer is how the
   * second one gets reused rather than reinvented.
   */
  it('still offers a topic when a different spelling of it is held', async () => {
    fixture.componentInstance.topics.set(['kuche']);
    await type('kuc');

    expect(offered()).toEqual(['Küche']);
  });

  /**
   * The mouse path, which no other test walks. Committing on blur as well as on selection made a
   * tap on a suggestion produce two chips - the half-typed one and the offered one - and sent the
   * half-typed one to the server.
   */
  it('adds exactly one chip when an offered topic is clicked', async () => {
    await type('hou');
    const option = document.querySelector('mat-option') as HTMLElement;
    // The real sequence, which a bare click() does not reproduce: pressing on the panel takes
    // focus off the input before the click lands.
    input().dispatchEvent(new FocusEvent('blur'));
    option.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.topics()).toEqual(['house']);
  });

  it('stops offering a topic once it has been picked', async () => {
    fixture.componentInstance.topics.set(['house']);
    await type('hou');

    expect(offered()).toEqual(['household']);
  });

  it('accepts a topic that exists nowhere yet', async () => {
    await type('roof');
    await enter();

    expect(chips()).toEqual(['roof']);
    expect(fixture.componentInstance.topics()).toEqual(['roof']);
  });

  // The server refuses a comma outright, so it can only ever mean "that topic is finished".
  it('commits the topic when a comma is typed, like a return', async () => {
    await type('garden');
    input().dispatchEvent(new KeyboardEvent('keydown', { key: ',', keyCode: 188 }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(chips()).toEqual(['garden']);
    expect(input().value).toBe('');
  });

  /**
   * Splitting as it arrives rather than waiting to be confirmed: a pasted list is already a list,
   * and leaving it as text invites it being saved as one topic with commas in it - which the
   * server refuses outright.
   */
  it('splits a pasted list as soon as it arrives, leaving the last one being typed', async () => {
    await type('house, diy, hou');

    expect(chips()).toEqual(['house', 'diy']);
    expect(input().value).toBe('hou');
  });

  it('chips the last one too when the paste ends in a comma', async () => {
    await type('house, diy,');

    expect(chips()).toEqual(['house', 'diy']);
    expect(input().value).toBe('');
  });

  it('keeps a pasted list down to one of each', async () => {
    await type('house, diy, house,');

    expect(fixture.componentInstance.topics()).toEqual(['house', 'diy']);
  });

  /**
   * A topic is identified by how it is spelled, here as in the column, so these are three topics
   * and the field has no business merging them. Only the identical one is dropped.
   */
  it('chips each spelling, and the same spelling only once', async () => {
    await type('Küche, kuche, Küche, KUCHE,');

    expect(chips()).toEqual(['Küche', 'kuche', 'KUCHE']);
  });

  /**
   * The exception, and the one thing the column still folds: these are the same text by Unicode's
   * definition. Left alone they would be two chips and one row, and the write would be refused.
   */
  it('treats a composed and a combining accent as the same topic', async () => {
    await type('Caf\u00e9, Cafe\u0301,');

    expect(chips()).toEqual(['Caf\u00e9']);
  });

  /**
   * The offender is not always last. Overwriting the input with the tail threw away both the topic
   * that fitted and the one that did not, leaving nothing for the hint to name and Save alive.
   */
  it('keeps the whole paste in the input when one of its topics is too long', async () => {
    const long = 'l'.repeat(MAX_LABEL_LENGTH + 1);
    await type(`house, ${long}, diy`);

    expect(chips()).toEqual([]);
    expect(input().value).toBe(`house, ${long}, diy`);
    expect(fixture.nativeElement.textContent).toContain(`longer than ${MAX_LABEL_LENGTH}`);
  });

  /**
   * The same reason as the length: a queued capture the server refuses is discarded as settled and
   * never shown, so a topic it would refuse must not become part of one.
   */
  it('will not chip a topic the server would refuse, and says what is allowed', async () => {
    await type('Fix Roof,');

    expect(chips()).toEqual([]);
    expect(input().value).toBe('Fix Roof,');
    expect(fixture.nativeElement.textContent).toContain('letters, digits and hyphens');
  });

  // The whole point of moving the limit into the field: a queued capture the server refuses is
  // discarded, so a topic it would refuse must never become part of one.
  it('refuses a topic longer than the limit, keeps the text and says which one', async () => {
    const long = 'l'.repeat(MAX_LABEL_LENGTH + 1);
    await type(`house, ${long}`);
    await enter();

    // The one that fits is already a chip; only the one that does not is still being argued with.
    expect(fixture.componentInstance.topics()).toEqual(['house']);
    expect(input().value).toBe(long);
    expect(fixture.nativeElement.textContent).toContain(`longer than ${MAX_LABEL_LENGTH}`);
  });

  it('lets a topic exactly at the limit through', async () => {
    await type('l'.repeat(MAX_LABEL_LENGTH));
    await enter();

    expect(fixture.componentInstance.topics()).toEqual(['l'.repeat(MAX_LABEL_LENGTH)]);
  });

  it('drops a topic when its chip is removed', async () => {
    fixture.componentInstance.topics.set(['house', 'diy']);
    fixture.detectChanges();
    await fixture.whenStable();

    const remove: HTMLButtonElement = fixture.nativeElement.querySelector('[matChipRemove]');
    remove.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.topics()).toEqual(['diy']);
  });

  // A form asks for this before it reads the value, so text typed but never confirmed with Enter
  // is not silently dropped on save.
  it('commits text left in the input when the form asks it to', async () => {
    await type('roof');
    fixture.debugElement.children[0].componentInstance.commitPending();
    await fixture.whenStable();

    expect(fixture.componentInstance.topics()).toEqual(['roof']);
  });
});
