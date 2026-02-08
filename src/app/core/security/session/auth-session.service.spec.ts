import { TestBed } from '@angular/core/testing';

import { AuthSessionServiceTs } from './auth-session.service.ts';

describe('AuthSessionServiceTs', () => {
  let service: AuthSessionServiceTs;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthSessionServiceTs);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
