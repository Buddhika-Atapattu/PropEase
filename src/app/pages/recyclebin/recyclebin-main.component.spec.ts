import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecyclebinMainComponent } from './recyclebin-main.component';

describe('RecyclebinMainComponent', () => {
  let component: RecyclebinMainComponent;
  let fixture: ComponentFixture<RecyclebinMainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecyclebinMainComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecyclebinMainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
