import { Component, OnInit } from '@angular/core';
import { select } from '@angular-redux/store';
import { Observable } from 'rxjs/Observable';
import { ITasklist } from '../../tasklist/tasklist';

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css']
})
export class NavigationComponent {

  @select(['tasklists', 'tasklists']) readonly tasklists$: Observable<ITasklist[]>;

}
