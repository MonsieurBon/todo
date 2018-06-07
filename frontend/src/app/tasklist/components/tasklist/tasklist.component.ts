import { Component, Input } from '@angular/core';
import { ITask } from '../../tasklist.model';

@Component({
  selector: 'app-tasklist',
  templateUrl: './tasklist.component.html',
  styleUrls: [ './tasklist.component.css' ]
})
export class TasklistComponent {
  @Input() tasks: ITask[][];
}
