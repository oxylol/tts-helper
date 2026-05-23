import { inject, Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { OllamaService } from './ollama.service';
import { GeneralChatState } from '../state/config/config.feature';
import { OllamaChatState } from '../state/ollama/ollama.feature';
import { ChatPermissions, ChatUserMessage, WatchStreakUser } from './chat.interface';
import { AudioService } from './audio.service';
import { AudioSource } from '../state/audio/audio.feature';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { WatchStreakActions } from '../state/watch-streak/watch-streak.actions';
import { WatchStreakFeature, WatchStreakFeatureState } from '../state/watch-streak/watch-streak.feature';
import { TwitchService } from './twitch.service';

@Injectable()
export class ChatService {
  private readonly store = inject(Store);
  private readonly configService = inject(ConfigService);
  private readonly ollamaService = inject(OllamaService);
  private readonly audioService = inject(AudioService);
  private readonly twitchService = inject(TwitchService);

  public readonly watchStreakState$ = this.store.select(WatchStreakFeature.selectWatchStreakFeatureState);

  generalChat!: GeneralChatState;
  ollamaChat!: OllamaChatState;
  twitchRandomCharacterLimit: number = 0;

  cooldowns = new Map<string, boolean>();

  constructor() {
    this.configService.generalChat$
      .pipe(takeUntilDestroyed())
      .subscribe(generalChat => this.generalChat = generalChat);

    this.ollamaService.chatSettings$
      .pipe(takeUntilDestroyed())
      .subscribe(chatSettings => this.ollamaChat = chatSettings);

    this.twitchService.settings$
      .pipe(takeUntilDestroyed())
      .subscribe(settings => this.twitchRandomCharacterLimit = settings.maxCharacterLimit);
  }

  /**
   * Check if user has chat settings enabled or Ollama chat settings enabled.
   * @param user The user that sent the message
   * @param source Platform that the message came from
   * @return boolean If user message was played as TTS
   */
  async onMessage(user: ChatUserMessage, source: AudioSource) {
    const canProceed = await this.audioService.canProcessMessage(user.text, user.displayName);

    if (!canProceed || !this.generalChat.enabled && !this.ollamaChat.enabled) {
      return false;
    }

    const generalCooldownID = `${source}-general`;
    const ollamaCooldownID = `${source}-ollama`;
    const { text } = user;

    /**
     * Handle normal chat commands and their cooldowns
     */
    if (this.generalChat.enabled &&
      text.startsWith(this.generalChat.command) &&
      this.hasChatCommandPermissions(user, this.generalChat.permissions) &&
      !this.cooldowns.get(generalCooldownID)
    ) {
      const trimmedText = text.substring(this.generalChat.command.length).trim();
      this.audioService.playTts(trimmedText, user.displayName, source, this.generalChat.charLimit);
      const duration = this.generalChat.cooldown * 1000;

      this.cooldowns.set(generalCooldownID, true);
      setTimeout(() => this.cooldowns.set(generalCooldownID, false), duration);

      return true;
    }

    /**
     * Handle Ollama (local AI) related chat commands and their cooldowns
     */
    if (this.ollamaChat.enabled &&
      text.startsWith(this.ollamaChat.command) &&
      this.hasChatCommandPermissions(user, this.ollamaChat.permissions) &&
      !this.cooldowns.get(ollamaCooldownID)
    ) {
      this.ollamaService.playOllamaResponse(user.displayName, text, true);
      const duration = this.ollamaChat.cooldown * 1000;

      this.cooldowns.set(ollamaCooldownID, true);
      setTimeout(() => this.cooldowns.set(ollamaCooldownID, false), duration);

      return true;
    }

    return false;
  }

  randomChance(user: Pick<ChatUserMessage, 'text' | 'displayName'>, chance: number, useOllama: boolean, source: AudioSource) {
    const diceRoll = Math.random() * 100;

    if (diceRoll > chance) {
      return;
    }

    const { text, displayName } = user;

    /**
     * If a user set a max character limit for messages, we want to ignore any that exceed that limit.
     * 0 or lower means the setting is disabled
     */
    if (this.twitchRandomCharacterLimit > 0 && text.length > this.twitchRandomCharacterLimit) {
      return;
    }

    if (useOllama) {
      this.ollamaService.playOllamaResponse(displayName, text);
    } else {
      this.audioService.playTts(text, displayName, source, this.generalChat.charLimit);
    }
  }

  updateWatchStreak(partialState: Partial<WatchStreakFeatureState>) {
    this.store.dispatch(WatchStreakActions.updateState({ partialState }));
  }

  handleWatchStreak(user: WatchStreakUser) {
    this.store.dispatch(WatchStreakActions.updateUsersWatchDate({
      user: {
        userName: user.displayName,
        userId: user.id,
      },
    }));
  }

  logStreamStart() {
    this.store.dispatch(WatchStreakActions.logStreamStart());
  }

  hasChatCommandPermissions(user: Pick<ChatUserMessage, 'permissions'>, permissions: ChatPermissions) {
    if (user.permissions.isBroadcaster) {
      return true;
    } else if (permissions.allUsers) {
      return true;
    } else if (permissions.mods && user.permissions.isMod) {
      return true;
    } else if (permissions.payingMembers && user.permissions.isPayingMember) {
      return true;
    }

    return false;
  }
}
