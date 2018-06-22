import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { dispatch } from '@angular-redux/store';
import { createTasklist } from '../../tasklist/tasklist.actions';

@Component({
  selector: 'app-new-tasklist',
  templateUrl: './new-tasklist.component.html',
  styleUrls: ['./new-tasklist.component.css']
})
export class NewTasklistComponent {
  newTasklistForm: FormGroup;
  formSubmitted = false;

  constructor(
    private fb: FormBuilder,
    public activeModal: NgbActiveModal
  ) {
    this.createForm();
  }

  createForm() {
    this.newTasklistForm = this.fb.group({
      name: ['', Validators.required]
    });
  }

  submitForm() {
    this.formSubmitted = true;
    if (this.newTasklistForm.valid) {
      this.addTasklist();
      this.activeModal.close();
    }
  }

  @dispatch()
  private addTasklist() {
    const formValue = this.newTasklistForm.value;
    return createTasklist(formValue.name);
  }

  get name() {
    return this.newTasklistForm.get('name');
  }

}
