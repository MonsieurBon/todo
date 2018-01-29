import { Component, OnInit } from '@angular/core';
import { dispatch, select } from '@angular-redux/store';
import { Action } from 'redux';
import { loadAllDataAction } from '../../tasklist.actions';
import { ITask, TaskType } from '../../tasklist.model';

@Component({
  selector: 'app-tasklist-page',
  templateUrl: './tasklist-page.component.html',
  styleUrls: ['./tasklist-page.component.css']
})
export class TasklistPageComponent {
  @select(['tasklist', 'selectedTasklist', 'tasks']) tasks$: ITask[];
}
