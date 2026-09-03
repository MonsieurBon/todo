import { inject, provideAppInitializer } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * The icon set, inlined.
 *
 * <p>Material's icon font is a web font, and the app has to look the same with no connection —
 * an icon that arrives late renders as its own name in the meantime, which is worse than a shape
 * that was always there. These ship in the bundle, so there is nothing to fetch.
 */
const PATHS: Record<string, string> = {
  check: '<polyline points="4 12.5 9.5 18 20 6.5"/>',
  box: '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/>',
  undo: '<path d="M4 9h10a5 5 0 0 1 0 10h-6"/><polyline points="8 4 3.5 9 8 14"/>',
  up: '<line x1="12" y1="20" x2="12" y2="5"/><polyline points="5.5 11.5 12 5 18.5 11.5"/>',
  down: '<line x1="12" y1="4" x2="12" y2="19"/><polyline points="5.5 12.5 12 19 18.5 12.5"/>',
  later: '<circle cx="12" cy="12" r="8.5"/><polyline points="12 7 12 12 15.5 14"/>',
  edit: '<path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20z"/>',
  trash:
    '<polyline points="4 6.5 20 6.5"/><path d="M9 6.5V4h6v2.5"/><path d="M6 6.5 7 20h10l1-13.5"/>',
  add: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  filter: '<polyline points="3.5 5.5 20.5 5.5 14 13 14 19.5 10 17.5 10 13"/>',
  lists:
    '<line x1="9" y1="6.5" x2="20" y2="6.5"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="17.5" x2="20" y2="17.5"/><circle cx="4.5" cy="6.5" r="1.3"/><circle cx="4.5" cy="12" r="1.3"/><circle cx="4.5" cy="17.5" r="1.3"/>',
  review: '<circle cx="11" cy="11" r="6.5"/><line x1="16" y1="16" x2="21" y2="21"/>',
  board:
    '<rect x="3.5" y="4" width="17" height="5" rx="1.5"/><rect x="3.5" y="12" width="17" height="8" rx="1.5"/>',
  share:
    '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><line x1="8.2" y1="10.8" x2="15.8" y2="6.7"/><line x1="8.2" y1="13.2" x2="15.8" y2="17.3"/>',
  offline:
    '<path d="M6.5 18.5a4 4 0 0 1-.3-8A6 6 0 0 1 16.5 8"/><path d="M17 10.5a4 4 0 0 1 1 7.9"/><line x1="3" y1="3" x2="21" y2="21"/>',
  sync: '<path d="M20 12a8 8 0 0 1-13.7 5.6"/><path d="M4 12a8 8 0 0 1 13.7-5.6"/><polyline points="17.5 2.5 17.9 6.7 13.7 7.1"/><polyline points="6.5 21.5 6.1 17.3 10.3 16.9"/>',
  account: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  logout:
    '<path d="M14 6V4H5v16h9v-2"/><line x1="9" y1="12" x2="20" y2="12"/><polyline points="16.5 8.5 20 12 16.5 15.5"/>',
  label:
    '<path d="M3.5 8.5 8.5 3.5H19a1.5 1.5 0 0 1 1.5 1.5v10.5l-5 5-12-12z"/><circle cx="8" cy="8" r="1.2"/>',
  back: '<line x1="20" y1="12" x2="4" y2="12"/><polyline points="10 6 4 12 10 18"/>',
};

const SVG = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export function provideIcons() {
  return provideAppInitializer(() => {
    const registry = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    for (const [name, body] of Object.entries(PATHS)) {
      registry.addSvgIconLiteral(name, sanitizer.bypassSecurityTrustHtml(SVG(body)));
    }
    registry.setDefaultFontSetClass('app-no-icon-font');
  });
}
