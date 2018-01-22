import { Injectable, OnDestroy } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';
import { IAppState } from '../store/root.model';
import { NgRedux } from '@angular-redux/store';
import { IAuthState } from './auth.model';
import { catchError, filter, map } from 'rxjs/operators';
import { of } from 'rxjs/observable/of';
import { GraphqlService } from '../services/graphql.service';
import { GraphQlCheckToken } from '../services/graphql.definition';
import { fromPromise } from 'rxjs/observable/fromPromise';
import { checkTokenSuccessAction } from './auth.actions';

@Injectable()
export class AuthGuard implements CanActivate, OnDestroy {
  private loggedIn = false;
  private subscription;

  constructor(
    private graphql: GraphqlService,
    private ngRedux: NgRedux<IAppState>,
    private router: Router
  ) {
    this.subscription = this.ngRedux.select<IAuthState>('auth')
      .subscribe(newAuthState => {
        this.loggedIn = newAuthState.token !== null;
      });
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    const token = localStorage.getItem('token');
    let obs;

    if (this.loggedIn) {
      obs = of(true);
    } else if (!token) {
      obs = of(false);
    } else {
      obs = fromPromise(this.graphql.checkToken(token))
        .pipe(
          map((result: GraphQlCheckToken) => {
            if (result.checkToken.token !== null) {
              this.ngRedux.dispatch(checkTokenSuccessAction(token));
              return true;
            }
            return false;
          }),
          catchError(error => of(false))
        );
    }

    return obs
      .pipe(
        map(success => {
          if (!success) {
            localStorage.removeItem('token');
            this.router.navigate(['auth/login']);
          }

          return success;
        })
      );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
