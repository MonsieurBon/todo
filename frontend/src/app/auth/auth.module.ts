import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginFormComponent } from './login-form/login-form.component';
import { LoginPageComponent } from './login-page/login-page.component';
import { authRouting } from './auth.routes';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  imports: [
    authRouting,
    CommonModule,
    ReactiveFormsModule
  ],
  declarations: [LoginFormComponent, LoginPageComponent]
})
export class AuthModule { }
