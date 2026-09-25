import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { CheckboxModule } from '@openng/optimus-ui/checkbox';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { RadioButtonModule } from '@openng/optimus-ui/radiobutton';
import { SelectModule } from '@openng/optimus-ui/select';
import { TabsModule } from '@openng/optimus-ui/tabs';
import { TextareaModule } from '@openng/optimus-ui/textarea';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import {
  EditorField,
  deriveFieldId,
  fieldCapabilities,
  newField,
  paletteItem,
} from './form-field-types';

type Tab = 'general' | 'options' | 'upload' | 'advanced';

/** Side panel that edits one field; replaces the original "Edit field" popup. */
@Component({
  selector: 'fm-field-properties',
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    RadioButtonModule,
    SelectModule,
    TabsModule,
    TextareaModule,
    TooltipModule,
  ],
  templateUrl: './field-properties.html',
  styleUrl: './field-properties.scss',
})
export class FieldProperties {
  private readonly translate = inject(TranslateService);

  readonly field = input.required<EditorField>();
  readonly index = input.required<number>();
  readonly changed = output<void>();
  readonly closed = output<void>();
  readonly removed = output<void>();

  protected readonly tab = signal<Tab>('general');
  protected readonly caps = computed(() => fieldCapabilities(this.field().type));
  protected readonly palette = computed(() => paletteItem(this.field().type));
  protected readonly tabs = computed(() => {
    const caps = this.caps();
    const tabs: { id: Tab; label: string }[] = [
      { id: 'general', label: 'FORM-BUILDER.TABS.GENERAL' },
    ];
    if (caps.options) tabs.push({ id: 'options', label: 'FORM-BUILDER.TABS.OPTIONS' });
    if (caps.upload) tabs.push({ id: 'upload', label: 'FORM-BUILDER.TABS.UPLOAD-OPTIONS' });
    if (caps.advanced) tabs.push({ id: 'advanced', label: 'FORM-BUILDER.TABS.ADVANCED-OPTIONS' });
    return tabs;
  });

  protected readonly sizes = ['1', '2', '3', '4', '5'];
  protected newOption = '';
  /** Bumped on every edit so computed text (derived id) re-evaluates for in-place mutations. */
  protected readonly revision = signal(0);
  protected readonly derivedId = computed(() => {
    this.revision();
    const field = this.field();
    return field.overrideId ? field.id : deriveFieldId(field.name, this.index());
  });

  constructor() {
    // Back to the first tab whenever another field is selected.
    effect(() => {
      this.field();
      untracked(() => {
        this.tab.set('general');
        this.newOption = '';
      });
    });
  }

  protected get params(): Record<string, unknown> {
    const field = this.field();
    field.params ??= {};
    return field.params;
  }

  protected digits(value: string): string {
    return value.replace(/\D/g, '');
  }

  protected touch(): void {
    this.revision.update((r) => r + 1);
    this.changed.emit();
  }

  protected setOverrideId(value: boolean): void {
    const field = this.field();
    field.overrideId = value;
    if (value && !field.id) field.id = deriveFieldId(field.name, this.index());
    this.touch();
  }

  protected get optionsExpressionEnabled(): boolean {
    const expr = this.field().optionsExpression;
    return expr !== null && expr !== undefined && expr !== '';
  }

  protected setOptionsExpressionEnabled(enabled: boolean): void {
    const field = this.field();
    if (enabled) {
      field.options = [];
      field.value = '';
      field.optionsExpression = '${}';
    } else {
      const fresh = newField(field.type, (key) => this.translate.instant(key));
      field.optionsExpression = null;
      field.options = fresh.options;
      field.value = fresh.value;
    }
    this.touch();
  }

  protected isEmptyOption(index: number): boolean {
    const field = this.field();
    return field.type === 'dropdown' && index === 0;
  }

  protected canRemoveOption(index: number): boolean {
    return !this.isEmptyOption(index) && (this.field().options?.length ?? 0) > 1;
  }

  protected removeOption(index: number): void {
    const field = this.field();
    const [removed] = field.options?.splice(index, 1) ?? [];
    if (removed && field.value === removed.name) field.value = field.options?.[0]?.name ?? '';
    this.touch();
  }

  protected renameOption(index: number, name: string): void {
    const field = this.field();
    const option = field.options?.[index];
    if (!option) return;
    if (field.value === option.name) field.value = name;
    option.name = name;
    this.touch();
  }

  protected addOption(): void {
    const name = this.newOption.trim();
    if (!name) return;
    const field = this.field();
    field.options = [...(field.options ?? []), { name }];
    this.newOption = '';
    this.touch();
  }
}
