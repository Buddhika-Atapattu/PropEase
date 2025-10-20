import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditComplaints } from './edit-complaints';

describe('EditComplaints', () => {
  let component: EditComplaints;
  let fixture: ComponentFixture<EditComplaints>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditComplaints]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditComplaints);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
