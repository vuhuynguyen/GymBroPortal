import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app';
import { primengTestProviders } from '../testing/primeng-test-providers';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), ...primengTestProviders]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AppComponent);
  });

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  // AppComponent is a thin host: routed views (including the app shell) render
  // through this outlet, and the global toast is mounted alongside it.
  it('should render the router outlet for routed views', () => {
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('router-outlet')
    ).toBeTruthy();
  });

  it('should mount the global toast', () => {
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('p-toast')
    ).toBeTruthy();
  });
});
