import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaintenanceOrComplaintStatusComponent } from './maintenance-or-complaint-status.component';

describe('MaintenanceOrComplaintStatusComponent', () => {
  let component: MaintenanceOrComplaintStatusComponent;
  let fixture: ComponentFixture<MaintenanceOrComplaintStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaintenanceOrComplaintStatusComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaintenanceOrComplaintStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
