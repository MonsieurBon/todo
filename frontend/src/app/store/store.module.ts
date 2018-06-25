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
import { FilterEpics } from '../filter/filter.epics';

@NgModule({
  imports: [
    CommonModule,
    NgReduxModule,
    NgReduxRouterModule.forRoot()
  ],
  declarations: [],
  providers: [AuthEpics, FilterEpics, RouterEpics, TaskEpics, TasklistEpics]
})
export class StoreModule {
  constructor(
    private authEpics: AuthEpics,
    private filterEpics: FilterEpics,
    private routerEpics: RouterEpics,
    private taskEpics: TaskEpics,
    private tasklistEpics: TasklistEpics,
    private ngRedux: NgRedux<IAppState>,
    private ngReduxRouter: NgReduxRouter,
    private devTools: DevToolsExtension
  ) {
    const rootEpic = combineEpics(
      this.authEpics.login,
      this.authEpics.loginSuccess,
      this.authEpics.logout,
      this.authEpics.logoutSuccess,
      this.filterEpics.updateData,
      this.routerEpics.gotoTasklist,
      this.taskEpics.editTask,
      this.taskEpics.addTask,
      this.taskEpics.moveTask,
      this.tasklistEpics.createTasklist,
      this.tasklistEpics.navigateToCreatedTasklist,
      this.tasklistEpics.loadAllData,
      this.tasklistEpics.reloadTasklist,
      this.tasklistEpics.reloadTasklistDataReceived
    );

    const epicMiddleware = createEpicMiddleware();

    const middleware = [
      epicMiddleware
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

    epicMiddleware.run(rootEpic);

    this.ngReduxRouter.initialize();
  }
}
