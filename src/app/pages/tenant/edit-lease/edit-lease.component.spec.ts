import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaseEditComponent } from './edit-lease.component';

describe( 'TenantEditComponent', () => {
  let component: LeaseEditComponent;
  let fixture: ComponentFixture<LeaseEditComponent>;

  beforeEach( async () => {
    await TestBed.configureTestingModule( {
      imports: [ LeaseEditComponent ]
    } )
      .compileComponents();

    fixture = TestBed.createComponent( LeaseEditComponent );
    component = fixture.componentInstance;
    fixture.detectChanges();
  } );

  it( 'should create', () => {
    expect( component ).toBeTruthy();
  } );
} );
