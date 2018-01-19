import { Injectable } from '@angular/core';
import { ActionsObservable } from 'redux-observable';
import { AuthActionTypes, loginFailedAction, loginSuccessAction } from './auth.actions';
import { Action, AnyAction } from 'redux';
import { Observable } from 'rxjs/Observable';
import { catchError, map, mergeMap, startWith } from 'rxjs/operators';
import { GraphqlService } from '../services/graphql.service';
import { fromPromise } from 'rxjs/observable/fromPromise';
import { of } from 'rxjs/observable/of';
import { closeLoadingModalAction, openLoadingModalAction } from '../layout/layout.actions';
import { GraphQlCheckToken, GraphQlLogin } from '../services/graphql.definition';
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
              catchError(error => of(loginFailedAction(error))),
              startWith(openLoadingModalAction())
            );
        })
      );
  }

  loginSuccess = (action$: ActionsObservable<AnyAction>): Observable<Action> => {
    return action$.ofType(AuthActionTypes.LoginSuccess)
      .pipe(
        map((action: AnyAction) => {
          localStorage.setItem('token', action.payload);
          this.router.navigate(['']);
          return closeLoadingModalAction();
        })
      );
  }

  loginFailed = (action$: ActionsObservable<Action>): Observable<Action> => {
    return action$.ofType(AuthActionTypes.LoginFailed)
      .pipe(
        map(() => closeLoadingModalAction())
      );
  }
}
