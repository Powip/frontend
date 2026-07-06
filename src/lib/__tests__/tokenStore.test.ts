import { tokenStore } from '@/lib/tokenStore';

describe('tokenStore', () => {
  afterEach(() => {
    tokenStore.set(null);
  });

  it('inicia con valor null', () => {
    expect(tokenStore.get()).toBeNull();
  });

  it('set(token) guarda el token y get() lo devuelve', () => {
    tokenStore.set('access-token-abc');
    expect(tokenStore.get()).toBe('access-token-abc');
  });

  it('set(null) limpia el token', () => {
    tokenStore.set('access-token-abc');
    tokenStore.set(null);
    expect(tokenStore.get()).toBeNull();
  });
});
