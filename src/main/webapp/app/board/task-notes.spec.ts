import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TaskNotes } from './task-notes';

describe('the notes of a task', () => {
  const rendered = async (notes: string): Promise<HTMLElement> => {
    const fixture = TestBed.createComponent(TaskNotes);
    fixture.componentRef.setInput('notes', notes);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('renders markdown', async () => {
    const element = await rendered('**Behind** the bath.');

    expect(element.querySelector('strong')?.textContent).toBe('Behind');
  });

  it('renders a list as a list', async () => {
    const element = await rendered('- tiles\n- grout');

    expect(element.querySelectorAll('li')).toHaveLength(2);
  });

  // marked has no opinion on the scheme, so this is Angular's sanitizer doing its half of the job.
  it('refuses to make a javascript: link clickable', async () => {
    const element = await rendered('[tiles](javascript:alert(1))');

    expect(element.querySelector('a')?.getAttribute('href')).not.toMatch(/^javascript:/);
  });

  it('shows plain text as it was written', async () => {
    const element = await rendered('Behind the bath.');

    expect(element.textContent).toContain('Behind the bath.');
  });
});
