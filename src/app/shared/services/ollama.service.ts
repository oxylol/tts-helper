import { DestroyRef, inject, Injectable } from '@angular/core';
import { AudioService } from './audio.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OpenAI } from 'openai';
import { loreTemplateGenerator } from '../util/lore';
import { LogService } from './logs.service';
import { Store } from '@ngrx/store';
import {
  OllamaChatState,
  OllamaPersonalityState,
  OllamaSettingsState,
  OllamaFeature,
} from '../state/ollama/ollama.feature';
import { OllamaActions } from '../state/ollama/ollama.actions';
import { ChatPermissions } from './chat.interface';

@Injectable()
export class OllamaService {
  private readonly store = inject(Store);
  private readonly audioService = inject(AudioService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly state$ = this.store.select(OllamaFeature.selectOllamaFeatureState);
  public readonly chatSettings$ = this.store.select(OllamaFeature.selectChatSettings);
  public readonly settings$ = this.store.select(OllamaFeature.selectSettings);
  public readonly personality$ = this.store.select(OllamaFeature.selectPersonality);
  public readonly enabled$ = this.store.select(OllamaFeature.selectEnabled);

  private chatSettings?: OllamaChatState;
  private settings?: OllamaSettingsState;
  private gptHistory: { role: 'user' | 'assistant', content: string }[] = [];

  systemLorePrompt: { role: 'system', content: string }[] = [];
  ollamaApi?: OpenAI;

  constructor() {
    this.chatSettings$
      .pipe(takeUntilDestroyed())
      .subscribe(chatSettings => this.chatSettings = chatSettings);

    this.settings$
      .pipe(takeUntilDestroyed())
      .subscribe(settings => {
        this.settings = settings;
        this.ollamaApi = new OpenAI({
          baseURL: `${settings.host}/v1`,
          apiKey: 'ollama',
          dangerouslyAllowBrowser: true,
        });
      });

    this.personality$
      .pipe(takeUntilDestroyed())
      .subscribe(personality => {
        this.systemLorePrompt = personality.modelsIdentity
          ? [{ role: 'system' as const, content: loreTemplateGenerator(personality) }]
          : [];
      });
  }

  updateChatPermissions(permissions: Partial<ChatPermissions>) {
    this.store.dispatch(OllamaActions.updateChatPermissions({ permissions }));
  }

  updatePersonality(personality: Partial<OllamaPersonalityState>) {
    this.store.dispatch(OllamaActions.updatePersonality({ personality }));
  }

  updateSettings(settings: Partial<OllamaSettingsState>) {
    this.store.dispatch(OllamaActions.updateSettings({ settings }));
  }

  updateChatSettings(chatSettings: Partial<OllamaChatState>) {
    this.store.dispatch(OllamaActions.updateChatSettings({ chatSettings }));
  }

  async playOllamaResponse(user: string, text: string, isCommand = false) {
    if (!this.chatSettings) {
      return this.logService.add('Missing Ollama chat settings, ignoring request.', 'info', 'OllamaService.playOllamaResponse');
    }

    this.logService.add(`Generating Ollama response for user [${user}] with content [${text}]`, 'info', 'OllamaService.playOllamaResponse');

    const response = await this.generateOllamaResponse(user, text, isCommand);

    if (!response) {
      return;
    }

    this.audioService.playTts(response, 'Ollama', 'gpt', this.chatSettings.charLimit, true);
  }

  async generateOllamaResponse(user: string, text: string, isCommand = false): Promise<string | null> {
    if (!this.settings || !this.chatSettings || !this.ollamaApi) {
      return null;
    }

    this.logService.add('Attempting to generate Ollama content.', 'info', 'Ollama.generateOllamaResponse');

    const trimmedText = isCommand ? text.substring(this.chatSettings.command.length).trim() : text;
    const content = `${user} says "${trimmedText}"`;

    try {
      const response = await this.ollamaApi.chat.completions.create({
        model: this.settings.model,
        temperature: this.settings.temperature,
        max_tokens: this.settings.maxTokens,
        messages: [
          ...this.systemLorePrompt,
          ...this.gptHistory,
          { role: 'user', content },
        ],
      });

      const { message } = response.choices[0];

      if (!message?.content) {
        this.logService.add('Ollama failed to respond.', 'error', 'OllamaService.generateOllamaResponse');
        return null;
      }

      this.logService.add(`Generated response: ${message.content}.`, 'info', 'Ollama.generateOllamaResponse');

      this.gptHistory.push(
        { role: 'user', content },
        { role: 'assistant', content: message.content },
      );

      this.gptHistory = this.gptHistory.slice(-1 * (this.settings?.historyLimit ?? 0));

      return message.content;
    } catch (e) {
      this.logService.add(`Ollama failed to respond.\n${JSON.stringify(e, undefined, 2)}`, 'error', 'OllamaService.generateOllamaResponse');
      return 'My brain is all fuzzy...';
    }
  }
}
