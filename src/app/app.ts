import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from '@openng/optimus-ui/confirmdialog';
import { ToastModule } from '@openng/optimus-ui/toast';

@Component({
  selector: 'fm-root',
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
  template: `
    <router-outlet />
    <p-toast position="bottom-right" />
    <p-confirmdialog />
  `,
})
export class App {}
