/**
 * Sets the bot's commands and descriptions (src/profile.json): English as the
 * default for every language, Ukrainian for `uk`. Run by hand, once, and again
 * whenever those texts change. Never in CI.
 *
 * It must go through the LOCAL Bot API server: once the bot has logged out of
 * the cloud server (see src/cloud-logout.ts), a call to api.telegram.org would
 * log it back in there. The production image ships this script, so:
 *
 *   docker exec filesdrop-bot bun dist/scripts/set-profile.js
 *
 * (TELEGRAM_BOT_TOKEN and TELEGRAM_API_ROOT come from the container's env.)
 */
import { Api } from 'grammy';
import { PROFILES, profileProblems } from '../src/profile';

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const apiRoot = (
  process.env.TELEGRAM_API_ROOT?.trim() || 'http://filesdrop-tg-api:8081'
).replace(/\/+$/, '');

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const problems = profileProblems(PROFILES);
if (problems.length > 0) {
  console.error(`profile breaks a Bot API limit: ${problems.join('; ')}`);
  process.exit(1);
}

const api = new Api(token, { apiRoot });

for (const [scope, profile] of [
  [{}, PROFILES.en],
  [{ language_code: 'uk' }, PROFILES.uk],
] as const) {
  await api.setMyCommands(profile.commands, scope);
  await api.setMyShortDescription(profile.shortDescription, scope);
  await api.setMyDescription(profile.description, scope);
  console.log(
    `profile set: ${'language_code' in scope ? scope.language_code : 'default'}`,
  );
}
