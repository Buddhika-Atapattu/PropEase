import { TestBed } from '@angular/core/testing';

import { HttpTrafficInterceptor } from './http-traffic.interceptor';

describe('HttpTrafficInterceptor', () => {
  let service: HttpTrafficInterceptor;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HttpTrafficInterceptor);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
