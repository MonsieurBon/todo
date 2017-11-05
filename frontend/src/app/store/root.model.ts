import { IAuthState } from '../auth/auth.model';
import { ITasklistState } from '../tasklist/tasklist.model';

export interface IAppState {
  auth: IAuthState;
  tasklists?: ITasklistState[];
  routes?: any;
}
