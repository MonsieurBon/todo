import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';
import { IsDate, IsInt, IsNotEmpty, validateSync } from 'class-validator';
import { TaskState, TaskType } from '../../tasklist/tasklist.model';

export class EditTaskQueryBuilder implements GraphqlQueryBuilder {
  @IsNotEmpty()
  @IsInt()
  private id: number;

  @IsNotEmpty()
  private title: string;

  private description: string;

  @IsNotEmpty()
  private type: TaskType;

  @IsNotEmpty()
  private state: TaskState;

  @IsNotEmpty()
  @IsDate()
  private startdate: Date;

  @IsDate()
  private duedate: Date;

  private showDone = false;

  private showFuture = false;

  static create() {
    return new EditTaskQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    validateSync(this);

    return {
      query: `mutation($id: Int!,
                       $title: String!,
                       $description: String,
                       $type: TaskTypeEnum!,
                       $state: TaskStateEnum!,
                       $startdate: Date!,
                       $duedate: Date,
                       $showDone: Boolean,
                       $showFuture: Boolean) {
        editTask {
          task(task_id: $id,
               title: $title,
               description: $description,
               type: $type,
               state: $state,
               startdate: $startdate,
               duedate: $duedate) {
            id
            title
            description
            startdate
            duedate
            state
            type
            tasklist {
              id
              name
              slug
              tasks(showDone: $showDone, showFuture: $showFuture) {
                id
                title
                description
                startdate
                duedate
                state
                type
              }
            }
          }
        }
      }`,
      variables: {
        id: this.id,
        title: this.title,
        description: this.description,
        type: this.type,
        state: this.state,
        startdate: this.formatDate(this.startdate),
        duedate: this.formatDate(this.duedate),
        showDone: this.showDone,
        showFuture: this.showFuture
      }
    };
  }

  private formatDate(date: Date) {
    if (date === null || date === undefined) {
      return null;
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year}-${month}-${day}`;
  }

  public setId(id: number) {
    this.id = id;
    return this;
  }

  public setTitle(title: string) {
    this.title = title;
    return this;
  }

  public setDescription(description: string) {
    this.description = description;
    return this;
  }

  public setType(type: TaskType) {
    this.type = type;
    return this;
  }

  public setState(state: TaskState) {
    this.state = state;
    return this;
  }

  public setStartdate(startdate: Date) {
    this.startdate = startdate;
    return this;
  }

  public setDuedate(duedate: Date) {
    this.duedate = duedate;
    return this;
  }

  public setShowDone(showDone: boolean) {
    this.showDone = showDone;
    return this;
  }

  public setShowFuture(showFuture: boolean) {
    this.showFuture = showFuture;
    return this;
  }
}
