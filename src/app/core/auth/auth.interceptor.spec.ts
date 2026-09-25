import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AccountService } from './account';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  it('marks requests as XHR with credentials and no caching', () => {
    http.get('/flowable-ui/modeler-app/rest/models').subscribe();
    const req = backend.expectOne('/flowable-ui/modeler-app/rest/models');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(req.request.headers.get('Cache-Control')).toContain('no-cache');
    req.flush({});
  });

  it('sends the user to the login page on 401', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    TestBed.inject(AccountService).account.set({ id: 'admin' });
    http.get('/flowable-ui/modeler-app/rest/models').subscribe({ error: () => undefined });
    backend
      .expectOne('/flowable-ui/modeler-app/rest/models')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.anything());
    expect(TestBed.inject(AccountService).authenticated()).toBe(false);
  });

  it('does not redirect when the account probe itself is unauthorized', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http.get('/flowable-ui/modeler-app/rest/account').subscribe({ error: () => undefined });
    backend
      .expectOne('/flowable-ui/modeler-app/rest/account')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(navigate).not.toHaveBeenCalled();
  });
});
