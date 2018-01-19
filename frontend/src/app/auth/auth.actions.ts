import { Action, AnyAction } from 'redux';
import { LoginCredentials } from './auth.events';

export enum AuthActionTypes {
  Login = '[Auth] Login',
  LoginSuccess = '[Auth] Login Success',
  LoginFailed = '[Auth] Login Failed',
  Logout = '[Auth] Logout',
}

export const loginAction = (payload: LoginCredentials): AnyAction => ({type: AuthActionTypes.Login, payload});

export const loginSuccessAction = (token: string): AnyAction => ({type: AuthActionTypes.LoginSuccess, payload: token});

export const loginFailedAction = (error: string): AnyAction => ({type: AuthActionTypes.LoginFailed, payload: error});
