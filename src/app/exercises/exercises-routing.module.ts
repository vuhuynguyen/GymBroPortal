import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ExerciseListComponent } from './exercise-list/exercise-list.component';
import { ExerciseFormComponent } from './exercise-form/exercise-form.component';

const routes: Routes = [
  { path: '', component: ExerciseListComponent },
  { path: 'create', component: ExerciseFormComponent },
  { path: 'edit/:id', component: ExerciseFormComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ExercisesRoutingModule { }
