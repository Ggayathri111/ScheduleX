import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { provideRouter, Routes } from '@angular/router';

const routes: Routes = [
  { path: 'public-timetable', loadComponent: () => import('./app/public-timetable.component').then(m => m.PublicTimetableComponent) },
  { path: 'faculty', loadComponent: () => import('./app/faculty-dashboard.component').then(m => m.FacultyDashboardComponent) },
];

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(), provideRouter(routes)]
});