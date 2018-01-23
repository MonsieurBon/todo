import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { LoginCredentials } from '../auth.events';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-login-form',
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.css']
})
export class LoginFormComponent {
  @Input() error = '';

  @Output() submitted = new EventEmitter<LoginCredentials>();

  showLoading = false;

  form: FormGroup = new FormGroup({
    username: new FormControl(''),
    password: new FormControl('')
  });

  constructor() { }

  login() {
    if (this.form.valid) {
      this.form.disable();
      this.showLoading = true;
      this.submitted.emit(this.form.value);
    }
  }

}
