import type { BotCommand } from 'grammy/types';
import type { Lang } from './i18n';
import texts from './profile.json';

/**
 * The bot's profile: /start and /help in the command menu, the short
 * description (profile page, share previews) and the description (the empty
 * chat before Start). Set by scripts/set-profile.ts, by hand.
 */
export type BotProfile = {
  commands: BotCommand[];
  shortDescription: string;
  description: string;
};

/** Bot API limits, counted in UTF-16 code units (the stricter count). */
export const PROFILE_LIMITS = {
  shortDescription: 120,
  description: 512,
  commandDescription: 256,
  command: 32,
} as const;

export const PROFILES: Record<Lang, BotProfile> = texts;

/** Every limit the profile would break; empty when it fits. */
export const profileProblems = (profiles: Record<string, BotProfile>) => {
  const problems: string[] = [];
  for (const [lang, p] of Object.entries(profiles)) {
    if (p.shortDescription.length > PROFILE_LIMITS.shortDescription) {
      problems.push(`${lang}: short description ${p.shortDescription.length}`);
    }
    if (p.description.length > PROFILE_LIMITS.description) {
      problems.push(`${lang}: description ${p.description.length}`);
    }
    for (const c of p.commands) {
      if (!/^[a-z0-9_]{1,32}$/.test(c.command)) {
        problems.push(`${lang}: command ${c.command}`);
      }
      if (
        c.description.length < 1 ||
        c.description.length > PROFILE_LIMITS.commandDescription
      ) {
        problems.push(`${lang}: /${c.command} description`);
      }
    }
  }
  return problems;
};
