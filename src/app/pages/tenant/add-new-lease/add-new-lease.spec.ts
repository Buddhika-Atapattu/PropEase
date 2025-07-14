import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddNewLease } from './add-new-lease';

describe('AddNewLease', () => {
  let component: AddNewLease;
  let fixture: ComponentFixture<AddNewLease>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddNewLease]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddNewLease);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
