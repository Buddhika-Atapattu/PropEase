import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { guardAuthGuard } from './guard-auth.guard';

describe('guardAuthGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => guardAuthGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
