import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ComplaintsHome} from './complaints';

describe('Complaints', () => {
  let component: ComplaintsHome;
  let fixture: ComponentFixture<ComplaintsHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComplaintsHome]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ComplaintsHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
