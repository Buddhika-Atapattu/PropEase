// Path: src/app/pages/team-management/assignTask/assign-task.component.ts
// ============================================================================
// AssignTaskComponent (Normalized + Teaching Comments)
// ----------------------------------------------------------------------------
// ✅ CustomTable: Complaints, Members, Tasks
// ✅ Select members by table buttons (Select/Remove)
// ✅ Captain ALWAYS selected (cannot be removed)
// ✅ Max 5 assignees total (including captain)
// ✅ Template-driven form (ngForm)
// ✅ ALL date inputs use Material Datepicker (touchUi ok) => bind Date | null
// ✅ KPI range uses Date objects (Material Datepicker) + in-memory filtering
//
// IMPORTANT NOTE (Google Charts 3D):
// - Google PieChart supports either:
//     A) Donut mode: pieHole (2D only)
//     B) 3D mode: is3D (NO pieHole)
// - You asked for “3D charts”, so KPI status/priority are implemented as 3D Pie
//   (not donut). If you want donut back, set is3D:false and restore pieHole.
// ============================================================================

import {
  ChangeDetectionStrategy,
  Component
} from '@angular/core';
import { RouterModule } from '@angular/router';

@Component( {
  selector: 'app-assign-task',
  standalone: true,
  imports: [
    RouterModule,
  ],
  templateUrl: './assign-task.component.html',
  styleUrls: [ './assign-task.component.scss' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class AssignTaskComponent {}
