import { TestBed } from '@angular/core/testing';

import { SocketPlaceholder } from './socket';

describe( 'Socket', () => {
  let service: SocketPlaceholder;

  beforeEach( () => {
    TestBed.configureTestingModule( {} );
    service = TestBed.inject( SocketPlaceholder );
  } );

  it( 'should be created', () => {
    expect( service ).toBeTruthy();
  } );
} );
