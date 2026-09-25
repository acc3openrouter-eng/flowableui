import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { PasswordModule } from '@openng/optimus-ui/password';
import { AccountService } from '../../core/auth/account';

/** Sign-in against the Flowable UI form login; the session cookie it sets is shared with the IDM, Task and Admin apps. */
@Component({
  selector: 'fm-login',
  imports: [FormsModule, ButtonModule, InputTextModule, MessageModule, PasswordModule],
  template: `
    <main class="page">
      <form class="panel" (ngSubmit)="submit()">
        <div class="brand">
          <span class="logo" aria-hidden="true"><i class="pi pi-sitemap"></i></span>
          <div>
            <h1>Flowable Modeler</h1>
            <p>Sign in to design processes, cases, forms and decisions.</p>
          </div>
        </div>
        <label class="field">
          <span>User ID</span>
          <input
            pInputText
            name="username"
            [(ngModel)]="username"
            autocomplete="username"
            required
            autofocus
          />
        </label>
        <label class="field">
          <span>Password</span>
          <p-password
            name="password"
            [(ngModel)]="password"
            [feedback]="false"
            [toggleMask]="true"
            autocomplete="current-password"
            [fluid]="true"
          />
        </label>
        @if (failed()) {
          <p-message severity="error" text="Sign-in failed. Check your user ID and password." />
        }
        <p-button
          type="submit"
          label="Sign in"
          [loading]="busy()"
          [disabled]="!username || !password"
          styleClass="w-full"
        />
      </form>
    </main>
  `,
  styles: `
    .page {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 1rem;
      background:
        radial-gradient(
          60rem 30rem at 10% -10%,
          color-mix(in srgb, var(--p-primary-300) 35%, transparent),
          transparent
        ),
        radial-gradient(
          50rem 30rem at 110% 110%,
          color-mix(in srgb, var(--p-primary-500) 25%, transparent),
          transparent
        ),
        var(--p-surface-50);
    }
    :host-context(.app-dark) .page {
      background-color: var(--p-surface-950);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 1.125rem;
      width: 100%;
      max-width: 24rem;
      padding: 2rem;
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      border-radius: 1.25rem;
      box-shadow: 0 20px 50px -20px rgb(15 23 42 / 0.35);
    }
    .brand {
      display: flex;
      gap: 0.875rem;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .brand h1 {
      margin: 0;
      font-size: 1.25rem;
    }
    .brand p {
      margin: 0.125rem 0 0;
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
    .logo {
      display: grid;
      flex: none;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      color: #fff;
      font-size: 1.25rem;
      background: linear-gradient(135deg, var(--p-primary-400), var(--p-primary-700));
      border-radius: 0.75rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      font-weight: 500;
    }
    .field input {
      width: 100%;
    }
    :host ::ng-deep .w-full {
      width: 100%;
    }
  `,
})
export class Login {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);

  readonly returnUrl = input<string>();

  protected username = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async submit(): Promise<void> {
    if (!this.username || !this.password) return;
    this.busy.set(true);
    this.failed.set(false);
    const ok = await this.account.login(this.username, this.password);
    this.busy.set(false);
    if (ok) {
      await this.router.navigateByUrl(this.returnUrl() || '/processes');
    } else {
      this.failed.set(true);
    }
  }
}
