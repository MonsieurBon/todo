import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { tasklistRouting } from './tasklist.routes';
import { TasklistPageComponent } from './tasklist-page/tasklist-page.component';

@NgModule({
  imports: [
    CommonModule,
    tasklistRouting
  ],
  declarations: [TasklistPageComponent]
})
export class TasklistModule { }
