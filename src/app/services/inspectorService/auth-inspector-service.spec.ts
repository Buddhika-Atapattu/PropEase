import { TestBed } from '@angular/core/testing';

import { AuthInspectorService } from './auth-inspector-service';

describe('AuthInspectorService', () => {
  let service: AuthInspectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthInspectorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
