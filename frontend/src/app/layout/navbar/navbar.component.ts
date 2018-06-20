import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { ITasklist } from '../../tasklist/tasklist.model';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NewTaskComponent } from '../new-task/new-task.component';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  @ViewChild('navbarToggler') navbarToggler: ElementRef;
  @Input() title: string;
  @Input() tasklists: ITasklist[] = [];
  isNavbarCollapsed = true;

  constructor(private modalService: NgbModal) {}

  showNewTaskForm() {
    this.isNavbarCollapsed = true;
    const modalRef = this.modalService.open(NewTaskComponent, { size: 'lg' });
  }

  filterPopoverPlacement() {
    if (this.navbarToggler.nativeElement.offsetParent) {
      return 'right';
    } else {
      return 'bottom';
    }
  }
}
