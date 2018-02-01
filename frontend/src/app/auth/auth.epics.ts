import { Injectable } from '@angular/core';
import { ActionsObservable } from 'redux-observable';
import { AuthActionTypes, loginFailedAction, loginSuccessAction } from './auth.actions';
import { Action, AnyAction } from 'redux';
import { Observable } from 'rxjs/Observable';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { GraphqlService } from '../services/graphql.service';
import { fromPromise } from 'rxjs/observable/fromPromise';
import { of } from 'rxjs/observable/of';
import { GraphQlLogin } from '../services/graphql.definition';
import { Router } from '@angular/router';
import { empty } from 'rxjs/observable/empty';

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
          return fromPromise(this.graphQl.login(action.payload.username, action.payload.password))
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

  loginSuccess = (action$: ActionsObservable<AnyAction>, state): Observable<Action> => {
    return action$.ofType(AuthActionTypes.LoginSuccess)
      .pipe(
        mergeMap((action: AnyAction) => {
          localStorage.setItem('token', action.payload);

          const authState = state.getState().auth;
          const requestedUrl = authState.requestedUrl ? authState.requestedUrl : '';

          this.router.navigate([requestedUrl]);
          return empty();
        })
      );
  }
}
