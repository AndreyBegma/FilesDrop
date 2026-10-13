import { ttlLabel } from './ttls';

export type Lang = 'en' | 'uk';

/** uk when Telegram says the user's language starts with `uk`, else en. */
export const pickLang = (languageCode: string | undefined | null): Lang =>
  languageCode?.trim().toLowerCase().startsWith('uk') ? 'uk' : 'en';

export type ErrorKey =
  | 'too_large'
  | 'unsupported'
  | 'rate_limited'
  | 'quota'
  | 'gone'
  | 'fetch_failed'
  | 'generic';

export type IntroParams = {
  /** e.g. ['1h', '12h', '24h', '72h'] */
  ttls: readonly string[];
  defaultTtl: string;
  maxMb: number;
  privacyUrl: string;
  webUrl: string;
  /** Without the @. */
  botUsername: string;
};

export type UploadedParams = {
  directUrl: string;
  previewUrl: string;
  ttl: string;
  /** ISO 8601 */
  expiresAt: string;
};

export type Messages = {
  start(p: IntroParams): string;
  help(p: IntroParams): string;
  working: string;
  uploaded(p: UploadedParams): string;
  error(key: ErrorKey, p: { maxMb: number; sizeMb?: number }): string;
  notAFile: string;
  oneAtATime: string;
  napped: string;
  busy: string;
  deleted: string;
  ttlChanged(ttl: string): string;
  deleteButton: string;
  /** The answer to a tap on the language picker. */
  langChosen: string;
  /** Appended to an upload reply while no language has been chosen yet. */
  langHint: string;
};

/** Shown before a language is chosen, so it speaks both. */
export const LANG_PROMPT = 'Choose your language · Обери мову 🐾';

/** Each language names itself on its button. */
export const LANG_BUTTONS: Record<Lang, string> = {
  en: '🇬🇧 English',
  uk: '🇺🇦 Українська',
};

/** `2026-10-14 21:00 UTC` — Telegram has no notion of the reader's zone. */
export const formatExpiry = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
};

const range = (ttls: readonly string[]): [string, string] => [
  ttlLabel(ttls[0] ?? '1h'),
  ttlLabel(ttls[ttls.length - 1] ?? '24h'),
];

const en: Messages = {
  start: (p) => {
    const [min, max] = range(p.ttls);
    return [
      "Meow! 🐱 I'm the FilesDrop cat.",
      '',
      'Send me a photo, video, document, audio, voice note, GIF or video circle, and I will drop it on FilesDrop and bring you back two links: a direct one and a preview page.',
      '',
      `• Up to ${p.maxMb} MB per file. Anything bigger does not fit through the cat flap.`,
      `• Links live ${ttlLabel(p.defaultTtl)} by default. The buttons under my reply change that, from ${min} to ${max}.`,
      '• Anyone who has a link can open the file. Do not drop anything you would not leave on the doorstep.',
      '• 🗑 Delete removes the file early. It only works in the chat that sent it.',
      '',
      `Privacy, in plain words: ${p.privacyUrl}`,
      '/help repeats all this, minus the purring.',
    ].join('\n');
  },
  help: (p) => {
    const [min, max] = range(p.ttls);
    return [
      'How this cat works 🐾',
      '',
      '1. Send a file: photo, video, document, audio, voice, GIF or video circle.',
      '2. Get a direct link (embeds in chats and Markdown) and a preview link (a page with a download button).',
      `3. Tap ${p.ttls.map(ttlLabel).join(' · ')} to change how long it lives, or 🗑 to delete it.`,
      '',
      `Limits: ${p.maxMb} MB per file, ${min} to ${max} of life, and links are public to whoever has them. The buttons keep working for 30 minutes after an upload; after that, just send the file again.`,
      '',
      `Website: ${p.webUrl}`,
      `Privacy: ${p.privacyUrl}`,
      `Share the cat: https://t.me/${p.botUsername}`,
      '/lang switches between English and Ukrainian.',
    ].join('\n');
  },
  working: 'Carrying it over in my teeth… 🐈',
  uploaded: (p) =>
    [
      'Purr-fect, it landed on its feet! 🐾',
      '',
      `Direct: ${p.directUrl}`,
      `Preview: ${p.previewUrl}`,
      '',
      `Lives ${ttlLabel(p.ttl)}, until ${formatExpiry(p.expiresAt)}. Anyone with a link can open it.`,
    ].join('\n'),
  error: (key, p) => {
    switch (key) {
      case 'too_large':
        return p.sizeMb
          ? `That one is too chonky 🐈 (${p.sizeMb} MB). The cat flap fits ${p.maxMb} MB at most.`
          : `That one is too chonky 🐈. The cat flap fits ${p.maxMb} MB at most.`;
      case 'unsupported':
        return 'Hiss! 🙀 I do not carry this kind of file: programs and scripts stay outside. Send something else, or zip it.';
      case 'rate_limited':
        return 'Paws off for a bit 🐾: that is 30 uploads in 10 minutes. Try again in a little while.';
      case 'quota':
        return 'The litter box is full 📦: FilesDrop has run out of room for now. Try again later, when older files have expired.';
      case 'gone':
        return 'That file has already wandered off: it expired or was deleted. 🐈‍⬛';
      case 'fetch_failed':
        return 'I could not fetch that file from Telegram. Send it again?';
      case 'generic':
        return 'I landed on my feet, but your file did not. 😿 Try again in a minute.';
    }
  },
  notAFile:
    'I only carry files 🐱. Send me a photo, video, document, audio, voice note or GIF. /help explains the rest.',
  oneAtATime: 'One at a time, please: I only have four paws. 🐾',
  napped: 'These buttons have napped 😴. Send the file again for fresh ones.',
  busy: 'Still kneading the last request… one moment. 🐈',
  deleted: '🗑 Deleted. The links are gone, like a cat the moment you need it.',
  ttlChanged: (ttl) => `Now it lives ${ttlLabel(ttl)}. 🐾`,
  deleteButton: '🗑 Delete',
  langChosen: 'English it is. 🐾',
  langHint: 'Change language: /lang',
};

const uk: Messages = {
  start: (p) => {
    const [min, max] = range(p.ttls);
    return [
      'Няв! 🐱 Я кіт FilesDrop.',
      '',
      'Надішли мені фото, відео, документ, аудіо, голосове, GIF або відеокружечок, і я віднесу його на FilesDrop та принесу тобі два посилання: пряме і сторінку перегляду.',
      '',
      `• До ${p.maxMb} МБ на файл. Більше не пролазить у котячі дверцята.`,
      `• Посилання живуть ${ttlLabel(p.defaultTtl)} за замовчуванням. Кнопки під моєю відповіддю це змінюють, від ${min} до ${max}.`,
      '• Відкрити файл може будь-хто, у кого є посилання. Не кидай сюди те, що не залишив би під дверима.',
      '• 🗑 Видалити прибирає файл раніше. Працює лише в чаті, з якого його надіслали.',
      '',
      `Приватність, простими словами: ${p.privacyUrl}`,
      '/help повторить усе це, тільки без муркотіння.',
    ].join('\n');
  },
  help: (p) => {
    const [min, max] = range(p.ttls);
    return [
      'Як працює цей кіт 🐾',
      '',
      '1. Надішли файл: фото, відео, документ, аудіо, голосове, GIF або відеокружечок.',
      '2. Отримай пряме посилання (вбудовується в чати й Markdown) і посилання на перегляд (сторінка з кнопкою завантаження).',
      `3. Тисни ${p.ttls.map(ttlLabel).join(' · ')}, щоб змінити час життя, або 🗑, щоб видалити.`,
      '',
      `Обмеження: ${p.maxMb} МБ на файл, від ${min} до ${max} життя, і посилання публічні для всіх, у кого вони є. Кнопки працюють 30 хвилин після завантаження; потім просто надішли файл ще раз.`,
      '',
      `Сайт: ${p.webUrl}`,
      `Приватність: ${p.privacyUrl}`,
      `Поділитися котом: https://t.me/${p.botUsername}`,
      '/lang перемикає між українською та англійською.',
    ].join('\n');
  },
  working: 'Несу в зубах… 🐈',
  uploaded: (p) =>
    [
      'Мур-р-рно, приземлився на лапи! 🐾',
      '',
      `Пряме: ${p.directUrl}`,
      `Перегляд: ${p.previewUrl}`,
      '',
      `Живе ${ttlLabel(p.ttl)}, до ${formatExpiry(p.expiresAt)}. Відкрити може будь-хто з посиланням.`,
    ].join('\n'),
  error: (key, p) => {
    switch (key) {
      case 'too_large':
        return p.sizeMb
          ? `Цей завеликий котяра 🐈 (${p.sizeMb} МБ). У дверцята пролазить щонайбільше ${p.maxMb} МБ.`
          : `Цей завеликий котяра 🐈. У дверцята пролазить щонайбільше ${p.maxMb} МБ.`;
      case 'unsupported':
        return 'Ш-ш-ш! 🙀 Такі файли я не ношу: програми та скрипти лишаються надворі. Надішли щось інше або запакуй у zip.';
      case 'rate_limited':
        return 'Лапки геть на хвилинку 🐾: це вже 30 завантажень за 10 хвилин. Спробуй трохи згодом.';
      case 'quota':
        return 'Котячий лоток переповнений 📦: на FilesDrop зараз немає місця. Спробуй пізніше, коли старі файли зникнуть.';
      case 'gone':
        return 'Цей файл уже кудись пішов гуляти: термін минув або його видалили. 🐈‍⬛';
      case 'fetch_failed':
        return 'Не вдалося забрати цей файл із Telegram. Надішлеш ще раз?';
      case 'generic':
        return 'Я приземлився на лапи, а твій файл ні. 😿 Спробуй за хвилинку.';
    }
  },
  notAFile:
    'Я ношу лише файли 🐱. Надішли фото, відео, документ, аудіо, голосове або GIF. /help розповість решту.',
  oneAtATime: 'По одному, будь ласка: у мене лише чотири лапи. 🐾',
  napped: 'Ці кнопки задрімали 😴. Надішли файл ще раз, щоб отримати свіжі.',
  busy: 'Ще вовтужуся з попереднім… хвилинку. 🐈',
  deleted: '🗑 Видалено. Посилань більше немає, як кота, коли він потрібен.',
  ttlChanged: (ttl) => `Тепер живе ${ttlLabel(ttl)}. 🐾`,
  deleteButton: '🗑 Видалити',
  langChosen: 'Українська, мур-р. 🐾',
  langHint: 'Змінити мову: /lang',
};

export const MESSAGES: Record<Lang, Messages> = { en, uk };

export const t = (lang: Lang): Messages => MESSAGES[lang];

export const privacyUrl = (webUrl: string, lang: Lang): string =>
  `${webUrl}/${lang}/privacy`;
