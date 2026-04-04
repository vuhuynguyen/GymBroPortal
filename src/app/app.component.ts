import { Component } from '@angular/core';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'GymBro Portal';
  sidenavOpened = true;

  navItems: NavItem[] = [
    { label: 'Exercises', icon: 'fitness_center', route: '/exercises' }
  ];

  toggleSidenav(): void {
    this.sidenavOpened = !this.sidenavOpened;
  }
}
