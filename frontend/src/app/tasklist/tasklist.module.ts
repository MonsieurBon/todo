import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TasklistComponent } from './tasklist/tasklist.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { tasklistRouting } from './tasklist.routing';

@NgModule({
  imports: [
    CommonModule,
    NgbModule.forRoot(),
    tasklistRouting
  ],
  declarations: [TasklistComponent]
})
export class TasklistModule { }
