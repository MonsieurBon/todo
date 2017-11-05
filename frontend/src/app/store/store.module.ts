import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DevToolsExtension, NgRedux, NgReduxModule } from '@angular-redux/store';
import { createLogger } from 'redux-logger';
import thunk from 'redux-thunk';
import promise from 'redux-promise-middleware';
import { environment } from '../../environments/environment';
import { rootReducer } from './root.reducer';
import { NgReduxRouter, NgReduxRouterModule } from '@angular-redux/router';
import { IAppState } from './root.model';

@NgModule({
  imports: [
    CommonModule,
    NgReduxModule,
    NgReduxRouterModule
  ],
  declarations: []
})
export class StoreModule {
  constructor(
    public store: NgRedux<IAppState>,
    devTools: DevToolsExtension,
    ngReduxRouter: NgReduxRouter
  ) {
    const middleware = [ promise(), thunk ];
    if (!environment.production) {
      middleware.push(createLogger());
    }

    store.configureStore(
      rootReducer,
      { auth: { token: null, tokenChecked: false, error: null } },
      middleware,
      devTools.isEnabled() ? [ devTools.enhancer() ] : []
    );

    if (ngReduxRouter) {
      ngReduxRouter.initialize();
    }
  }
}
