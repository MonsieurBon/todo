import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter'
})
export class FilterPipe implements PipeTransform {

  transform<T>(value: Array<T>, property: string, filter: any, inverse = false): Array<T> {
    if (value && value.length > 0) {
      return value.filter(element => inverse ? element[ property ] !== filter : element[ property ] === filter);
    }

    return value;
  }

}
