import { async, ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';

import { LoginComponent } from './login.component';
import { MockNgRedux, NgReduxTestingModule } from '@angular-redux/store/lib/testing';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { GraphqlActions } from '../../graphql/graphql.actions';
import { Router } from '@angular/router';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { LoadingModalComponent } from '../../layout/loading-modal/loading-modal.component';
import Spy = jasmine.Spy;

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let ngbModalRefSpy: Spy;
  let ngbModalSpy: Spy;
  let graphQlActionsSpy: Spy;
  let routerSpy: Spy;

  let usernameInput: HTMLInputElement;
  let passwordInput: HTMLInputElement;
  let loginButtonDe: DebugElement;
  let loginButtonEl: HTMLElement;

  beforeEach(async(() => {
    const graphQlActionsStub = {
      login: () => {}
    };

    graphQlActionsSpy = spyOn(graphQlActionsStub, 'login');

    const ngbModalRefStub = {
      close: () => {}
    };

    ngbModalRefSpy = spyOn(ngbModalRefStub, 'close');

    const ngbModalStub = {
      open: () => ngbModalRefStub
    };

    ngbModalSpy = spyOn(ngbModalStub, 'open').and.callThrough();

    const routerStub = {
      navigate: () => {}
    };

    routerSpy = spyOn(routerStub, 'navigate');

    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        NgReduxTestingModule,
        NgbModule.forRoot()
      ],
      declarations: [ LoginComponent ],
      providers: [
        {provide: GraphqlActions, useValue: graphQlActionsStub},
        {provide: NgbModal, useValue: ngbModalStub},
        {provide: Router, useValue: routerStub}
      ]
    })
    .compileComponents();

    MockNgRedux.reset();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;

    usernameInput = fixture.debugElement.query(By.css('#username')).nativeElement;
    passwordInput = fixture.debugElement.query(By.css('#password')).nativeElement;
    loginButtonDe = fixture.debugElement.query(By.css('button'));
    loginButtonEl = loginButtonDe.nativeElement;
  });

  it('should have a disabled login button initially', fakeAsync(() => {
    expect(component).toBeTruthy();

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(loginButtonDe.nativeElement.disabled).toBeTruthy();

    const loaderIcon = fixture.debugElement.query(By.css('.loader-icon'));
    expect(loaderIcon).toBeFalsy();
  }));

  it('should have an enabled button after entering credentials', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(loginButtonDe.nativeElement.disabled).toBeTruthy();

    usernameInput.value = 'foo';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'test';
    passwordInput.dispatchEvent(new Event('input'));

    fixture.detectChanges();

    expect(usernameInput.value).toContain('foo');
    expect(passwordInput.value).toContain('test');
    expect(loginButtonDe.nativeElement.disabled).toBeFalsy();
  }));

  it('should open modal on login', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    usernameInput.value = 'foo';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'test';
    passwordInput.dispatchEvent(new Event('input'));

    fixture.detectChanges();

    expect(loginButtonDe.nativeElement.disabled).toBeFalsy();

    loginButtonEl.click();

    tick();
    expect(ngbModalSpy.calls.count()).toBe(1);
    expect(graphQlActionsSpy.calls.count()).toBe(1);
    expect(graphQlActionsSpy.calls.mostRecent().args[0]).toEqual('foo');

    const modalRef = ngbModalSpy.calls.mostRecent().returnValue;
    expect(modalRef).toBeTruthy();
  }));

  it('should close modal and show error upon login failure', fakeAsync(() => {
    const authStub = MockNgRedux.getSelectorStub(['auth']);

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    usernameInput.value = 'foo';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'test';
    passwordInput.dispatchEvent(new Event('input'));

    fixture.detectChanges();

    expect(loginButtonDe.nativeElement.disabled).toBeFalsy();

    loginButtonEl.click();

    tick();
    expect(ngbModalSpy.calls.count()).toBe(1);
    expect(graphQlActionsSpy.calls.count()).toBe(1);
    expect(graphQlActionsSpy.calls.mostRecent().args[0]).toEqual('foo');

    const modalRef = ngbModalSpy.calls.mostRecent().returnValue;
    expect(modalRef).toBeTruthy();

    authStub.next({token: null, error: 'Invalid username or password'});
    expect(ngbModalRefSpy.calls.count()).toBe(1);
  }));

  it('should close modal and navigate upon successful login', fakeAsync(() => {
    const authStub = MockNgRedux.getSelectorStub(['auth']);

    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    usernameInput.value = 'foo';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'test';
    passwordInput.dispatchEvent(new Event('input'));

    fixture.detectChanges();

    expect(loginButtonDe.nativeElement.disabled).toBeFalsy();

    loginButtonEl.click();

    tick();
    expect(ngbModalSpy.calls.count()).toBe(1);
    expect(graphQlActionsSpy.calls.count()).toBe(1);
    expect(graphQlActionsSpy.calls.mostRecent().args[0]).toEqual('foo');

    const modalRef = ngbModalSpy.calls.mostRecent().returnValue;
    expect(modalRef).toBeTruthy();

    authStub.next({token: 'a1b2c3d4', error: null});
    expect(localStorage.getItem('token')).toEqual('a1b2c3d4');
    expect(routerSpy.calls.count()).toEqual(1);
    expect(routerSpy.calls.mostRecent().args[0]).toEqual(['']);
    expect(ngbModalRefSpy.calls.count()).toBe(1);
  }));
});
