import { describe, expect, it } from 'bun:test';
import { errorKeyFor } from './api-errors';

describe('errorKeyFor', () => {
  it('maps the API statuses the bot can hit', () => {
    expect(errorKeyFor(413, 'too_large')).toBe('too_large');
    expect(errorKeyFor(415, 'denied_extension')).toBe('unsupported');
    expect(errorKeyFor(415, 'executable_content')).toBe('unsupported');
    expect(errorKeyFor(429, 'rate_limited')).toBe('rate_limited');
    expect(errorKeyFor(507, 'quota_exceeded')).toBe('quota');
    expect(errorKeyFor(404, 'not_found')).toBe('gone');
    expect(errorKeyFor(410, 'expired')).toBe('gone');
  });

  it('goes by status when there is no reason (a proxy answered)', () => {
    expect(errorKeyFor(413)).toBe('too_large');
    expect(errorKeyFor(429)).toBe('rate_limited');
    expect(errorKeyFor(507)).toBe('quota');
  });

  it('falls back to the generic text', () => {
    expect(errorKeyFor(500)).toBe('generic');
    expect(errorKeyFor(0)).toBe('generic');
    expect(errorKeyFor(400, 'no_file')).toBe('generic');
  });
});
