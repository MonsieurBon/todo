import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'default'
})
export class DefaultPipe implements PipeTransform {

  transform<T>(value: T, def: T): T {
    return value ? value : def;
  }

}
