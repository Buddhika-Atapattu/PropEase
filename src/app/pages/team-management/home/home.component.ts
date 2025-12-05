import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

// Matirial UI
import { MatTooltipModule } from '@angular/material/tooltip';

@Component( {
  selector: 'app-team-management-home',
  standalone: true,
  imports: [
    CommonModule,

    // Matirial UI Components
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
} )
export class HomeComponent {

 constructor(
  private readonly router: Router,
 ){

 }

 protected async createTeamRouter(): Promise<boolean>{
  return await this.router.navigate(['/dashboard/team-management/create']);
 }
}
