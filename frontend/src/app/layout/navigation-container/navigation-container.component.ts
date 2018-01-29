import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { ITasklist } from '../../tasklist/tasklist.model';
import { select } from '@angular-redux/store';

@Component({
  selector: 'app-navigation-container',
  templateUrl: './navigation-container.component.html',
  styleUrls: ['./navigation-container.component.css']
})
export class NavigationContainerComponent {
  @select(['tasklist', 'tasklists']) readonly tasklists$: Observable<ITasklist[]>;
}
