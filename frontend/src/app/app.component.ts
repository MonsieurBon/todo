import { Component, OnInit } from '@angular/core';
import { NgRedux } from '@angular-redux/store';
import { IAppState } from './store/root.model';
import { loginSuccessAction } from './auth/auth.actions';
import { GraphqlService } from './services/graphql.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  constructor(
    private graphql: GraphqlService,
    private ngRedux: NgRedux<IAppState>
  ) {}

  async ngOnInit() {
    const token = localStorage.getItem('token');

    if (token) {
      try {
        const graphQlCheckToken = await this.graphql.checkToken(token);
        this.ngRedux.dispatch(loginSuccessAction(graphQlCheckToken.checkToken.token));
      } catch (e) {
        console.log('Token has expired');
        localStorage.removeItem('token');
      }
    }
  }
}
