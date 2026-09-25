import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AccountService } from './account';

/**
 * Sends the session cookie with every call, disables caching of GET responses (as the original app did),
 * and sends the user back to the login page when the session is gone.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const account = inject(AccountService);
  const isAuthCall = req.url.endsWith('/rest/account') || req.url.endsWith('/app/authentication');

  const request = req.clone({
    withCredentials: true,
    setHeaders: {
      // Makes Spring Security answer 401 instead of redirecting to the IDM login page.
      'X-Requested-With': 'XMLHttpRequest',
      ...(req.method === 'GET'
        ? {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          }
        : {}),
    },
  });

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthCall) {
        account.account.set(null);
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      return throwError(() => error);
    }),
  );
};
