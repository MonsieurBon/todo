import { Component } from '@angular/core';
import { dispatch, select } from '@angular-redux/store';
import { Observable } from 'rxjs/Observable';
import { LoginCredentials } from '../auth.events';
import { loginAction } from '../auth.actions';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css']
})
export class LoginPageComponent {
  @select(['auth', 'error']) error$: Observable<string>;
  @select(['auth', 'pending']) pending$: Observable<boolean>;

  constructor() { }

  @dispatch()
  login($event: LoginCredentials) {
    return loginAction($event);
  }
}
