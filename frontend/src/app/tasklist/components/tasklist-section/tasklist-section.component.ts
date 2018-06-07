import { Component, Input } from '@angular/core';
import { ITask } from '../../tasklist.model';
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

  showTaskDetails(task: ITask) {
    const modalRef = this.modalService.open(TaskDetailComponent, { size: 'lg' });
    modalRef.componentInstance.task = task;
  }
}
