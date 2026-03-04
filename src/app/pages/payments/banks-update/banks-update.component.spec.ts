import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BanksUpdateComponent } from './banks-update.component';

describe('BanksUpdateComponent', () => {
  let component: BanksUpdateComponent;
  let fixture: ComponentFixture<BanksUpdateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BanksUpdateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BanksUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
