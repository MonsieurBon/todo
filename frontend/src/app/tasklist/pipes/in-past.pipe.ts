import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'inPast'
})
export class InPastPipe implements PipeTransform {
  private today: Date;

  constructor() {
    this.today = new Date();
  }


  transform(date: Date): boolean {
    const currentYear = this.today.getFullYear();
    const currentMonth = this.today.getMonth();
    const currentDay = this.today.getDate();

    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    if (currentYear > year) {
      return true;
    } else if (currentYear < year) {
      return false;
    }

    if (currentMonth > month) {
      return true;
    } else if (currentMonth < month) {
      return false;
    }

    if (currentDay > day) {
      return true;
    }

    return false;
  }

}
