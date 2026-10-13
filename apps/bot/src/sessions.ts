import type { Lang } from './i18n';
import type { IncomingFile, LocalFile } from './telegram-file';

/** How long the buttons under a reply keep working. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * What a reply's buttons act on. Kept only in memory: a restart forgets every
 * session, and old buttons then answer "these buttons have napped".
 */
export type FileSession = {
  chatId: number;
  messageId: number;
  userId: number;
  lang: Lang;
  slug: string;
  ext: string;
  deleteToken: string;
  ttl: string;
  expiresAt: string;
  incoming: IncomingFile;
  name: string;
  /** Kept for re-uploads with another lifetime; deleted when the session ends. */
  local?: LocalFile;
  /** A press is being handled; a second one is told to wait. */
  busy: boolean;
  /** When the buttons stop working (ms since epoch). */
  until: number;
};

/**
 * Keyed by chat AND message, so a press is only ever matched against a file
 * uploaded from the same chat: Delete cannot reach another chat's file.
 */
export class SessionStore {
  private readonly sessions = new Map<string, FileSession>();

  constructor(
    private readonly ttlMs: number = SESSION_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  private static key(chatId: number, messageId: number): string {
    return `${chatId}:${messageId}`;
  }

  put(session: Omit<FileSession, 'until' | 'busy'>): FileSession {
    const full: FileSession = {
      ...session,
      busy: false,
      until: this.now() + this.ttlMs,
    };
    this.sessions.set(
      SessionStore.key(session.chatId, session.messageId),
      full,
    );
    return full;
  }

  /** The live session for a press, or undefined (unknown or napped). */
  get(chatId: number, messageId: number): FileSession | undefined {
    const session = this.sessions.get(SessionStore.key(chatId, messageId));
    if (!session) return undefined;
    if (session.until <= this.now()) return undefined;
    return session;
  }

  touch(session: FileSession): void {
    session.until = this.now() + this.ttlMs;
  }

  delete(session: FileSession): void {
    this.sessions.delete(SessionStore.key(session.chatId, session.messageId));
  }

  /** Removes and returns the sessions whose buttons have expired. */
  takeExpired(): FileSession[] {
    const now = this.now();
    const expired: FileSession[] = [];
    for (const [key, session] of this.sessions) {
      if (session.until <= now && !session.busy) {
        this.sessions.delete(key);
        expired.push(session);
      }
    }
    return expired;
  }

  get size(): number {
    return this.sessions.size;
  }
}
