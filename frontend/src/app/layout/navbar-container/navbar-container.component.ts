import { Component, OnInit } from '@angular/core';
import { select } from '@angular-redux/store';
import { ITasklist } from '../../tasklist/tasklist.model';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-navbar-container',
  templateUrl: './navbar-container.component.html',
  styleUrls: ['./navbar-container.component.css']
})
export class NavbarContainerComponent {

  @select(['tasklist', 'selectedTasklist', 'name']) tasklistname$: string;
  @select(['tasklist', 'tasklists']) readonly tasklists$: Observable<ITasklist[]>;

}
