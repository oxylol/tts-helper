import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { OllamaActions } from './ollama.actions';
import { ChatState } from '../../services/chat.interface';

export type OllamaChatState = ChatState;

export interface OllamaPersonalityState {
  streamersIdentity: string;
  streamerModelRelation: string;
  streamersThoughtsOnModel: string;
  modelsIdentity: string;
  modelsCoreIdentity: string;
  modelsBackground: string;
}

export interface OllamaSettingsState {
  host: string;
  model: string;
  enabled: boolean;
  historyLimit: number;
  temperature: number;
  maxTokens: number;
}

export interface OllamaState {
  chatSettings: OllamaChatState;
  personality: OllamaPersonalityState;
  settings: OllamaSettingsState;
}

export const initialState: OllamaState = {
  chatSettings: {
    command: '!local',
    permissions: {
      mods: false,
      allUsers: false,
      payingMembers: false,
    },
    cooldown: 0,
    charLimit: 300,
    enabled: false,
  },
  personality: {
    modelsBackground: '',
    modelsCoreIdentity: '',
    streamersThoughtsOnModel: '',
    modelsIdentity: '',
    streamerModelRelation: '',
    streamersIdentity: '',
  },
  settings: {
    host: 'http://localhost:11434',
    model: 'qwen2.5:7b',
    enabled: false,
    historyLimit: 10,
    maxTokens: 100,
    temperature: 1,
  },
};

export const OllamaFeature = createFeature({
  name: 'OllamaFeature',
  reducer: createReducer(
    initialState,
    on(OllamaActions.updateChatPermissions, (state, { permissions }) => ({
      ...state,
      chatSettings: {
        ...state.chatSettings,
        permissions: {
          ...state.chatSettings.permissions,
          ...permissions,
        },
      },
    })),
    on(OllamaActions.updateChatSettings, (state, { chatSettings }) => ({
      ...state,
      chatSettings: {
        ...state.chatSettings,
        ...chatSettings,
      },
    })),
    on(OllamaActions.updatePersonality, (state, { personality }) => ({
      ...state,
      personality: {
        ...state.personality,
        ...personality,
      },
    })),
    on(OllamaActions.updateSettings, (state, { settings }) => ({
      ...state,
      settings: {
        ...state.settings,
        ...settings,
      },
    })),
    on(OllamaActions.updateState, (state, { ollamaState }) => ({
      ...state,
      ...ollamaState,
    })),
  ),
  extraSelectors: ({
    selectSettings,
  }) => ({
    selectEnabled: createSelector(selectSettings, settings => settings.enabled),
  }),
});
