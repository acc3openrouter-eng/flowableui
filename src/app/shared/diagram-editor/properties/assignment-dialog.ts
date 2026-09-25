import { Component, effect, inject, model, output, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AutoCompleteCompleteEvent, AutoCompleteModule } from '@openng/optimus-ui/autocomplete';
import { ButtonModule } from '@openng/optimus-ui/button';
import { CheckboxModule } from '@openng/optimus-ui/checkbox';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { SelectModule } from '@openng/optimus-ui/select';
import { SelectButtonModule } from '@openng/optimus-ui/selectbutton';
import { EditorApi, EditorGroup, EditorUser } from '../../../core/api/editor-api';
import { Row, complexValue } from './property-editors';

type IdmType = 'initiator' | 'user' | 'users' | 'groups';

/** User task assignment: identity store (users and groups from IDM) or fixed values. */
@Component({
  selector: 'fm-assignment-dialog',
  imports: [
    FormsModule,
    TranslatePipe,
    AutoCompleteModule,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    SelectButtonModule,
  ],
  template: `
    <p-dialog
      [header]="'PROPERTY.ASSIGNMENT.TITLE' | translate"
      [(visible)]="visible"
      [modal]="true"
      [draggable]="false"
      [style]="{ width: '38rem' }"
      [breakpoints]="{ '640px': '96vw' }"
    >
      <div class="form">
        <p-selectbutton
          [options]="types"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="false"
          [ngModel]="type()"
          (ngModelChange)="type.set($event)"
          [ariaLabel]="'PROPERTY.ASSIGNMENT.TYPE' | translate"
        >
          <ng-template #item let-o>{{ o.label | translate }}</ng-template>
        </p-selectbutton>

        @if (type() === 'idm') {
          <div class="field">
            <label for="as-idm">{{ 'PROPERTY.ASSIGNMENT.IDM.TYPE' | translate }}</label>
            <p-select
              inputId="as-idm"
              [options]="idmTypes"
              optionLabel="label"
              optionValue="value"
              [ngModel]="idmType()"
              (ngModelChange)="idmType.set($event)"
              appendTo="body"
            >
              <ng-template #item let-o>{{ o.label | translate }}</ng-template>
              <ng-template #selectedItem let-o>{{ o?.label | translate }}</ng-template>
            </p-select>
          </div>
          @switch (idmType()) {
            @case ('user') {
              <div class="field">
                <label for="as-user">{{ 'PROPERTY.ASSIGNMENT.ASSIGNEE' | translate }}</label>
                <p-autocomplete
                  inputId="as-user"
                  [suggestions]="userSuggestions()"
                  (completeMethod)="searchUsers($event)"
                  [optionLabel]="userLabel"
                  [ngModel]="assignee()"
                  (ngModelChange)="pickAssignee($event)"
                  [forceSelection]="true"
                  [dropdown]="true"
                  appendTo="body"
                  [placeholder]="'PROPERTY.ASSIGNMENT.PLACEHOLDER-SEARCHUSER' | translate"
                />
              </div>
            }
            @case ('users') {
              <div class="field">
                <label for="as-users">{{
                  'PROPERTY.ASSIGNMENT.CANDIDATE_USERS' | translate
                }}</label>
                <p-autocomplete
                  inputId="as-users"
                  [multiple]="true"
                  [suggestions]="userSuggestions()"
                  (completeMethod)="searchUsers($event)"
                  [optionLabel]="userLabel"
                  [ngModel]="candidateUsers()"
                  (ngModelChange)="candidateUsers.set($event ?? [])"
                  [dropdown]="true"
                  appendTo="body"
                  [placeholder]="'PROPERTY.ASSIGNMENT.PLACEHOLDER-SEARCHUSER' | translate"
                />
              </div>
            }
            @case ('groups') {
              <div class="field">
                <label for="as-groups">{{
                  'PROPERTY.ASSIGNMENT.CANDIDATE_GROUPS' | translate
                }}</label>
                <p-autocomplete
                  inputId="as-groups"
                  [multiple]="true"
                  [suggestions]="groupSuggestions()"
                  (completeMethod)="searchGroups($event)"
                  [optionLabel]="groupLabel"
                  [ngModel]="candidateGroups()"
                  (ngModelChange)="candidateGroups.set($event ?? [])"
                  [dropdown]="true"
                  appendTo="body"
                  [placeholder]="'PROPERTY.ASSIGNMENT.PLACEHOLDER-SEARCHGROUP' | translate"
                />
              </div>
            }
          }
        } @else {
          <div class="field">
            <label for="as-assignee">{{ 'PROPERTY.ASSIGNMENT.ASSIGNEE' | translate }}</label>
            <input
              pInputText
              id="as-assignee"
              autocomplete="off"
              [ngModel]="staticAssignee()"
              (ngModelChange)="staticAssignee.set($event)"
              [placeholder]="'PROPERTY.ASSIGNMENT.ASSIGNEE_PLACEHOLDER' | translate"
            />
          </div>
          @for (list of staticLists; track list.key) {
            <div class="field">
              <label>{{ list.label | translate }}</label>
              @for (v of list.values(); track $index) {
                <div class="line">
                  <input
                    pInputText
                    autocomplete="off"
                    [attr.aria-label]="list.label | translate"
                    [ngModel]="v"
                    (ngModelChange)="setStatic(list.values, $index, $event)"
                  />
                  <p-button
                    icon="pi pi-times"
                    [text]="true"
                    severity="secondary"
                    [ariaLabel]="'ACTION.REMOVE' | translate"
                    (onClick)="removeStatic(list.values, $index)"
                  />
                </div>
              }
              <p-button
                icon="pi pi-plus"
                size="small"
                [text]="true"
                [label]="'ACTION.ADD' | translate"
                (onClick)="list.values.update((v) => [...v, ''])"
              />
            </div>
          }
        }

        <div class="check">
          <p-checkbox
            inputId="as-initiator"
            [binary]="true"
            [ngModel]="initiatorCanComplete()"
            (ngModelChange)="initiatorCanComplete.set($event)"
          />
          <label for="as-initiator">{{
            'PROPERTY.ASSIGNMENT.INITIATOR-CAN-COMPLETE' | translate
          }}</label>
        </div>
      </div>
      <ng-template #footer>
        <p-button
          [label]="'ACTION.CANCEL' | translate"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button [label]="'ACTION.SAVE' | translate" icon="pi pi-check" (onClick)="apply()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .field label {
      font-size: 0.875rem;
      font-weight: 500;
    }
    .field p-select,
    .field p-autocomplete,
    .field input {
      width: 100%;
    }
    :host ::ng-deep .field .p-autocomplete {
      width: 100%;
    }
    .line {
      display: flex;
      gap: 0.25rem;
    }
    .line input {
      flex: 1;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }
  `,
})
export class AssignmentDialog {
  private readonly api = inject(EditorApi);

  readonly visible = model(false);
  readonly value = input<unknown>(null);
  readonly save = output<unknown>();

  protected readonly types = [
    { value: 'idm', label: 'PROPERTY.ASSIGNMENT.TYPE.IDENTITYSTORE' },
    { value: 'static', label: 'PROPERTY.ASSIGNMENT.TYPE.STATIC' },
  ];
  protected readonly idmTypes = [
    { value: 'initiator', label: 'PROPERTY.ASSIGNMENT.IDM.DROPDOWN.INITIATOR' },
    { value: 'user', label: 'PROPERTY.ASSIGNMENT.IDM.DROPDOWN.USER' },
    { value: 'users', label: 'PROPERTY.ASSIGNMENT.IDM.DROPDOWN.USERS' },
    { value: 'groups', label: 'PROPERTY.ASSIGNMENT.IDM.DROPDOWN.GROUPS' },
  ];

  protected readonly type = signal<'idm' | 'static'>('idm');
  protected readonly idmType = signal<IdmType>('initiator');
  protected readonly assignee = signal<EditorUser | null>(null);
  protected readonly candidateUsers = signal<EditorUser[]>([]);
  protected readonly candidateGroups = signal<EditorGroup[]>([]);
  protected readonly staticAssignee = signal('');
  protected readonly staticUsers = signal<string[]>([]);
  protected readonly staticGroups = signal<string[]>([]);
  protected readonly initiatorCanComplete = signal(false);
  protected readonly userSuggestions = signal<EditorUser[]>([]);
  protected readonly groupSuggestions = signal<EditorGroup[]>([]);

  protected readonly staticLists = [
    { key: 'users', label: 'PROPERTY.ASSIGNMENT.CANDIDATE_USERS', values: this.staticUsers },
    { key: 'groups', label: 'PROPERTY.ASSIGNMENT.CANDIDATE_GROUPS', values: this.staticGroups },
  ];

  protected readonly userLabel = (u: EditorUser) => userName(u);
  protected readonly groupLabel = (g: EditorGroup) => g.name || g.id;

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      untracked(() => this.load());
    });
  }

  private load() {
    const value = complexValue(this.value()) as Row | null;
    const a = (value && typeof value === 'object' ? value['assignment'] : null) as Row | null;
    // A new task opens in identity store mode with the initiator, like the original.
    this.type.set(!a ? 'idm' : a['type'] === 'idm' ? 'idm' : 'static');
    const idm = (a?.['idm'] ?? {}) as Row;
    this.idmType.set((idm['type'] as IdmType) ?? 'initiator');
    this.assignee.set((idm['assignee'] as EditorUser) ?? null);
    this.candidateUsers.set((idm['candidateUsers'] as EditorUser[]) ?? []);
    this.candidateGroups.set((idm['candidateGroups'] as EditorGroup[]) ?? []);
    this.staticAssignee.set(String(a?.['assignee'] ?? ''));
    const values = (list: unknown) =>
      Array.isArray(list) ? list.map((v) => String((v as Row)['value'] ?? '')) : [];
    this.staticUsers.set(values(a?.['candidateUsers']));
    this.staticGroups.set(values(a?.['candidateGroups']));
    this.initiatorCanComplete.set(!!a?.['initiatorCanCompleteTask']);
  }

  protected searchUsers(event: AutoCompleteCompleteEvent) {
    const chosen = new Set(this.candidateUsers().map((u) => u.id));
    this.api.users(event.query ?? '').subscribe({
      next: (r) => this.userSuggestions.set((r.data ?? []).filter((u) => !chosen.has(u.id))),
      error: () => this.userSuggestions.set([]),
    });
  }

  protected searchGroups(event: AutoCompleteCompleteEvent) {
    const chosen = new Set(this.candidateGroups().map((g) => g.id));
    this.api.groups(event.query ?? '').subscribe({
      next: (r) => this.groupSuggestions.set((r.data ?? []).filter((g) => !chosen.has(g.id))),
      error: () => this.groupSuggestions.set([]),
    });
  }

  protected pickAssignee(user: EditorUser | string | null) {
    this.assignee.set(user && typeof user === 'object' ? user : null);
  }

  protected setStatic(list: typeof this.staticUsers, index: number, value: string) {
    list.update((v) => v.map((x, i) => (i === index ? value : x)));
  }

  protected removeStatic(list: typeof this.staticUsers, index: number) {
    list.update((v) => v.filter((_, i) => i !== index));
  }

  protected apply() {
    const assignment: Row = { type: this.type() };
    if (this.type() === 'idm') {
      const idm: Row = { type: this.idmType() };
      if (this.idmType() === 'user' && this.assignee()) idm['assignee'] = this.assignee();
      if (this.idmType() === 'users' && this.candidateUsers().length) {
        idm['candidateUsers'] = this.candidateUsers();
      }
      if (this.idmType() === 'groups' && this.candidateGroups().length) {
        idm['candidateGroups'] = this.candidateGroups();
      }
      assignment['idm'] = idm;
    } else {
      const assignee = this.staticAssignee().trim();
      if (assignee) assignment['assignee'] = assignee;
      const list = (values: string[]) =>
        values
          .map((v) => v.trim())
          .filter(Boolean)
          .map((value) => ({ value }));
      const users = list(this.staticUsers());
      const groups = list(this.staticGroups());
      if (users.length) assignment['candidateUsers'] = users;
      if (groups.length) assignment['candidateGroups'] = groups;
    }
    assignment['initiatorCanCompleteTask'] = this.initiatorCanComplete();
    this.save.emit({ assignment });
    this.visible.set(false);
  }
}

export function userName(u: EditorUser): string {
  const full = u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ');
  return full || u.email || u.id;
}
