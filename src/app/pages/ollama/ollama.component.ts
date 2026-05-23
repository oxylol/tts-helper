import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { InputComponent } from '../../shared/components/input/input.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { LabelBlockComponent } from '../../shared/components/input-block/label-block.component';
import { OllamaService } from '../../shared/services/ollama.service';

@Component({
  selector: 'app-ollama',
  imports: [
    CommonModule,
    InputComponent,
    ToggleComponent,
    MatSliderModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    LabelBlockComponent,
    MatTabsModule,
  ],
  templateUrl: './ollama.component.html',
  styleUrls: ['./ollama.component.scss'],
})
export class OllamaComponent {
  private readonly ollamaService = inject(OllamaService);

  readonly charLimit = new FormControl(300, { nonNullable: true, validators: [Validators.min(0)] });
  readonly command = new FormControl('!local', { nonNullable: true });

  readonly settings = new FormGroup({
    host: new FormControl('http://localhost:11434', { nonNullable: true }),
    model: new FormControl('qwen2.5:7b', { nonNullable: true }),
    enabled: new FormControl(false, { nonNullable: true }),
    historyLimit: new FormControl(10, { nonNullable: true, validators: [Validators.min(0), Validators.max(20)] }),
  });

  readonly personality = new FormGroup({
    streamersIdentity: new FormControl('', { nonNullable: true }),
    streamerModelRelation: new FormControl('', { nonNullable: true }),
    streamersThoughtsOnModel: new FormControl('', { nonNullable: true }),
    modelsIdentity: new FormControl('', { nonNullable: true }),
    modelsCoreIdentity: new FormControl('', { nonNullable: true }),
    modelsBackground: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.ollamaService.settings$
      .pipe(takeUntilDestroyed())
      .subscribe(settings => this.settings.setValue({
        enabled: settings.enabled,
        historyLimit: settings.historyLimit,
        host: settings.host,
        model: settings.model,
      }, { emitEvent: false }));

    this.ollamaService.chatSettings$
      .pipe(takeUntilDestroyed())
      .subscribe(chatSettings => {
        this.charLimit.setValue(chatSettings.charLimit, { emitEvent: false });
        this.command.setValue(chatSettings.command, { emitEvent: false });
      });

    this.ollamaService.personality$
      .pipe(takeUntilDestroyed())
      .subscribe(personality => this.personality.setValue(personality, { emitEvent: false }));

    this.settings.valueChanges
      .pipe(takeUntilDestroyed(), filter(() => this.settings.valid))
      .subscribe(settings => this.ollamaService.updateSettings({
        ...settings,
        historyLimit: Number(settings.historyLimit),
      }));

    this.charLimit.valueChanges
      .pipe(takeUntilDestroyed(), filter(() => this.charLimit.valid))
      .subscribe(charLimit => this.ollamaService.updateChatSettings({ charLimit }));

    this.command.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(command => this.ollamaService.updateChatSettings({ command }));

    this.personality.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(personality => this.ollamaService.updatePersonality(personality));
  }
}

export default OllamaComponent;
