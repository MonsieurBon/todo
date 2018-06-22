import { Component } from '@angular/core';
import { ITask, TaskState, TaskType } from '../../tasklist/tasklist.model';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { NgbActiveModal, NgbDateParserFormatter, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { dispatch } from '@angular-redux/store';
import { addTaskAction } from '../../tasklist/task.actions';
import { DateParserFormatterService } from '../../common/services/date-parser-formatter.service';

@Component({
  selector: 'app-new-task',
  templateUrl: './new-task.component.html',
  providers: [{provide: NgbDateParserFormatter, useClass: DateParserFormatterService}],
  styleUrls: ['./new-task.component.css']
})
export class NewTaskComponent {
  newTaskForm: FormGroup;
  tasktypes = Object.keys(TaskType).map(k => TaskType[k as any]);
  formSubmitted = false;

  constructor(
    private fb: FormBuilder,
    public activeModal: NgbActiveModal
  ) {
    this.createForm();
  }

  createForm() {
    const today = new Date();
    this.newTaskForm = this.fb.group({
      title: ['', Validators.required],
      type: [TaskType.CRITICAL_NOW, Validators.required],
      startdate: [ {
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        day: today.getDate()
      }, Validators.required ],
      duedate: [ null, null ],
      description: '',
    }, {
      validator: this.dueDateAfterStartdate()
    });

    this.newTaskForm.controls['type'].setValue(TaskType.CRITICAL_NOW, {onlySelf: true});
  }

  submitForm() {
    this.formSubmitted = true;
    if (this.newTaskForm.valid) {
      this.addTask();
      this.activeModal.close();
    }
  }

  @dispatch()
  private addTask() {
    const formValue = this.newTaskForm.value;
    const startdate = new Date(formValue.startdate.year, formValue.startdate.month - 1, formValue.startdate.day);
    const newTask: ITask = {
      title: formValue.title,
      description: formValue.description,
      startdate: startdate,
      state: TaskState.TODO,
      type: formValue.type
    };

    if (formValue.duedate) {
      const duedate = new Date(formValue.duedate.year, formValue.duedate.month - 1, formValue.duedate.day);
      newTask.duedate = duedate;
    }

    return addTaskAction(newTask);
  }

  dueDateAfterStartdate() {
    return (group: FormGroup): {[key: string]: any} => {
      const rawStartdate: NgbDateStruct = group.value.startdate;
      const rawDuedate: NgbDateStruct = group.value.duedate;

      if (rawStartdate && rawDuedate) {
        const startdate = new Date(rawStartdate.year, rawStartdate.month - 1, rawStartdate.day);
        const duedate = new Date(rawDuedate.year, rawDuedate.month - 1, rawDuedate.day);
        const startdateIsLater = startdate.getTime() > duedate.getTime();
        return startdateIsLater ? {'invalidDuedate': 'Duedate must be after startdate.'} : null;
      }

      return null;
    };
  }

  get title() { return this.newTaskForm.get('title'); }

  get startdate() { return this.newTaskForm.get('startdate'); }

  get duedateError() {
    const invalidDuedate = this.newTaskForm.getError('invalidDuedate');
    return invalidDuedate ? invalidDuedate : null;
  }
}
