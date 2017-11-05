import { Injectable, OnDestroy } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { NgRedux } from '@angular-redux/store';
import { IAppState } from '../store/root.model';
import { IAuthState } from '../auth/auth.model';

@Injectable()
export class AuthGuard implements CanActivate, OnDestroy {
  private loggedIn = false;
  private subscription;

  constructor(
    private router: Router,
    private ngRedux: NgRedux<IAppState>
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

    this.router.navigate(['/auth/login']);

    return false;
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
