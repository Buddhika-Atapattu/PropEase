import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditPropertyListingComponent } from './edit-property-listing.component';

describe('EditPropertyListingComponent', () => {
  let component: EditPropertyListingComponent;
  let fixture: ComponentFixture<EditPropertyListingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditPropertyListingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditPropertyListingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
