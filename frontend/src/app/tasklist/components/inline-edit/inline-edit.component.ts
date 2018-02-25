import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { NgbDateParserFormatter, NgbDatepicker, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { DateParserFormatterService } from '../../services/date-parser-formatter.service';

@Component({
  selector: 'app-inline-edit',
  templateUrl: './inline-edit.component.html',
  providers: [{provide: NgbDateParserFormatter, useClass: DateParserFormatterService}],
  styleUrls: [ './inline-edit.component.css' ]
})
export class InlineEditComponent {
  @ViewChild('dp') datePicker: NgbDatepicker;
  @Input() type: string;
  @Input() required = false;
  @Input() value: string;
  editing = false;
  model: NgbDateStruct;

  @Output()
  edited = new EventEmitter<string|NgbDateStruct>();

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

    const newDate = this.dateFormatter.format(this.model);

    if (this.value !== newDate) {
      this.value = newDate;
      this.edited.emit(this.model);
    }
  }

  edit() {
    if (this.type === 'date') {
      const [day, month, year] = this.value.split('.');
      this.model = {year: Number(year), month: Number(month), day: Number(day)};
    } else {
      this.field.setValue(this.value);
    }
    this.editing = true;
  }
}
