import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CloseBtn } from './close-btn';

describe('CloseBtn', () => {
  let component: CloseBtn;
  let fixture: ComponentFixture<CloseBtn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CloseBtn]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CloseBtn);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
