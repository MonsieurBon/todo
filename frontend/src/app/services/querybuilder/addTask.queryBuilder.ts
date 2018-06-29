import { GraphqlQueryBuilder, GraphqlRequest } from './graphql.queryBuilder';
import { IsDate, IsInt, IsNotEmpty, validateSync } from 'class-validator';
import { TaskState, TaskType } from '../../tasklist/tasklist.model';

export class AddTaskQueryBuilder implements GraphqlQueryBuilder {
  @IsNotEmpty()
  @IsInt()
  private tasklist_id: number;

  @IsNotEmpty()
  private title: string;

  private description: string;

  @IsNotEmpty()
  private type: TaskType;

  @IsNotEmpty()
  @IsDate()
  private startdate: Date;

  @IsDate()
  private duedate: Date;

  private showDone = false;

  private showFuture = false;

  static create() {
    return new AddTaskQueryBuilder();
  }

  private constructor() {}

  getRequest(): GraphqlRequest {
    validateSync(this);

    return {
      query: `mutation($tasklist_id: Int!,
                       $title: String!,
                       $description: String,
                       $type: TaskTypeEnum!,
                       $startdate: Date!,
                       $duedate: Date,
                       $showDone: Boolean,
                       $showFuture: Boolean) {
        addTask(tasklist_id: $tasklist_id) {
          task(title: $title,
               description: $description,
               type: $type,
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
        tasklist_id: this.tasklist_id,
        title: this.title,
        description: this.description,
        type: this.type,
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

  public setTasklistId(tasklist_id: number) {
    this.tasklist_id = tasklist_id;
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
