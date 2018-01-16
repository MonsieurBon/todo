import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DevToolsExtension, NgRedux, NgReduxModule } from '@angular-redux/store';
import { createLogger } from 'redux-logger';
import { IAppState } from './root.model';
import { environment } from '../../environments/environment';
import { rootReducer } from './root';

@NgModule({
  imports: [
    CommonModule,
    NgReduxModule
  ],
  declarations: []
})
export class StoreModule {
  constructor(
    private ngRedux: NgRedux<IAppState>,
    private devTools: DevToolsExtension
  ){
    const middleware = [];

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
