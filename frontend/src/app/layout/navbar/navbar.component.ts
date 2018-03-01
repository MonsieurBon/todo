import { Component, Input, OnInit } from '@angular/core';
import { ITasklist } from '../../tasklist/tasklist.model';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @Input() title: string;
  @Input() tasklists: ITasklist[] = [];
  isNavbarCollapsed = true;
}
