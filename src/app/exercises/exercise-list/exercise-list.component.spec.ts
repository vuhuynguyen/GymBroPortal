import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ExerciseListComponent } from './exercise-list.component';
import { primengTestProviders } from '../../../testing/primeng-test-providers';

describe('ExerciseListComponent', () => {
  let fixture: ComponentFixture<ExerciseListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExerciseListComponent],
      providers: [provideRouter([]), ...primengTestProviders]
    }).compileComponents();

    fixture = TestBed.createComponent(ExerciseListComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
