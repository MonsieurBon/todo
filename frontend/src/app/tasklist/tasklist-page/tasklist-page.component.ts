import { Component, OnInit } from '@angular/core';
import { dispatch } from '@angular-redux/store';
import { Action } from 'redux';

@Component({
  selector: 'app-tasklist-page',
  templateUrl: './tasklist-page.component.html',
  styleUrls: ['./tasklist-page.component.css']
})
export class TasklistPageComponent implements OnInit {

  constructor() { }

  @dispatch()
  ngOnInit(): Action {
    return null;
  }

}
