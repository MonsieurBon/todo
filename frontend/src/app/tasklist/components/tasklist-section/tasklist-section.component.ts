import { Component, Input, OnInit } from '@angular/core';
import { ITask } from '../../tasklist.model';

@Component({
  selector: 'app-tasklist-section',
  templateUrl: './tasklist-section.component.html',
  styleUrls: ['./tasklist-section.component.css']
})
export class TasklistSectionComponent {
  @Input() tasks: ITask[] = [];
}
