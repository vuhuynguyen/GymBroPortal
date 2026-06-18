import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MuscleMapComponent, muscleInvolvement } from './muscle-map';

// When the catalog carries an exercise's specific muscles they drive the map; otherwise the map infers them
// from the exercise name — so a hamstring curl never lights the whole leg (the reported bug).
describe('muscleInvolvement', () => {
  it('Lying Leg Curl → hamstrings, NOT quadriceps', () => {
    const inv = muscleInvolvement('Lying Leg Curl', ['Legs'], []);
    expect(inv['hamstring']).toBe(2);
    expect(inv['quadriceps']).toBe(0);
    expect(inv['gluteal']).toBeGreaterThan(0);
  });

  it('catalog-supplied specific muscles drive the map and beat the name heuristic', () => {
    // Name heuristic would say hamstring; the catalog says quadriceps — data must win.
    const inv = muscleInvolvement('Lying Leg Curl', ['Legs'], [], ['quadriceps'], ['calves']);
    expect(inv['quadriceps']).toBe(2);
    expect(inv['calves']).toBe(1);
    expect(inv['hamstring']).toBe(0);
  });

  it('Leg Extension → quadriceps, NOT hamstrings', () => {
    const inv = muscleInvolvement('Leg Extension', ['Legs'], []);
    expect(inv['quadriceps']).toBe(2);
    expect(inv['hamstring']).toBe(0);
  });

  it('Barbell Bench Press → chest primary, triceps/delts secondary', () => {
    const inv = muscleInvolvement('Barbell Bench Press', ['Chest'], ['Arms']);
    expect(inv['chest']).toBe(2);
    expect(inv['triceps']).toBe(1);
    expect(inv['deltoids']).toBe(1);
  });

  it('unknown leg exercise falls back to the whole leg group', () => {
    const inv = muscleInvolvement('Mystery Leg Machine', ['Legs'], []);
    expect(inv['quadriceps']).toBe(2);
    expect(inv['hamstring']).toBe(2);
  });
});

describe('MuscleMapComponent', () => {
  let fixture: ComponentFixture<MuscleMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MuscleMapComponent] }).compileComponents();
    fixture = TestBed.createComponent(MuscleMapComponent);
  });

  function set(name: string, primary: string, secondary: string[]): HTMLElement {
    fixture.componentRef.setInput('exerciseName', name);
    fixture.componentRef.setInput('primaryMuscle', primary);
    fixture.componentRef.setInput('secondaryMuscles', secondary);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the anatomical SVG with a solid-red primary muscle', () => {
    const svg = set('Barbell Bench Press', 'Chest', []).querySelector('svg.mm-svg');
    expect(svg).toBeTruthy();
    expect(svg!.querySelectorAll('path').length).toBeGreaterThan(20);
    const fills = Array.from(svg!.querySelectorAll('path')).map((p) => p.getAttribute('fill'));
    expect(fills).toContain('#DC2626'); // primary red
    expect(fills).toContain('#D7DCE3'); // a muscle that isn't worked
  });

  it('renders nothing when no muscle is supplied', () => {
    expect(set('', '', []).querySelector('svg')).toBeNull();
  });
});
