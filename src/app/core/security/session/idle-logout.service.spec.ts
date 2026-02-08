import { TestBed } from '@angular/core/testing';

import { IdleLogoutServiceTs } from './idle-logout.service.ts';

describe('IdleLogoutServiceTs', () => {
  let service: IdleLogoutServiceTs;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IdleLogoutServiceTs);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
