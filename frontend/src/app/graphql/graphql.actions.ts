import { Injectable } from '@angular/core';
import { GraphqlService } from './graphql.service';
import { dispatch } from '@angular-redux/store';

@Injectable()
export class GraphqlActions {
  static CHECK_TOKEN = 'CHECK_TOKEN';
  static CHECK_TOKEN_FULFILLED = 'CHECK_TOKEN_FULFILLED';
  static CHECK_TOKEN_REJECTED = 'CHECK_TOKEN_REJECTED';
  static LOGIN = 'LOGIN';
  static LOGIN_PENDING = 'LOGIN_PENDING';
  static LOGIN_FULFILLED = 'LOGIN_FULFILLED';
  static LOGIN_REJECTED = 'LOGIN_REJECTED';
  static LOAD_MAIN_DATA = 'LOAD_MAIN_DATA';
  static LOAD_MAIN_DATA_FULFILLED = 'LOAD_MAIN_DATA_FULFILLED';

  constructor(private service: GraphqlService) { }

  @dispatch()
  loadMainData() {
    return {
      type: GraphqlActions.LOAD_MAIN_DATA,
      payload: this.service.loadAllData()
    };
  }

  @dispatch()
  login(username: string, password: string) {
    return {
      type: GraphqlActions.LOGIN,
      payload: this.service.login(username, password)
    };
  }

  @dispatch()
  checkToken(token: string) {
    return dispatcher => dispatcher({
      type: GraphqlActions.CHECK_TOKEN,
      payload: this.service.checkToken(token),
    }).catch(error => {
      console.log(`Checking token failed: ${error.message}`);
      console.log('Removing token from localStorage');
      localStorage.removeItem('token');
    });
  }
}
