import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BanksAccountCreateComponent } from './banks-account-create.component';

describe('BanksAccountCreateComponent', () => {
  let component: BanksAccountCreateComponent;
  let fixture: ComponentFixture<BanksAccountCreateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BanksAccountCreateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BanksAccountCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
