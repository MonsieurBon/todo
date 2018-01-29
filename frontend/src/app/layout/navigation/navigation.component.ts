import { Component, Input, OnInit } from '@angular/core';
import { ITasklist } from '../../tasklist/tasklist.model';

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css']
})
export class NavigationComponent {

  @Input() tasklists: ITasklist[] = [];

}
