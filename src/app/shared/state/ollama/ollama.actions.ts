import { createActionGroup, props } from '@ngrx/store';
import { OllamaChatState, OllamaPersonalityState, OllamaSettingsState, OllamaState } from './ollama.feature';
import { ChatPermissions } from '../../services/chat.interface';

export const OllamaActions = createActionGroup({
  source: 'Ollama',
  events: {
    'Update Chat Permissions': props<{ permissions: Partial<ChatPermissions> }>(),
    'Update Chat Settings': props<{ chatSettings: Partial<OllamaChatState> }>(),
    'Update Personality': props<{ personality: Partial<OllamaPersonalityState> }>(),
    'Update Settings': props<{ settings: Partial<OllamaSettingsState> }>(),
    'Update State': props<{ ollamaState: OllamaState }>(),
  },
});
