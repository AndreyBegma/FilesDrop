/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { describeFailure } from './errors';
import { isThumbnailable, rawPath } from './links';

describe('describeFailure', () => {
  test('maps API reasons to copy and a cat pose', () => {
    expect(describeFailure(413, { reason: 'too_large' })).toEqual({
      key: 'tooBig',
      pose: 'too-big',
    });
    expect(describeFailure(507, { reason: 'quota_exceeded' })).toEqual({
      key: 'boxFull',
      pose: 'empty',
    });
    expect(describeFailure(400, { reason: 'blocked_address' }).key).toBe(
      'blockedAddress',
    );
    expect(describeFailure(400, { reason: 'scheme_not_allowed' }).key).toBe(
      'invalidUrl',
    );
    expect(describeFailure(422, { reason: 'remote_status' }).key).toBe(
      'remoteStatus',
    );
    expect(describeFailure(408, { reason: 'timeout' }).key).toBe('timeout');
  });

  test('falls back to the status when there is no reason', () => {
    expect(describeFailure(429, undefined).key).toBe('rateLimited');
    expect(describeFailure(415, 'html body').key).toBe('denied');
    expect(describeFailure(500, undefined)).toEqual({
      key: 'unknown',
      pose: 'error',
    });
  });

  test('no answer is offline or a network error', () => {
    expect(describeFailure(undefined, undefined, false)).toEqual({
      key: 'offline',
      pose: 'offline',
    });
    expect(describeFailure(0, undefined, true).key).toBe('network');
  });
});

describe('links', () => {
  test('raw path keeps the extension, or none', () => {
    expect(rawPath({ slug: 'abc12345', ext: 'png' })).toBe('/f/abc12345.png');
    expect(rawPath({ slug: 'abc12345', ext: '' })).toBe('/f/abc12345');
  });

  test('only inline raster images get a thumbnail', () => {
    expect(isThumbnailable({ mime: 'image/png', inline: true })).toBe(true);
    expect(isThumbnailable({ mime: 'image/svg+xml', inline: false })).toBe(
      false,
    );
    expect(isThumbnailable({ mime: 'video/mp4', inline: true })).toBe(false);
  });
});
