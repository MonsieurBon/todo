import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DevToolsExtension, NgRedux, NgReduxModule } from '@angular-redux/store';
import { createLogger } from 'redux-logger';
import { IAppState } from './root.model';
import { environment } from '../../environments/environment';
import { rootReducer } from './root.reducer';
import { combineEpics, createEpicMiddleware } from 'redux-observable';
import { AuthEpics } from '../auth/auth.epics';
import { TasklistEpics } from '../tasklist/tasklist.epics';
import { NgReduxRouter, NgReduxRouterModule } from '@angular-redux/router';
import { RouterEpics } from './router.epics';
import { TaskEpics } from '../tasklist/task.epics';

@NgModule({
  imports: [
    CommonModule,
    NgReduxModule,
    NgReduxRouterModule.forRoot()
  ],
  declarations: [],
  providers: [AuthEpics, RouterEpics, TaskEpics, TasklistEpics]
})
export class StoreModule {
  constructor(
    private authEpics: AuthEpics,
    private routerEpics: RouterEpics,
    private taskEpics: TaskEpics,
    private tasklistEpics: TasklistEpics,
    private ngRedux: NgRedux<IAppState>,
    private ngReduxRouter: NgReduxRouter,
    private devTools: DevToolsExtension
  ) {
    const middleware = [
      createEpicMiddleware(
        combineEpics(
          this.authEpics.login,
          this.authEpics.loginSuccess,
          this.routerEpics.gotoTasklist,
          this.taskEpics.switchTaskState,
          this.tasklistEpics.loadAllData,
          this.tasklistEpics.reloadTasklist
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

    this.ngReduxRouter.initialize();
  }
}
