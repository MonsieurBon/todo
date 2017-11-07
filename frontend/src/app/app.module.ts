import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';
import { TaskComponent } from './task/task.component';
import { NgReduxModule } from '@angular-redux/store';
import { StoreModule } from './store/store.module';
import { appRouting } from './app.routes';
import { LayoutModule } from './layout/layout.module';
import { GraphqlActions } from './graphql/graphql.actions';
import { GraphqlService } from './graphql/graphql.service';
import { AuthGuard } from './security/auth-guard.service';
import { GraphqlClientFactory } from './graphql/graphql-client.factory';

@NgModule({
  declarations: [
    AppComponent,
    TaskComponent
  ],
  imports: [
    appRouting,
    BrowserModule,
    FormsModule,
    LayoutModule,
    NgbModule.forRoot(),
    NgReduxModule,
    StoreModule
  ],
  providers: [
    AuthGuard,
    GraphqlActions,
    GraphqlClientFactory,
    GraphqlService
  ],
  bootstrap: [AppComponent],
  entryComponents: [
    TaskComponent
  ]
})
export class AppModule { }
