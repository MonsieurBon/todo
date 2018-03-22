import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ITask, TaskState } from '../../tasklist.model';
import { TaskDetailComponent } from '../task-detail/task-detail.component';
import { updateTaskAction } from '../../task.actions';
import { dispatch } from '@angular-redux/store';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-tasklist-section-list-item',
  templateUrl: './tasklist-section-list-item.component.html',
  styleUrls: ['./tasklist-section-list-item.component.css'],
  animations: [
    trigger('hideAnimator', [
      state('hide', style({ opacity: 0 })),
      transition('* => hide', animate('500ms')),
    ])
  ]
})
export class TasklistSectionListItemComponent {
  @Input() task: ITask;

  hideAnimator = 'show';

  event: ITask;

  constructor(private modalService: NgbModal) {}

  switchTaskState($event: ITask) {
    this.hideAnimator = 'hide';
    this.event = $event;
  }

  @dispatch()
  sendUpdateTaskAction() {
    if (this.event) {
      const task = { ...this.event, state: this.event.state === TaskState.Todo ? TaskState.Done : TaskState.Todo };
      this.event = null;
      return updateTaskAction(task);
    }
  }

  showTaskDetails(task: ITask) {
    const modalRef = this.modalService.open(TaskDetailComponent, { size: 'lg' });
    modalRef.componentInstance.task = task;
  }
}
