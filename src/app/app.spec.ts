import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app';
import { AppShellComponent } from './core/layout/app-shell';
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

  it(`should expose app title on the shell`, () => {
    fixture.detectChanges();
    const shell = fixture.debugElement.query(By.directive(AppShellComponent));
    expect(shell).toBeTruthy();
    expect(shell!.componentInstance.appTitle).toEqual('GymBro Portal');
  });

  it('should render the app name in the shell', () => {
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('GymBro Portal');
  });
});
