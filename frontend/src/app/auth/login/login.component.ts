import { Component, OnDestroy } from '@angular/core';
import { GraphqlActions } from '../../graphql/graphql.actions';
import { NgRedux, select, WithSubStore } from '@angular-redux/store';
import { authReducer } from '../auth.reducer';
import { Observable } from 'rxjs/Observable';
import { Router } from '@angular/router';
import { IAppState } from '../../store/root.model';
import { NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { LoadingModalComponent } from '../../layout/loading-modal/loading-modal.component';

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
  @select() private readonly error$: Observable<string>;

  private subscription;
  private username;
  private password;
  private loadingModalRef;

  constructor(
    private graphqlActions: GraphqlActions,
    private modalService: NgbModal,
    private ngRedux: NgRedux<IAppState>,
    private router: Router
  ) {
    this.subscription = this.ngRedux.select<string>(['auth', 'token'])
      .subscribe(newToken => {
        if (newToken !== null) {
          localStorage.setItem('token', newToken);
          this.router.navigate(['']);
          if (this.loadingModalRef) {
            this.loadingModalRef.close();
            this.loadingModalRef = null;
          }
        }
      });
  }

  login() {
    this.openLoading();
    this.graphqlActions.login(this.username, this.password);
  }

  openLoading() {
    const options: NgbModalOptions = {
      backdrop: 'static',
      keyboard: false,
      size: 'sm',
      windowClass: 'centered-modal'
    };

    this.loadingModalRef = this.modalService.open(LoadingModalComponent, options);
  }

  getBasePath = () => 'auth';

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
