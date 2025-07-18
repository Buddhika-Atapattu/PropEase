import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewLeaseAgreement } from './view-lease-agreement';

describe('ViewLeaseAgreement', () => {
  let component: ViewLeaseAgreement;
  let fixture: ComponentFixture<ViewLeaseAgreement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewLeaseAgreement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewLeaseAgreement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
