import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { AuthGuard } from './guard-auth.guard';

describe( 'ImageService', () => {
  let service: AuthGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject( AuthGuard );
  });

  it('should be created', () => {
    expect( service ).toBeTruthy();
  });
});

