import { Component, OnInit } from '@angular/core';
import { select, WithSubStore, NgRedux } from '@angular-redux/store';
import { tasklistReducer } from '../tasklist.reducer';
import { Observable } from 'rxjs/Observable';
import { Tasklist } from '../../tasklist';
import { Task } from '../../task';
import { ITasklist } from '../tasklist';
import { ITasklistState } from '../tasklist.model';

const TASKS: Task[] = [
  { id: 1, title: 'Task 1', startdate: new Date('2017-11-01'), type: 'CRITICAL_NOW'},
  { id: 2, title: 'Task 2', startdate: new Date('2017-11-02'), type: 'CRITICAL_NOW'},
  { id: 3, title: 'Task 3', startdate: new Date('2017-11-03'), type: 'OPPORTUNITY_NOW'},
  { id: 4, title: 'Task 4', startdate: new Date('2017-11-04'), type: 'OVER_THE_HORIZON'}
];

@WithSubStore({
  basePathMethodName: 'getBasePath',
  localReducer: tasklistReducer
})
@Component({
  selector: 'app-tasklist',
  templateUrl: './tasklist.component.html',
  styleUrls: ['./tasklist.component.css']
})
export class TasklistComponent {
  tasks = TASKS;

  tasklist: Tasklist = {
    id: 1,
    name: 'Privat'
  };

  @select() readonly tasklists$: Observable<ITasklist[]>;

  constructor(private ngRedux: NgRedux<ITasklistState>) {}

  getBasePath = () => 'tasklists';
}
