import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginFormComponent } from './login-form/login-form.component';
import { LoginPageComponent } from './login-page/login-page.component';
import { authRouting } from './auth.routes';

@NgModule({
  imports: [
    CommonModule,
    authRouting
  ],
  declarations: [LoginFormComponent, LoginPageComponent]
})
export class AuthModule { }
