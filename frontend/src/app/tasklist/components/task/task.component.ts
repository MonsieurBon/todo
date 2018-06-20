import { Component, Input } from '@angular/core';
import { ITask, TaskState } from '../../tasklist.model';
import { updateTaskAction } from '../../task.actions';
import { dispatch } from '@angular-redux/store';

@Component({
  selector: '[appTask]', // tslint:disable-line:component-selector
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.css']
})
export class TaskComponent {
  @Input() task: ITask;

  isDone() {
    return this.task.state === TaskState.DONE;
  }

  @dispatch()
  updateTaskState(newState: TaskState) {
    const task = { ...this.task, state: newState };
    return updateTaskAction(task);
  }

  switchTaskState() {
    const newState = this.task.state === TaskState.TODO ? TaskState.DONE : TaskState.TODO;
    this.updateTaskState(newState);
  }
}
