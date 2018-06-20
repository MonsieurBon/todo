import { IAuthState } from '../auth/auth.model';
import { ITasklistState } from '../tasklist/tasklist.model';
import { IFilterState } from '../filter/filter.model';

export interface IAppState {
  auth?: IAuthState;
  tasklist?: ITasklistState;
  filter?: IFilterState;
  route?: string;
}
