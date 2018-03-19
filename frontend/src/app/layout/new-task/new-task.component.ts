import { Component } from '@angular/core';
import { ITask, TaskState, TaskType } from '../../tasklist/tasklist.model';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { dispatch } from '@angular-redux/store';
import { addTaskAction } from '../../tasklist/task.actions';

@Component({
  selector: 'app-new-task',
  templateUrl: './new-task.component.html',
  styleUrls: ['./new-task.component.css']
})
export class NewTaskComponent {
  newTaskForm: FormGroup;
  tasktypes = Object.keys(TaskType).map(k => TaskType[k as any]);

  constructor(
    private fb: FormBuilder,
    public activeModal: NgbActiveModal
  ) {
    this.createForm();
  }

  createForm() {
    this.newTaskForm = this.fb.group({
      title: ['', Validators.required],
      startdate: [null, Validators.required],
      duedate: [null, null],
      description: '',
    });
  }

  submitForm() {
    this.addTask();
    this.activeModal.close();
  }

  @dispatch()
  private addTask() {
    const formValue = this.newTaskForm.value;
    const startdate = new Date(formValue.startdate.year, formValue.startdate.month - 1, formValue.startdate.day);
    const duedate = new Date(formValue.duedate.year, formValue.duedate.month - 1, formValue.duedate.day);
    const newTask: ITask = {
      title: formValue.title,
      description: formValue.description,
      startdate: startdate,
      duedate: duedate,
      state: TaskState.Todo,
      type: TaskType.Critical_Now
    };

    return addTaskAction(newTask);
  }
}
