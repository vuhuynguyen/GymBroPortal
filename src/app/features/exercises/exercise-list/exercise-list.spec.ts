import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExerciseListComponent } from './exercise-list';
import { primengTestProviders } from '../../../../testing/primeng-test-providers';

describe('ExerciseListComponent', () => {
  let fixture: ComponentFixture<ExerciseListComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExerciseListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...primengTestProviders
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExerciseListComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne((req) => req.url.includes('/api/exercises')).flush([]);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
    httpMock.verify();
  });
});
