import { TestBed, inject } from '@angular/core/testing';

import { AuthGuard } from './auth-guard.service';
import { Router } from '@angular/router';

describe('AuthGuardService', () => {
  beforeEach(() => {
    const routerStub = {
      navigate: () => {}
    };

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        {provide: Router, useValue: routerStub}
      ]
    });
  });

  it('should be created', inject([AuthGuard], (service: AuthGuard) => {
    expect(service).toBeTruthy();
  }));
});
