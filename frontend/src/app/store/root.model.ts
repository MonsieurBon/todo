import { IAuthState } from '../auth/auth.model';

export interface IAppState {
  auth?: IAuthState;
}
