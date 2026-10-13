import { hashPassword, verifyPassword } from './password-hash';

describe('password hash', () => {
  it('stores scrypt params, a salt and the hash, never the password', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash).toMatch(
      /^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/,
    );
    expect(hash).not.toContain('correct horse');
  });

  it('salts every hash', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('m3ow-m3ow');
    expect(await verifyPassword('m3ow-m3ow', hash)).toBe(true);
    expect(await verifyPassword('m3ow-m3oW', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('treats composed and decomposed Unicode as the same password', async () => {
    // "й" typed as и + combining breve, then as the single code point.
    const hash = await hashPassword('мишйка');
    expect(await verifyPassword('мишйка', hash)).toBe(true);
  });

  it('honours the params stored with the hash', async () => {
    const hash = await hashPassword('cheap', { N: 1024, r: 8, p: 1 });
    expect(hash.startsWith('scrypt$1024$8$1$')).toBe(true);
    expect(await verifyPassword('cheap', hash)).toBe(true);
  });

  it.each([
    'not-a-hash',
    'bcrypt$10$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    // N above the cap, and N not a power of two: refused, not computed.
    'scrypt$1048576$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'scrypt$1000$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ])('rejects a malformed stored value: %s', async (stored) => {
    expect(await verifyPassword('anything', stored)).toBe(false);
  });
});
