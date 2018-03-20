import { TestBed, inject } from '@angular/core/testing';

import { DateParserFormatterService } from './date-parser-formatter.service';

describe('DateParserFormatterService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DateParserFormatterService]
    });
  });

  it('should be created', inject([DateParserFormatterService], (service: DateParserFormatterService) => {
    expect(service).toBeTruthy();
  }));
});
