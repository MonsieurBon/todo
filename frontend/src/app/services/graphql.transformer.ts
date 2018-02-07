import { GraphQlTask } from './graphql.definition';
import { ITask } from '../tasklist/tasklist.model';

export class GraphqlTransformer {
  public static mapTask(task: GraphQlTask): ITask {
    const startdate = new Date(task.startdate);
    const duedate = task.duedate ? new Date(task.duedate) : null;
    return { ...task, startdate, duedate };
  }
}
