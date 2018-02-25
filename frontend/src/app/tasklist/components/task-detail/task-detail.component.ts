import { Component, Input } from '@angular/core';
import { ITask } from '../../tasklist.model';
import { NgbActiveModal, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { TitleCasePipe } from '@angular/common';
import { updateTaskAction } from '../../task.actions';
import { dispatch } from '@angular-redux/store';

@Component({
  selector: 'app-task-detail',
  templateUrl: './task-detail.component.html',
  styleUrls: ['./task-detail.component.css']
})
export class TaskDetailComponent {
  @Input() task: ITask;

  constructor(public activeModal: NgbActiveModal) {}

  @dispatch()
  updateTaskDescription(description: string) {
    this.task.description = description;
    return updateTaskAction(this.task);
  }

  @dispatch()
  updateTaskTitle(title: string) {
    this.task.title = title;
    return updateTaskAction(this.task);
  }

  @dispatch()
  updateTaskStartdate({year, month, day}: NgbDateStruct) {
    this.task.startdate = new Date(year, month - 1, day);
    return updateTaskAction(this.task);
  }

  @dispatch()
  updateTaskDuedate(date: NgbDateStruct) {
    if (date) {
      const {year, month, day} = date;
      this.task.duedate = new Date(year, month - 1, day);
    } else {
      this.task.duedate = null;
    }
    return updateTaskAction(this.task);
  }
}
