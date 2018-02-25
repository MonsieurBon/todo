import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ITask, TaskState } from '../../tasklist.model';
import { dispatch } from '@angular-redux/store';
import { updateTaskAction } from '../../task.actions';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TaskDetailComponent } from '../task-detail/task-detail.component';

@Component({
  selector: 'app-tasklist-section',
  templateUrl: './tasklist-section.component.html',
  styleUrls: [ './tasklist-section.component.css' ]
})
export class TasklistSectionComponent {
  @Input() tasks: ITask[] = [];

  constructor(private modalService: NgbModal) {}

  @dispatch()
  switchTaskState($event: ITask) {
    const task = { ...$event, state: $event.state === TaskState.Todo ? TaskState.Done : TaskState.Todo };
    return updateTaskAction(task);
  }

  showTaskDetails(task: ITask) {
    const modalRef = this.modalService.open(TaskDetailComponent, { size: 'lg' });
    modalRef.componentInstance.task = task;
  }
}
