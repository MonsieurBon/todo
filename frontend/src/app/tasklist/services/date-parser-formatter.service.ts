import { Injectable } from '@angular/core';
import { NgbDateParserFormatter, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { isNumber, padNumber } from '../../common/utility-functions';

@Injectable()
export class DateParserFormatterService extends NgbDateParserFormatter {
  constructor() {
    super();
  }

  parse(value: string): NgbDateStruct {
    const [day, month, year] = value.split('.');
    return {year: Number(year), month: Number(month), day: Number(day)};
  }

  format(date: NgbDateStruct): string {
    if (date && isNumber(date.day) && isNumber(date.month) && isNumber(date.year)) {
      return padNumber(date.day) + '.' + padNumber(date.month) + '.' + date.year;
    }

    return null;
  }
}
