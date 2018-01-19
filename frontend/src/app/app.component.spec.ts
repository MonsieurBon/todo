import { TestBed, async } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { RouterOutletMockComponent } from '../testing/mocks/router-outlet.mock';
import { GraphqlService } from './services/graphql.service';
import { GraphQlCheckToken } from './services/graphql.definition';

describe('AppComponent', () => {
  beforeEach(async(() => {
    const service = {
      checkToken: (token: string): Promise<GraphQlCheckToken> => {
        return Promise.resolve({checkToken: {
          token: '123'
          }});
      }
    };

    TestBed.configureTestingModule({
      declarations: [
        AppComponent, RouterOutletMockComponent
      ],
      providers: [
        {provide: GraphqlService, useValue: service}
      ]
    }).compileComponents();
  }));
  it('should create the app', async(() => {
    // const fixture = TestBed.createComponent(AppComponent);
    // const app = fixture.debugElement.componentInstance;
    // expect(app).toBeTruthy();
  }));
});
