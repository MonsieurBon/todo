import {Injectable} from '@angular/core';
import {ActionsObservable} from 'redux-observable';
import { AuthActionTypes, loginFailedAction, loginSuccessAction, logoutFailed, logoutSuccess } from './auth.actions';
import {Action, AnyAction} from 'redux';
import {EMPTY, from, Observable, of} from 'rxjs';
import {catchError, map, mergeMap} from 'rxjs/operators';
import {GraphqlService} from '../services/graphql.service';
import { GraphQlDestroyToken, GraphQlLogin } from '../services/graphql.definition';
import {Router} from '@angular/router';

@Injectable()
export class AuthEpics {
  constructor(
    private graphQl: GraphqlService,
    private router: Router
  ) {}

  login = (action$: ActionsObservable<AnyAction>): Observable<AnyAction> => {
    return action$.ofType(AuthActionTypes.Login)
      .pipe(
        mergeMap((action: AnyAction) => {
          return from(this.graphQl.login(action.payload.username, action.payload.password, action.payload.rememberMe))
            .pipe(
              map((result: GraphQlLogin) => {
                if (result.createToken.token) {
                  return loginSuccessAction(result.createToken.token);
                } else {
                  return loginFailedAction(result.createToken.error);
                }
              }),
              catchError(error => of(loginFailedAction('Could not talk to server. Check your network connection.')))
            );
        })
      );
  }

  loginSuccess = (action$: ActionsObservable<AnyAction>, state$): Observable<Action> => {
    return action$.ofType(AuthActionTypes.LoginSuccess)
      .pipe(
        mergeMap((action: AnyAction) => {
          localStorage.setItem('token', action.payload);

          const authState = state$.value.auth;
          const requestedUrl = authState.requestedUrl ? authState.requestedUrl : '';

          this.router.navigate([requestedUrl]);
          return EMPTY;
        })
      );
  }

  logout = (action$: ActionsObservable<AnyAction>): Observable<Action> => {
    return action$.ofType(AuthActionTypes.Logout)
      .pipe(
        mergeMap((action: AnyAction) => {
          return from(this.graphQl.destroyToken())
            .pipe(
              map((result: GraphQlDestroyToken) => {
                if (result.destroyToken.success) {
                  return logoutSuccess();
                } else {
                  return logoutFailed('Logout failed');
                }
              }),
              catchError(error => of(logoutFailed(error)))
            );
        })
      );
  }

  logoutSuccess = (action$: ActionsObservable<AnyAction>): Observable<Action> => {
    return action$.ofType(AuthActionTypes.LogoutSuccess)
      .pipe(
        mergeMap((action: AnyAction) => {
          localStorage.removeItem('token');
          this.router.navigate(['auth/login']);
          return EMPTY;
        })
      );
  }
}
