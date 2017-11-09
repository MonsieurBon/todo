import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NavigationComponent } from './navigation.component';
import { MockNgRedux, NgReduxTestingModule } from '@angular-redux/store/lib/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

describe('NavigationComponent', () => {
  let component: NavigationComponent;
  let fixture: ComponentFixture<NavigationComponent>;
  let tasklistMenuDe: DebugElement;
  let tasklistMenuEl: HTMLElement;
  let accountMenuDe: DebugElement;
  let accountMenuEl: HTMLElement;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [ NgReduxTestingModule ],
      declarations: [ NavigationComponent ]
    })
    .compileComponents();

    MockNgRedux.reset();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NavigationComponent);
    component = fixture.componentInstance;

    tasklistMenuDe = fixture.debugElement.query(By.css('#tasklists-menu-list'));
    tasklistMenuEl = tasklistMenuDe.nativeElement;
    accountMenuDe = fixture.debugElement.query(By.css('#account-menu-list'));
    accountMenuEl = accountMenuDe.nativeElement;
  });

  it('should initially have an empty tasklists list', () => {
    expect(component).toBeTruthy();
    fixture.detectChanges();
    expect(tasklistMenuEl.children.length).toEqual(0);
    expect(accountMenuEl.children.length).toEqual(2);
    expect(accountMenuEl.children[0].innerHTML).toContain('Account');
    expect(accountMenuEl.children[1].innerHTML).toContain('Logout');
  });

  it('should have a non empty list after loading', () => {
    const tasklistStub = MockNgRedux.getSelectorStub(['tasklists', 'tasklists']);
    tasklistStub.next([{name: 'Tasklist 1'}]);

    fixture.detectChanges();

    expect(tasklistMenuEl.children.length).toEqual(1);
    expect(tasklistMenuEl.children[0].innerHTML).toContain('Tasklist 1');
  });

  it('should keep updating the list', () => {
    const tasklistStub = MockNgRedux.getSelectorStub(['tasklists', 'tasklists']);
    tasklistStub.next([{name: 'Tasklist 1'}]);

    fixture.detectChanges();

    expect(tasklistMenuEl.children.length).toEqual(1);
    expect(tasklistMenuEl.children[0].innerHTML).toContain('Tasklist 1');

    tasklistStub.next([{name: 'Tasklist 1'}, {name: 'Tasklist 2'}]);

    fixture.detectChanges();

    expect(tasklistMenuEl.children.length).toEqual(2);
    expect(tasklistMenuEl.children[0].innerHTML).toContain('Tasklist 1');
    expect(tasklistMenuEl.children[1].innerHTML).toContain('Tasklist 2');
  });
});
