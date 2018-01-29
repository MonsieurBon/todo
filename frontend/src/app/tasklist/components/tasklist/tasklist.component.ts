import { Component, Input, OnInit } from '@angular/core';
import { ITask, TaskType } from '../../tasklist.model';

@Component({
  selector: 'app-tasklist',
  templateUrl: './tasklist.component.html',
  styleUrls: ['./tasklist.component.css']
})
export class TasklistComponent {
  @Input() tasks: ITask[][];
}
