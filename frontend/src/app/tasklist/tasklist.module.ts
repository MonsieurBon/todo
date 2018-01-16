import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TasklistComponent } from './tasklist/tasklist.component';
import { tasklistRouting } from './tasklist.routes';

@NgModule({
  imports: [
    CommonModule,
    tasklistRouting
  ],
  declarations: [TasklistComponent]
})
export class TasklistModule { }
