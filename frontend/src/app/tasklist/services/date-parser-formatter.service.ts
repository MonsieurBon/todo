import { Injectable } from '@angular/core';
import { NgbDateParserFormatter, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

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
    if (date && this.isNumber(date.day) && this.isNumber(date.month) && this.isNumber(date.year)) {
      return this.padNumber(date.day) + '.' + this.padNumber(date.month) + '.' + date.year;
    }

    return null;
  }

  private isNumber(value: any): boolean {
    return !isNaN(this.toInteger(value));
  }

  private toInteger(value: any): number {
    return parseInt(`${value}`, 10);
  }

  private padNumber(value: number) {
    if (this.isNumber(value)) {
      return `0${value}`.slice(-2);
    } else {
      return '';
    }
  }
}
