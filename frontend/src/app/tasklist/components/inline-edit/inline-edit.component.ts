import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { NgbDateParserFormatter, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { DateParserFormatterService } from '../../../common/services/date-parser-formatter.service';

@Component({
  selector: 'app-inline-edit',
  templateUrl: './inline-edit.component.html',
  providers: [{provide: NgbDateParserFormatter, useClass: DateParserFormatterService}],
  styleUrls: [ './inline-edit.component.css' ]
})
export class InlineEditComponent implements OnChanges {
  @Input() type: string;
  @Input() required = false;
  @Input() value: any;
  @Input() defaultValue: string;
  @Input() dropdownOptions: string[];
  @Input() filter = false;
  filteredDropdownOptions: string[];
  editing = false;
  model: NgbDateStruct;

  @Output()
  edited = new EventEmitter<any>();

  field = new FormControl();

  constructor(private dateFormatter: NgbDateParserFormatter) {}

  ngOnChanges(changes: SimpleChanges): void {
    const {filter, value, dropdownOptions} = changes;
    if (dropdownOptions) {
      if (filter && filter.currentValue && value) {
        this.filteredDropdownOptions = dropdownOptions.currentValue.filter(o => o !== value.currentValue);
      } else {
        this.filteredDropdownOptions = dropdownOptions.currentValue;
      }
    }
  }

  changeValue($event: Event) {
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

  selectOption(option: string) {
    this.editing = false;
    if (this.value !== option) {
      this.value = option;
      this.filterOptions();
      this.edited.emit(option);
    }
  }

  private filterOptions() {
    if (this.filter && this.value) {
      this.filteredDropdownOptions = this.dropdownOptions.filter(o => o !== this.value);
    } else {
      this.filteredDropdownOptions = this.dropdownOptions;
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
