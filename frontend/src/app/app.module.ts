import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { LayoutModule } from './layout/layout.module';
import { NgReduxModule } from '@angular-redux/store';
import { StoreModule } from './store/store.module';
import { AuthGuard } from './auth/auth-guard.service';
import { appRouting } from './app.routes';


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    appRouting,
    BrowserModule,
    LayoutModule,
    NgReduxModule,
    StoreModule
  ],
  providers: [
    AuthGuard
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
