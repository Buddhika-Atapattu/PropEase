// Path: src/app/pages/team-management/assignTask/taskView/task-view.component.ts

import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import {
  GoogleChartsModule,
  ChartType,
  type Column,
  type Row,
} from 'angular-google-charts';

import { Subject, timer, combineLatest } from 'rxjs';
import { exhaustMap, takeUntil } from 'rxjs/operators';

import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  type TeamManagementDto,
  type TeamMemberDto,
  type AssignedTaskDto,
  DEFAULT_TASK_STATUS,
  type TaskCommentDto,
} from '../../../../services/teamManagementService/team-management.types';

import { TeamManagementService } from '../../../../services/teamManagementService/team-management.service';
import { APIsService, User } from '../../../../services/APIs/apis.service';
import { AuthService } from '../../../../services/auth/auth.service';

import {
  StageIndicatorComponent,
  type StagePoint,
} from '../../../../components/shared/stageIndicator/stage-indicator.component';

import {
  CustomTableComponent,
  type TableButton,
  type TableButtonActionConfig,
  type TableColumn,
} from '../../../../components/shared/custom-table/custom-table.component';

import { CommentsListComponent } from '../../../../components/shared/comments/comments-list.component';
import { TextEditorComponent } from '../../../../components/shared/textEditor/text-editor';
import { Dropdown } from '../../../../components/shared/dropdown/dropdown';
import { NotificationDialogComponent } from '../../../../components/dialogs/notificationBar/notificationBar.component';
import { ProgressBarComponent } from '../../../../components/dialogs/progress-bar/progress-bar.component';

import { TeamTaskCommentService } from '../../../../services/teamManagementService/team-task-comment.service';
import { HttpErrorResponse } from '@angular/common/http';
import { PaginationUtil } from '../../../../source/utility/pagination.utils';
import type { MSG } from '../../../../types/api-message.types';

// ─────────────────────────────────────────────────────────────────────────────
// Local view-only types
// ─────────────────────────────────────────────────────────────────────────────
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
type TaskStatus =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed_pending_confirmation'
  | 'completed'
  | 'cancelled';

type ChartBuild = Readonly<{
  type: ChartType;
  columns: Column[];
  data: Row[];
  options: Record<string, unknown>;
}>;

type MemberRow = Readonly<{
  image: string | null;
  id: string;
  name: string;
  username: string;
  roleInTeam: string;
  role: string;
  email: string;
  viewButton: TableButton;
}>;

@Component({
  selector: 'app-task-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,

    GoogleChartsModule,
    StageIndicatorComponent,
    CustomTableComponent,

    CommentsListComponent,
    NotificationDialogComponent,
    ProgressBarComponent,
  ],
  templateUrl: './task-view.component.html',
  styleUrl: './task-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskViewComponent implements OnInit, OnDestroy {
  // =========================================================================
  // ViewChild dialogs (UI feedback)
  // =========================================================================
  @ViewChild( NotificationDialogComponent, { static: true } )
  public notificationDialog!: NotificationDialogComponent;

  @ViewChild( ProgressBarComponent, { static: true } )
  public progressbarDialog!: ProgressBarComponent;
  // =========================================================================
  // 1) PLATFORM + LIFECYCLE CONTROL
  // =========================================================================
  private readonly isBrowser: boolean;
  private readonly destroy$ = new Subject<void>();

  // =========================================================================
  // 2) ROUTE PARAMS
  // =========================================================================
  protected teamId: string | null = null;
  protected taskId: string | null = null;

  // =========================================================================
  // 3) DATA STATE
  // =========================================================================
  protected isLoading = false;
  protected errorMsg: string | null = null;

  protected team: TeamManagementDto | null = null;
  protected members: TeamMemberDto[] = [];
  protected tasks: AssignedTaskDto[] = [];
  protected task: AssignedTaskDto | null = null;


  // =========================================================================
  // 5) REALTIME POLLING (NO OVERLAP)
  // =========================================================================
  protected readonly pollSeconds = 10;
  private pollActive = false;
  private routeSeq = 0;

  // =========================================================================
  // 6) STATUS PIPELINE (Stage Indicator)
  // =========================================================================
  protected readonly defaultTaskStatus = DEFAULT_TASK_STATUS;

  public get STATUS_STAGE(): StagePoint[] {
    return this.defaultTaskStatus.map((status, index) => {
      return {
        key: status,
        label: this.statusToLabel(status),
        value: (index * 100) / (this.defaultTaskStatus.length - 1),
      } satisfies StagePoint;
    });
  }

  public get STATUS_CURRENT_VALUE(): number {
    if (!this.task) return 0;

    const currentStatus = this.task.status as AssignedTaskDto['status'] | undefined;
    const index = currentStatus ? this.defaultTaskStatus.indexOf(currentStatus) : -1;

    if (index < 0) return 0;

    const lastIndex = this.defaultTaskStatus.length - 1;
    return (index * 100) / lastIndex;
  }

  // =========================================================================
  // 7) ASSIGNED MEMBERS TABLE
  // =========================================================================
  protected assignedMemberColumns: TableColumn[] = [
    { key: 'image', label: 'Avatar' },
    { key: 'name', label: 'Name' },
    { key: 'username', label: 'Username' },
    { key: 'roleInTeam', label: 'Role in Team' },
    { key: 'role', label: 'Role' },
    { key: 'email', label: 'Email' },
    { key: 'viewButton', label: 'View' },
  ];

  protected assignedMemberRows: MemberRow[] = [];

  protected memberPageIndex = 0;
  protected memberPageSize = 10;

  public get memberTotal(): number {
    return this.assignedMemberRows.length;
  }

  public get memberStart(): number {
    return this.memberTotal === 0 ? 0 : this.memberPageIndex * this.memberPageSize;
  }

  public get memberEnd(): number {
    return Math.min(this.memberTotal, this.memberStart + this.memberPageSize);
  }

  public get assignedMemberRowsPaged(): MemberRow[] {
    return this.assignedMemberRows.slice(this.memberStart, this.memberEnd);
  }

  // =========================================================================
  // 8) KPI CHARTS
  // =========================================================================
  protected kpiProgressGauge: ChartBuild | null = null;
  protected kpiStatusPie: ChartBuild | null = null;
  protected kpiPriorityPie: ChartBuild | null = null;

  // =========================================================================
  // CONSTRUCTOR
  // =========================================================================
  public constructor(
    private readonly teamService: TeamManagementService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object,
    private readonly apiService: APIsService,
    private readonly authService: AuthService,
    private readonly taskCommentService: TeamTaskCommentService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================
  public ngOnInit(): void {
    const parent = this.route.parent;

    if (!parent) {
      this.errorMsg = 'Parent route missing. Cannot resolve teamId.';
      this.cdr.markForCheck();
      return;
    }

    combineLatest([parent.paramMap, this.route.paramMap])
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => void this.onRouteChanged());
  }

  public ngOnDestroy(): void {
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // =========================================================================
  // ROUTE CHANGED
  // =========================================================================
  private async onRouteChanged(): Promise<void> {
    const seq = ++this.routeSeq;

    try {
      this.errorMsg = null;
      this.isLoading = true;
      this.cdr.markForCheck();

      const teamId = String(this.route.parent?.snapshot.paramMap.get('teamId') ?? '').trim();
      const taskId = String(this.route.snapshot.paramMap.get('taskId') ?? '').trim();

      if (!teamId) throw new Error('Team ID is missing in route param.');
      if (!taskId) throw new Error('Task ID is missing in route param.');

      this.teamId = teamId;
      this.taskId = taskId;

      // 01) Load team
      const teamRes = await this.teamService.getTeamById(teamId);
      if (!teamRes?.success) throw new Error(teamRes?.message ?? 'Failed to load team.');

      const team = this.extractTeamFromResponse(teamRes);
      if (!team) throw new Error('Team payload not found in response.');
      if (seq !== this.routeSeq) return;

      this.team = team;
      this.members = Array.isArray((team as any)?.members) ? (team as any).members : [];

      // 02) Load tasks
      const taskRes = await this.teamService.getAllTasksForTeam(teamId);
      if (!taskRes?.success) throw new Error(taskRes?.message ?? 'Failed to load team tasks.');
      if (seq !== this.routeSeq) return;

      this.tasks = this.extractTasksFromResponse(taskRes);

      const task = this.findTaskById(this.tasks, taskId);
      if (!task) throw new Error('Task not found in this team.');

      this.task = task;

      this.memberPageIndex = 0;

      await this.memberTableInit();
      this.rebuildChartsAndKpis();

      this.startPolling();
    } catch (error) {
      console.error('[Error:] [TaskView] Route init failed.\n', error);

      this.stopPolling();

      this.team = null;
      this.members = [];
      this.tasks = [];
      this.task = null;

      this.assignedMemberRows = [];
      this.kpiProgressGauge = null;
      this.kpiStatusPie = null;
      this.kpiPriorityPie = null;

      this.errorMsg = error instanceof Error ? error.message : 'Unexpected error occurred!';
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  // =========================================================================
  // POLLING
  // =========================================================================
  private startPolling(): void {
    this.stopPolling();

    if (!this.isBrowser) return;
    if (!this.teamId) return;
    if (!this.taskId) return;

    this.pollActive = true;

    timer(this.pollSeconds * 1000, this.pollSeconds * 1000)
      .pipe(
        takeUntil(this.destroy$),
        exhaustMap(async () => {
          if (!this.pollActive) return null;
          if (!this.teamId) return null;

          try {
            const res = await this.teamService.getAllTasksForTeam(this.teamId);
            if (!res?.success) return null;
            return this.extractTasksFromResponse(res);
          } catch {
            return null;
          }
        })
      )
      .subscribe((newTasks) => {
        if (!newTasks) return;
        if (!this.taskId) return;

        this.tasks = newTasks;

        const t = this.findTaskById(this.tasks, this.taskId);
        if (t) {
          this.task = t;

          void this.memberTableInit();
          this.rebuildChartsAndKpis();
          this.cdr.markForCheck();
        }
      });
  }

  private stopPolling(): void {
    this.pollActive = false;
  }

  // =========================================================================
  // MEMBERS: Build table rows
  // =========================================================================
  protected async memberTableInit(): Promise<void> {
    try {
      if (!this.team || !this.taskId) {
        this.assignedMemberRows = [];
        this.cdr.markForCheck();
        return;
      }

      const taskData = this.findTaskById(this.tasks, this.taskId);
      if (!taskData) {
        this.assignedMemberRows = [];
        this.cdr.markForCheck();
        return;
      }

      const taskTeamMembers = taskData.assignedMembers;
      if (!Array.isArray(taskTeamMembers) || taskTeamMembers.length === 0) {
        this.assignedMemberRows = [];
        this.cdr.markForCheck();
        return;
      }

      const lookups = taskTeamMembers.map(async (memberId): Promise<User | null> => {
        try {
          const id = String(memberId ?? '').trim();
          if (!id) return null;

          const userData = await this.apiService.getUserById(id);
          if (!userData?.success) return null;

          const user = userData.data?.system?.user ?? null;
          return user && typeof user === 'object' ? user : null;
        } catch {
          return null;
        }
      });

      const resolved = await Promise.all(lookups);

      const rows: MemberRow[] = [];
      for (const member of resolved) {
        const row = this.rebuildAssignedMemberRows(member);
        if (row) rows.push(row);
      }

      this.assignedMemberRows = rows;
      this.cdr.markForCheck();
    } catch (error) {
      console.error('[Error:] [TaskView] memberTableInit failed.\n', error);
      this.assignedMemberRows = [];
      this.cdr.markForCheck();
    }
  }

  private rebuildAssignedMemberRows(member: User | null): MemberRow | null {
    if (!member) return null;

    const roleInTeam =
      this.team?.members?.find(m => m.username === member.username)?.roleInTeam || 'Member';

    return {
      image: (member.image as string | null) ?? null,
      id: member.username || '',
      name: member.name,
      username: member.username || '',
      email: member.email,
      role: member.role || 'User',
      roleInTeam,
      viewButton: { label: 'View', icon: 'visibility', action: 'view' },
    };
  }

  // =========================================================================
  // TABLE ACTIONS
  // =========================================================================
  protected async onMemberTableButtonClick(value: TableButtonActionConfig): Promise<void> {
    try {
      if (!value?.action || !value?.data) {
        throw new Error('Invalid button action config received.');
      }

      const username = String((value.data as any).username ?? '').trim();
      if (!username) throw new Error('Username is missing in button action data.');

      const tokenRes = await this.apiService.generateToken(username);
      if (!tokenRes?.success) throw new Error(tokenRes?.message ?? 'Failed to generate token for user.');

      const token = this.apiService.extractStringFromOther(tokenRes.data, 'token');
      if (!token) throw new Error('Token not found in response data.');

      void this.router.navigate(['/dashboard', 'team-management', 'member', token]);
    } catch (error) {
      console.error('[Error:] [TaskView] onMemberTableButtonClick failed.\n', error);
    }
  }

  // =========================================================================
  // KPIs + CHARTS
  // =========================================================================
  private rebuildChartsAndKpis(): void {
    this.kpiProgressGauge = this.buildGauge('Progress', this.STATUS_CURRENT_VALUE);

    const statusMap = this.countBy(this.tasks, (t) => this.norm((t as any)?.status) || 'unknown');
    const priorityMap = this.countBy(this.tasks, (t) => this.norm((t as any)?.priority) || 'unknown');

    this.kpiStatusPie = this.buildPie('Team Task Status', statusMap, 260);
    this.kpiPriorityPie = this.buildPie('Team Task Priority', priorityMap, 260);
  }

  private buildGauge(title: string, value: number): ChartBuild {
    return {
      type: ChartType.Gauge,
      columns: ['Label', 'Value'] as unknown as Column[],
      data: [[title, this.clamp(0, 100, value)]] as unknown as Row[],
      options: {
        height: 220,
        min: 0,
        max: 100,
        minorTicks: 5,
        majorTicks: ['0', '25', '50', '75', '100'],
        animation: { duration: 400, easing: 'out' },
      },
    };
  }

  private buildPie(title: string, map: Record<string, number>, height: number): ChartBuild {
    const rows = Object.entries(map)
      .map(([k, v]) => [this.toTitle(k), Number(v ?? 0)] as unknown as Row)
      .filter((r: any) => Number(r?.[1] ?? 0) > 0);

    return {
      type: ChartType.PieChart,
      columns: ['Label', 'Count'] as unknown as Column[],
      data: rows,
      options: {
        title,
        height,
        is3D: true,
        legend: { position: 'right' },
        backgroundColor: 'transparent',
        chartArea: { left: 16, top: 24, right: 16, bottom: 16, width: '88%', height: '78%' },
        tooltip: { isHtml: true, trigger: 'focus', showColorCode: true },
        pieSliceText: 'percentage',
      },
    };
  }

  // =========================================================================
  // DERIVED GETTERS
  // =========================================================================
  public get statusPillClass(): string {
    const s = this.norm((this.task as any)?.status);
    if (s === 'completed') return 'pill pill--good';
    if (s === 'completed_pending_confirmation') return 'pill pill--warn';
    if (s === 'cancelled') return 'pill pill--muted';
    if (s === 'blocked') return 'pill pill--danger';
    if (s === 'in_progress') return 'pill pill--info';
    if (s === 'pending') return 'pill pill--warn';
    return 'pill pill--neutral';
  }

  public get priorityPillClass(): string {
    const p = this.norm((this.task as any)?.priority);
    if (p === 'critical') return 'pill pill--danger';
    if (p === 'high') return 'pill pill--warn';
    if (p === 'medium') return 'pill pill--info';
    return 'pill pill--muted';
  }

  public get assignedCount(): number {
    return this.getAssignedMemberIds().length;
  }

  public get importanceScore(): number {
    const pri = this.norm((this.task as any)?.priority) as TaskPriority;
    const status = this.norm((this.task as any)?.status) as TaskStatus;

    let score = 0;

    if (pri === 'critical') score += 60;
    else if (pri === 'high') score += 45;
    else if (pri === 'medium') score += 30;
    else score += 15;

    if (status === 'blocked') score += 20;

    const due = this.parseDate((this.task as any)?.plannedEndAt);
    if (due) {
      const hours = (due.getTime() - Date.now()) / 36e5;
      if (hours < 0) score += 25;
      else if (hours <= 24) score += 15;
      else if (hours <= 72) score += 8;
    }

    return this.clamp(0, 100, score);
  }

  public get importanceLabel(): string {
    const s = this.importanceScore;
    if (s >= 85) return 'Critical attention required';
    if (s >= 70) return 'High importance';
    if (s >= 40) return 'Moderate importance';
    return 'Low importance';
  }

  public get dueHealthText(): string {
    const due = this.parseDate((this.task as any)?.plannedEndAt);
    if (!due) return 'No planned end date';

    const hours = Math.round((due.getTime() - Date.now()) / 36e5);

    if (hours < 0) return `Overdue by ${Math.abs(hours)}h`;
    if (hours <= 24) return `Due within ${hours}h`;
    return `Due in ${Math.round(hours / 24)}d`;
  }

  // =========================================================================
  // LABELS
  // =========================================================================
  private statusToLabel(status: AssignedTaskDto['status']): string {
    switch (status) {
      case 'blocked': return 'Blocked';
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'completed_pending_confirmation': return 'Pending Confirmation';
      case 'draft': return 'Draft';
      case 'pending': return 'Pending';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  }

  // =========================================================================
  // RESPONSE EXTRACTORS
  // =========================================================================
  private extractTeamFromResponse(res: any): TeamManagementDto | null {
    const t1 = res?.data?.system?.team;
    const t2 = res?.data?.team;
    const t3 = res?.data?.system?.team?.team;
    const t4 = res?.data?.data?.team;

    const team = (t1 ?? t2 ?? t3 ?? t4 ?? null) as TeamManagementDto | null;
    return team && typeof team === 'object' ? team : null;
  }

  private extractTasksFromResponse(res: any): AssignedTaskDto[] {
    const d = res?.data;

    const a1 = d?.tasks;
    const a2 = d?.other?.tasks;
    const a3 = d?.system?.tasks;
    const a4 = d?.data?.tasks;

    const arr = (a1 ?? a2 ?? a3 ?? a4 ?? []) as unknown;
    if (!Array.isArray(arr)) return [];

    return (arr as unknown[]).flat().filter(Boolean) as AssignedTaskDto[];
  }

  private findTaskById(tasks: AssignedTaskDto[], taskId: string): AssignedTaskDto | null {
    const key = String(taskId ?? '').trim();
    if (!key) return null;

    for (const t of tasks) {
      const anyT: any = t as any;

      const idA = String(anyT?.id ?? '').trim();
      const idB = String(anyT?._id ?? '').trim();
      const code = String(anyT?.code ?? '').trim();

      if (idA === key || idB === key || code === key) return t;
    }

    return null;
  }

  private getAssignedMemberIds(): string[] {
    const anyT: any = this.task as any;
    const raw: unknown = anyT?.assignedMembers;
    if (!Array.isArray(raw)) return [];

    return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================
  public formatDateTime(raw: unknown): string {
    const d = this.parseDate(raw);
    if (!d) return '—';

    try {
      return new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return String(raw ?? '—');
    }
  }

  private parseDate(raw: unknown): Date | null {
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

    if (typeof raw === 'string') {
      const t = raw.trim();
      if (!t) return null;

      const ms = Date.parse(t);
      return Number.isNaN(ms) ? null : new Date(ms);
    }

    return null;
  }

  private norm(v: unknown): string {
    return String(v ?? '').trim().toLowerCase();
  }

  private toTitle(v: string): string {
    const t = String(v ?? '').trim();
    if (!t) return 'Unknown';
    return t.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  private clamp(min: number, max: number, v: number): number {
    const n = Number(v);
    if (Number.isNaN(n)) return min;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  private countBy<T>(items: T[], keyFn: (x: T) => string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const it of items) {
      const k = keyFn(it) || 'unknown';
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }
}
