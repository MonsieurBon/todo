import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { LayoutModule } from './layout/layout.module';
import { NgReduxModule } from '@angular-redux/store';
import { StoreModule } from './store/store.module';
import { AuthGuard } from './auth/auth-guard.service';
import { appRouting } from './app.routes';
import { GraphqlService } from './services/graphql.service';
import { GraphqlClientFactory } from './services/graphql-client.factory';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    appRouting,
    BrowserModule,
    BrowserAnimationsModule,
    LayoutModule,
    NgbModule.forRoot(),
    NgReduxModule,
    StoreModule
  ],
  providers: [
    AuthGuard,
    GraphqlClientFactory,
    GraphqlService
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
