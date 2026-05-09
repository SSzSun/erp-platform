import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './core/guards/auth.guard';
import { LayoutComponent } from './shared/layout/layout.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [publicGuard],
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'employees', pathMatch: 'full' },
      {
        path: 'employees',
        loadComponent: () => import('./features/employees/employee-list/employee-list.component')
          .then(m => m.EmployeeListComponent),
      },
      {
        path: 'payroll',
        loadComponent: () => import('./features/payroll/payroll-dashboard/payroll-dashboard.component')
          .then(m => m.PayrollDashboardComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
