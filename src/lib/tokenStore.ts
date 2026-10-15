let _accessToken: string | null = null;
let _scope: string | null = null;
let _epoch = 0;
let _active = false;

export interface SessionSnapshot {
  token: string | null;
  epoch: number;
  active: boolean;
}

export const tokenStore = {
  get: () => _accessToken,
  snapshot: (): SessionSnapshot => ({ token: _accessToken, epoch: _epoch, active: _active }),
  isCurrent: (session: SessionSnapshot) => session.epoch === _epoch,
  set: (token: string | null, scope: string | null = null) => {
    if (token === null || scope !== _scope || (scope === null && token !== _accessToken)) {
      ++_epoch;
    }
    _accessToken = token;
    _scope = scope;
    _active = Boolean(token);
  },
  // Login starts a new boundary before its profile requests finish, even when
  // the next account happens to receive the same bearer text.
  invalidate: () => {
    ++_epoch;
    _active = false;
  },
};
