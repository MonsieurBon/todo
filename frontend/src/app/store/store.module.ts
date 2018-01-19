import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DevToolsExtension, NgRedux, NgReduxModule } from '@angular-redux/store';
import { createLogger } from 'redux-logger';
import { IAppState } from './root.model';
import { environment } from '../../environments/environment';
import { rootReducer } from './root.reducer';
import { combineEpics, createEpicMiddleware } from 'redux-observable';
import { AuthEpics } from '../auth/auth.epics';
import { LayoutEpics } from '../layout/layout.epics';

@NgModule({
  imports: [
    CommonModule,
    NgReduxModule
  ],
  declarations: [],
  providers: [AuthEpics, LayoutEpics]
})
export class StoreModule {
  constructor(
    private authEpics: AuthEpics,
    private layoutEpics: LayoutEpics,
    private ngRedux: NgRedux<IAppState>,
    private devTools: DevToolsExtension
  ) {
    const middleware = [
      createEpicMiddleware(
        combineEpics(
          this.authEpics.login,
          this.authEpics.loginSuccess,
          this.authEpics.loginFailed,
          this.layoutEpics.openLoadingModal,
          this.layoutEpics.closeLoadingModal
        )
      )
    ];

    if (!environment.production) {
      middleware.push(createLogger());
    }

    this.ngRedux.configureStore(
      rootReducer,
      {},
      middleware,
      this.devTools.isEnabled() ? [ this.devTools.enhancer() ] : []
    );
  }
}
