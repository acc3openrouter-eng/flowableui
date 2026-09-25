import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiUrls } from '../api/api-urls';
import { UserRepresentation } from '../api/api.types';

/** The signed-in user, from `GET /rest/account`. Authentication itself is the Flowable UI session cookie. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly urls = inject(ApiUrls);

  readonly account = signal<UserRepresentation | null>(null);
  readonly authenticated = computed(() => this.account() !== null);
  readonly displayName = computed(() => {
    const user = this.account();
    if (!user) return '';
    return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.id;
  });

  /** Loads the account; resolves to false when there is no valid session. */
  async load(): Promise<boolean> {
    try {
      this.account.set(
        await firstValueFrom(this.http.get<UserRepresentation>(this.urls.account())),
      );
      return true;
    } catch {
      this.account.set(null);
      return false;
    }
  }

  /** Signs in against the Flowable UI form login (`POST /app/authentication`). */
  async login(username: string, password: string): Promise<boolean> {
    const body = new URLSearchParams({
      j_username: username,
      j_password: password,
      _spring_security_remember_me: 'true',
      submit: 'Login',
    });
    try {
      await firstValueFrom(
        this.http.post(this.urls.authentication(), body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          responseType: 'text',
        }),
      );
    } catch {
      return false;
    }
    return this.load();
  }

  logout(): void {
    this.account.set(null);
    window.location.href = this.urls.logout();
  }
}
