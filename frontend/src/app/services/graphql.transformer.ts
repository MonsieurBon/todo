import { GraphQlTask } from './graphql.definition';
import { ITask } from '../tasklist/tasklist.model';

export class GraphqlTransformer {
  public static mapTask(task: GraphQlTask): ITask {
    const startdate = new Date(task.startdate);
    const duedate = task.duedate ? new Date(task.duedate) : null;
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      startdate,
      duedate,
      state: task.state,
      type: task.type
    };
  }
}
