import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountService } from './account';

export const authGuard: CanActivateFn = async (_route, state) => {
  const account = inject(AccountService);
  const router = inject(Router);
  if (account.authenticated() || (await account.load())) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
