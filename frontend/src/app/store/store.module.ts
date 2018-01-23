import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DevToolsExtension, NgRedux, NgReduxModule } from '@angular-redux/store';
import { createLogger } from 'redux-logger';
import { IAppState } from './root.model';
import { environment } from '../../environments/environment';
import { rootReducer } from './root.reducer';
import { combineEpics, createEpicMiddleware } from 'redux-observable';
import { AuthEpics } from '../auth/auth.epics';

@NgModule({
  imports: [
    CommonModule,
    NgReduxModule
  ],
  declarations: [],
  providers: [AuthEpics]
})
export class StoreModule {
  constructor(
    private authEpics: AuthEpics,
    private ngRedux: NgRedux<IAppState>,
    private devTools: DevToolsExtension
  ) {
    const middleware = [
      createEpicMiddleware(
        combineEpics(
          this.authEpics.login,
          this.authEpics.loginSuccess
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
