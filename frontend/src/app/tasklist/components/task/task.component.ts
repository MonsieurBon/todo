import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ITask, TaskState } from '../../tasklist.model';

@Component({
  selector: '[appTask]', // tslint:disable-line:component-selector
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.css']
})
export class TaskComponent {
  @Input() task: ITask;

  @Output() taskToSwitch = new EventEmitter<ITask>();

  isDone() {
    return this.task.state === TaskState.Done;
  }

  switchTaskState() {
    this.taskToSwitch.emit(this.task);
  }
}
