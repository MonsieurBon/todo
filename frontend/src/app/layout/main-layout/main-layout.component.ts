import { Component, OnInit } from '@angular/core';
import { GraphqlActions } from '../../graphql/graphql.actions';

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit{
  constructor(private graphqlActions: GraphqlActions) {}

  ngOnInit(): void {
    this.graphqlActions.loadMainData();
  }
}
