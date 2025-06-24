import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentsAndContractsComponent } from './documents-and-contracts.component';

describe('DocumentsAndContractsComponent', () => {
  let component: DocumentsAndContractsComponent;
  let fixture: ComponentFixture<DocumentsAndContractsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentsAndContractsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentsAndContractsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
