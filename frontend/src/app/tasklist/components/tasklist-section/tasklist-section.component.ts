import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { ITask, TaskState } from '../../tasklist.model';
import { dispatch } from '@angular-redux/store';
import { updateTaskAction } from '../../task.actions';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TaskDetailComponent } from '../task-detail/task-detail.component';
import { animate, state, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-tasklist-section',
  templateUrl: './tasklist-section.component.html',
  styleUrls: [ './tasklist-section.component.css' ]
})
export class TasklistSectionComponent {
  @Input() tasks: ITask[] = [];
}
