import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaseAgreements } from './lease-agreements';

describe('LeaseAgreements', () => {
  let component: LeaseAgreements;
  let fixture: ComponentFixture<LeaseAgreements>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaseAgreements]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaseAgreements);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
