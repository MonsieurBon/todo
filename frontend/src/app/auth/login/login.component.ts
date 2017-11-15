import { Component, OnDestroy, OnInit } from '@angular/core';
import { GraphqlActions } from '../../graphql/graphql.actions';
import { NgRedux, select, WithSubStore } from '@angular-redux/store';
import { authReducer } from '../auth.reducer';
import { Observable } from 'rxjs/Observable';
import { Router } from '@angular/router';
import { IAppState } from '../../store/root.model';
import { NgbModal, NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { LoadingModalComponent } from '../../layout/loading-modal/loading-modal.component';
import { IAuthState } from '../auth.model';
import { FormGroup } from '@angular/forms';

@WithSubStore({
  basePathMethodName: 'getBasePath',
  localReducer: authReducer
})
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnDestroy {
  @select() private error$: Observable<string>;

  private subscription;

  private username;
  private password;
  private loadingModalRef: NgbModalRef;

  constructor(
    private graphqlActions: GraphqlActions,
    private modalService: NgbModal,
    private ngRedux: NgRedux<IAppState>,
    private router: Router
  ) {
    this.subscription = this.ngRedux.select<IAuthState>(['auth'])
      .subscribe(newAuthState => {
        if (newAuthState.token !== null) {
          localStorage.setItem('token', newAuthState.token);
          this.router.navigate(['']);
          this.closeLoading();
        } else if (newAuthState.error !== null) {
          this.closeLoading();
        }
      });
  }

  login() {
    setTimeout(() => {
      this.openLoading();
    });
    this.graphqlActions.login(this.username, this.password);
  }

  private openLoading() {
    const options: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      size: 'sm',
      windowClass: 'centered-modal'
    };

    this.loadingModalRef = this.modalService.open(LoadingModalComponent, options);
  }

  private closeLoading() {
    if (this.loadingModalRef) {
      this.loadingModalRef.close();
      this.loadingModalRef = null;
    }
  }

  getBasePath = () => 'auth';

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
