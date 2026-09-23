import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_LABEL_LENGTH, MAX_TITLE_LENGTH } from '../api/model';
import { BoardStore } from '../board/board-store';
import { CapturePage } from './capture-page';

/**
 * The form must not send what the server would refuse, and must say why. Rendered rather than
 * asserted on the computeds because `mat-error` reaches the DOM only when the control's own
 * errorState is true — a message can be right in the component and invisible on screen.
 */
describe('the capture form', () => {
  let captured: ReturnType<typeof vi.fn>;

  const render = async (): Promise<ComponentFixture<CapturePage>> => {
    const fixture = TestBed.createComponent(CapturePage);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const set = async (fixture: ComponentFixture<CapturePage>, name: string, value: string) => {
    const field: HTMLInputElement = fixture.nativeElement.querySelector(`[name="${name}"]`);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const button = (fixture: ComponentFixture<CapturePage>): HTMLButtonElement =>
    fixture.nativeElement.querySelector('button');

  const shareOf = (params: Record<string, string> | string) => ({
    useValue: {
      snapshot: {
        queryParamMap: convertToParamMap(typeof params === 'string' ? { title: params } : params),
      },
    },
  });

  beforeEach(() => {
    captured = vi.fn(async () => undefined);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BoardStore,
          useValue: {
            lists: signal([{ id: 1, name: 'Inbox', inbox: true, owned: true }]),
            online: signal(true),
            zones: signal([]),
            capture: captured,
          },
        },
        { provide: Router, useValue: { navigateByUrl: vi.fn(async () => true) } },
        { provide: ActivatedRoute, ...shareOf('') },
      ],
    });
  });

  it('sends a capture whose fields all fit', async () => {
    const fixture = await render();
    await set(fixture, 'title', 'Fix the roof');
    await set(fixture, 'labels', 'house, project-a');

    expect(button(fixture).disabled).toBe(false);
    button(fixture).click();
    await fixture.whenStable();

    expect(captured).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fix the roof', labels: ['house', 'project-a'] }),
    );
  });

  it('refuses to queue a topic the server would reject, and says which one', async () => {
    const fixture = await render();
    const long = 'l'.repeat(MAX_LABEL_LENGTH + 1);
    await set(fixture, 'title', 'Fix the roof');
    await set(fixture, 'labels', `house, ${long}`);

    expect(button(fixture).disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(long);
    expect(fixture.nativeElement.textContent).toContain(`longer than ${MAX_LABEL_LENGTH}`);

    button(fixture).click();
    await fixture.whenStable();
    expect(captured).not.toHaveBeenCalled();
  });

  // Set programmatically, so neither maxlength nor a touched-based error state ever sees it.
  it('files a share too long to be a title without the user editing anything', async () => {
    const body = `Ring the plumber back\n${'and '.repeat(MAX_TITLE_LENGTH)}`;
    TestBed.overrideProvider(ActivatedRoute, shareOf(body));
    const fixture = await render();

    expect(button(fixture).disabled).toBe(false);
    button(fixture).click();
    await fixture.whenStable();

    expect(captured).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ring the plumber back', notes: body.trim() }),
    );
  });

  // No maxlength on the field on purpose: a paste cut to 255 without saying so is silent loss.
  it('says why the button is dead when a pasted title runs past the limit', async () => {
    const fixture = await render();
    await set(fixture, 'title', 't'.repeat(MAX_TITLE_LENGTH + 12));

    expect(button(fixture).disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Too long by 12');
  });

  // ParamMap.get returns '' for a parameter that was sent but left empty, so `??` would keep it
  // and the shared text would be dropped with no trace.
  it('falls through to the shared text when the title parameter is present but empty', async () => {
    TestBed.overrideProvider(ActivatedRoute, shareOf({ title: '', text: 'Ring the plumber back' }));
    const fixture = await render();

    expect(button(fixture).disabled).toBe(false);
    button(fixture).click();
    await fixture.whenStable();

    expect(captured).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ring the plumber back' }),
    );
  });

  // ' ' is truthy, so without the trim the field looks empty and the button is dead in silence.
  it('falls through a whitespace-only title the same way', async () => {
    TestBed.overrideProvider(
      ActivatedRoute,
      shareOf({ title: '   ', text: 'Ring the plumber back' }),
    );
    const fixture = await render();

    expect(button(fixture).disabled).toBe(false);
    button(fixture).click();
    await fixture.whenStable();

    expect(captured).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ring the plumber back' }),
    );
  });

  it('keeps a selection shared alongside its own title', async () => {
    TestBed.overrideProvider(
      ActivatedRoute,
      shareOf({
        title: 'An article',
        text: 'the passage worth keeping',
        url: 'https://example.com',
      }),
    );
    const fixture = await render();
    button(fixture).click();
    await fixture.whenStable();

    expect(captured).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'An article',
        notes: 'the passage worth keeping\nhttps://example.com',
      }),
    );
  });

  // An <input> strips newlines from what it shows but not from the signal, so a multi-line share
  // that fits would display one string and save another.
  it('promotes the first line of a short multi-line share rather than titling it whole', async () => {
    TestBed.overrideProvider(ActivatedRoute, shareOf('Ring the plumber back\n0123 456789'));
    const fixture = await render();
    button(fixture).click();
    await fixture.whenStable();

    expect(captured).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Ring the plumber back',
        notes: 'Ring the plumber back\n0123 456789',
      }),
    );
  });

  it('lets a topic exactly at the limit through', async () => {
    const fixture = await render();
    await set(fixture, 'title', 'Fix the roof');
    await set(fixture, 'labels', 'l'.repeat(MAX_LABEL_LENGTH));

    expect(button(fixture).disabled).toBe(false);
  });
});
