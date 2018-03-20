import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { NgbDateParserFormatter, NgbDatepicker, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { DateParserFormatterService } from '../../../common/services/date-parser-formatter.service';
import { isNumber } from '../../../common/utility-functions';

@Component({
  selector: 'app-inline-edit',
  templateUrl: './inline-edit.component.html',
  providers: [{provide: NgbDateParserFormatter, useClass: DateParserFormatterService}],
  styleUrls: [ './inline-edit.component.css' ]
})
export class InlineEditComponent {
  @Input() type: string;
  @Input() required = false;
  @Input() value: any;
  @Input() defaultValue: string;
  editing = false;
  model: NgbDateStruct;

  @Output()
  edited = new EventEmitter<any>();

  field = new FormControl();

  constructor(private dateFormatter: NgbDateParserFormatter) {}

  onBlur($event: Event) {
    if (this.required && !this.field.value) {
      return;
    }

    this.editing = false;
    if (this.value !== this.field.value) {
      this.value = this.field.value;
      this.edited.emit(this.field.value);
    }
  }

  onSelectDate($event: Event) {
    if (this.required && !this.model) {
      return;
    }

    this.editing = false;
    let newDate = null;
    if (this.model) {
      newDate = new Date(this.model.year, this.model.month - 1, this.model.day);
    }

    if (this.value !== newDate) {
      this.value = newDate;
      this.edited.emit(this.model);
    }
  }

  edit() {
    if (this.type === 'date') {
      if (this.value) {
        const date: Date = this.value;
        this.model = { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
      }
    } else {
      this.field.setValue(this.value);
    }
    this.editing = true;
  }
}
