import { Component, OnInit } from '@angular/core';
import { GraphqlActions } from './graphql/graphql.actions';
import { NgRedux } from '@angular-redux/store';
import { IAppState } from './store/root.model';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  private checked = false;
  private subscription;

  constructor(
    private graphqlActions: GraphqlActions,
    private ngRedux: NgRedux<IAppState>
  ) {
    this.subscription = this.ngRedux.select<boolean>(['auth', 'tokenChecked'])
      .subscribe(newTokenChecked => {
        if (newTokenChecked) {
          this.checked = this.checked || newTokenChecked;
        }
      });
  }

  ngOnInit(): void {
    const token = localStorage.getItem('token');

    if (token) {
      this.graphqlActions.checkToken(token);
    } else {
      this.checked = true;
    }
  }

}
