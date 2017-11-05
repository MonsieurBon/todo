import { ITasklist } from './tasklist';

export interface ITasklistState {
  selectedTasklistId?: number;
  tasklists?: ITasklist[];
}
