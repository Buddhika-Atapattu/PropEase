import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BanksListComponent } from './banks-list.component';

describe('BanksListComponent', () => {
  let component: BanksListComponent;
  let fixture: ComponentFixture<BanksListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BanksListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BanksListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
