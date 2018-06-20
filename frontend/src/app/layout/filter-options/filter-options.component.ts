import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { OutputDef } from '@angular/core/src/view';

@Component({
  selector: 'app-filter-options',
  templateUrl: './filter-options.component.html',
  styleUrls: ['./filter-options.component.css']
})
export class FilterOptionsComponent {
  @Input() showDone: boolean;
  @Input() showFuture: boolean;
  @Output() optionsChanged = new EventEmitter<any>();

  constructor() { }

  updateOptions($event) {
    const target = $event.target;
    this.optionsChanged.emit({
      name: target.name,
      checked: target.checked
    });
  }

}
