import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { ITask, TaskState, TaskType } from '../../tasklist.model';
import { NgbActiveModal, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { TitleCasePipe } from '@angular/common';
import { moveTaskAction, updateTaskAction } from '../../task.actions';
import { dispatch } from '@angular-redux/store';
import { ReplacePipe } from '../../../common/pipes/replace.pipe';
import { startCase } from 'lodash-es';
import { SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-task-detail',
  templateUrl: './task-detail.component.html',
  styleUrls: ['./task-detail.component.css']
})
export class TaskDetailComponent implements OnInit {
  @Input() task: ITask;
  typeOptions: string[];
  private replacePipe = new ReplacePipe();

  constructor(public activeModal: NgbActiveModal) {}

  ngOnInit(): void {
    this.typeOptions = Object.keys(TaskType)
      .map(k => k.toLowerCase())
      .map(k => startCase(k));
  }

  isDone() {
    return this.task.state === TaskState.DONE;
  }

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

  @dispatch()
  updateTaskType(type: string) {
    const currentType = this.task.type;
    const newType = this.replacePipe.transform(type.toUpperCase(), ' ', '_');
    this.task.type = TaskType[newType];
    return moveTaskAction(this.task, currentType);
  }
}
