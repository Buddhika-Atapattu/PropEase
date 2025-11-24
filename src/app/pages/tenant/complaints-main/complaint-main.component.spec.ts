import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComplaintMainomponent } from './complaint-main.component';

describe( 'HomeComponent', () => {
  let component: ComplaintMainomponent;
  let fixture: ComponentFixture<ComplaintMainomponent>;

  beforeEach( async () => {
    await TestBed.configureTestingModule( {
      imports: [ ComplaintMainomponent ]
    } )
      .compileComponents();

    fixture = TestBed.createComponent( ComplaintMainomponent );
    component = fixture.componentInstance;
    fixture.detectChanges();
  } );

  it( 'should create', () => {
    expect( component ).toBeTruthy();
  } );
} );
