import { Action, AnyAction } from 'redux';
import { LoginCredentials } from './auth.events';

export enum AuthActionTypes {
  RequestedUrl = '[Auth] Requested Url',
  Login = '[Auth] Login',
  LoginSuccess = '[Auth] Login Success',
  LoginFailed = '[Auth] Login Failed',
  CheckTokenSuccess = '[Auth] Check Token Success',
  Logout = '[Auth] Logout',
  LogoutSuccess = '[Auth] Logout Success',
  LogoutFailed = '[Auth] Logout Failed'
}

export const requestedUrlAction = (url: string): AnyAction => ({type: AuthActionTypes.RequestedUrl, payload: url});

export const loginAction = (credentials: LoginCredentials): AnyAction => ({type: AuthActionTypes.Login, payload: credentials});

export const loginSuccessAction = (token: string): AnyAction => ({type: AuthActionTypes.LoginSuccess, payload: token});

export const loginFailedAction = (error: string): AnyAction => ({type: AuthActionTypes.LoginFailed, payload: error});

export const checkTokenSuccessAction = (token: string): AnyAction => ({type: AuthActionTypes.CheckTokenSuccess, payload: token});

export const logoutAction = (): Action => ({type: AuthActionTypes.Logout});

export const logoutSuccess = (): Action => ({type: AuthActionTypes.LogoutSuccess});

export const logoutFailed = (error: string): AnyAction => ({type: AuthActionTypes.LogoutFailed, payload: error});
