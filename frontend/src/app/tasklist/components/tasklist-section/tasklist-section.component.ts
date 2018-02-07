import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ITask, TaskState } from '../../tasklist.model';
import { dispatch } from '@angular-redux/store';
import { updateTaskAction } from '../../task.actions';

@Component({
  selector: 'app-tasklist-section',
  templateUrl: './tasklist-section.component.html',
  styleUrls: ['./tasklist-section.component.css']
})
export class TasklistSectionComponent {
  @Input() tasks: ITask[] = [];

  @dispatch()
  switchTaskState($event: ITask) {
    const task = {...$event, state: $event.state === TaskState.Todo ? TaskState.Done : TaskState.Todo};
    return updateTaskAction(task);
  }
}
