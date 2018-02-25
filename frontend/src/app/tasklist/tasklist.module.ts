import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { tasklistRouting } from './tasklist.routes';
import { TasklistPageComponent } from './components/tasklist-page/tasklist-page.component';
import { TasklistComponent } from './components/tasklist/tasklist.component';
import { TasklistSectionComponent } from './components/tasklist-section/tasklist-section.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { InPastPipe } from './pipes/in-past.pipe';
import { TaskComponent } from './components/task/task.component';
import { TaskDetailComponent } from './components/task-detail/task-detail.component';
import { ReplacePipe } from './pipes/replace.pipe';
import { DefaultPipe } from './pipes/default.pipe';
import { InlineEditComponent } from './components/inline-edit/inline-edit.component';
import { AutofocusDirective } from './directives/autofocus.directive';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgbModule.forRoot(),
    ReactiveFormsModule,
    tasklistRouting
  ],
  declarations: [
    TasklistPageComponent,
    TasklistComponent,
    TasklistSectionComponent,
    TaskComponent,
    InPastPipe,
    TaskDetailComponent,
    ReplacePipe,
    DefaultPipe,
    InlineEditComponent,
    AutofocusDirective
  ],
  entryComponents: [ TaskDetailComponent ]
})
export class TasklistModule {
}
