import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs/index';
import { dispatch, select } from '@angular-redux/store';
import { hideDoneAction, hideFutureAction, showDoneAction, showFutureAction } from '../../filter/filter.actions';

@Component({
  selector: 'app-filter-options-container',
  templateUrl: './filter-options-container.component.html',
  styleUrls: ['./filter-options-container.component.css']
})
export class FilterOptionsContainerComponent {
  @select(['filter', 'showDone']) showDone$: Observable<boolean>;
  @select(['filter', 'showFuture']) showFuture$: Observable<boolean>;

  constructor() { }

  @dispatch()
  updateFilterOptions($event) {
    const {name, checked} = $event;

    if (name === 'showDone') {
      return checked ? showDoneAction() : hideDoneAction();
    } else {
      return checked ? showFutureAction() : hideFutureAction();
    }
  }

}
