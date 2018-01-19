import { Injectable, OnDestroy } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs/Observable';
import { IAppState } from '../store/root.model';
import { NgRedux } from '@angular-redux/store';
import { IAuthState } from './auth.model';

@Injectable()
export class AuthGuard implements CanActivate, OnDestroy {
  private loggedIn = false;
  private subscription;
  constructor(
    private ngRedux: NgRedux<IAppState>,
    private router: Router
  ) {
    this.subscription = this.ngRedux.select<IAuthState>('auth')
      .subscribe(newAuthState => {
        this.loggedIn = newAuthState.token !== null;
      });
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (this.loggedIn) {
      return true;
    }

    this.router.navigate([ '/auth/login' ]);

    return false;
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
