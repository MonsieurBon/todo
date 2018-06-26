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

  @Input()
  set disabled(disabled: boolean) {
    if (disabled) {
      this.form.disable();
      this.showLoading = true;
    } else {
      this.form.enable();
      this.showLoading = false;
    }
  }

  @Output() submitted = new EventEmitter<LoginCredentials>();

  showLoading = false;

  form: FormGroup = new FormGroup({
    username: new FormControl(''),
    password: new FormControl(''),
    rememberMe: new FormControl('')
  });

  constructor() { }

  login() {
    if (this.form.valid) {
      this.submitted.emit(this.form.value);
    }
  }

}
