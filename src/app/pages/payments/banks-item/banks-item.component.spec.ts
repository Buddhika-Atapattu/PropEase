import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BanksItemComponent } from './banks-item.component';

describe('BanksItemComponent', () => {
  let component: BanksItemComponent;
  let fixture: ComponentFixture<BanksItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BanksItemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BanksItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
