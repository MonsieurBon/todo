import { TestBed, async } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { RouterOutletMockComponent } from '../testing/mocks/router-outlet.mock';

describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        AppComponent, RouterOutletMockComponent
      ],
    }).compileComponents();
  }));
  it('should create the app', async(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  }));
});
