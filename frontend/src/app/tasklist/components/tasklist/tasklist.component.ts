import { Component, Input, OnInit } from '@angular/core';
import { ITask, TaskType } from '../../tasklist.model';
import { dispatch } from '@angular-redux/store';
import { moveTaskAction } from '../../task.actions';
import { DndDropEvent } from 'ngx-drag-drop';

@Component({
  selector: 'app-tasklist',
  templateUrl: './tasklist.component.html',
  styleUrls: [ './tasklist.component.css' ]
})
export class TasklistComponent {
  @Input() tasks: ITask[][];

  @dispatch()
  dropped($event: DndDropEvent, newType: TaskType) {
    const task: ITask = {
      ...$event.data,
      startdate: new Date($event.data.startdate),
      duedate: $event.data.duedate ? new Date($event.data.duedate) : null
    };
    return moveTaskAction({ ...task, type: newType }, task.type);
  }
}
