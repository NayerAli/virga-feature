const MAX_LOGIN_ATTEMPTS = Number.parseInt(process.env.MAX_LOGIN_ATTEMPTS || '4', 10);
const LOCK_TIME_MINUTES = Number.parseInt(process.env.LOCK_TIME || '15', 10);
const LOCK_TIME_MS = LOCK_TIME_MINUTES * 60 * 1000;

function toSafeCounter(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isUserActive(user) {
  return Boolean(user && (user.is_active === 1 || user.is_active === true));
}

function clearExpiredLock(req) {
  const lockUntil = toSafeCounter(req.session.loginLockUntil);
  const loginAttempts = toSafeCounter(req.session.loginAttempts);

  if (lockUntil > 0 && lockUntil <= Date.now()) {
    req.session.loginAttempts = 0;
    req.session.loginLockUntil = 0;
    return true;
  }

  if (loginAttempts !== req.session.loginAttempts || lockUntil !== req.session.loginLockUntil) {
    req.session.loginAttempts = loginAttempts;
    req.session.loginLockUntil = lockUntil;
    return true;
  }

  return false;
}

function buildLoginMeta(req) {
  const loginAttempts = toSafeCounter(req.session.loginAttempts);
  const lockUntil = toSafeCounter(req.session.loginLockUntil);
  const isLocked = lockUntil > Date.now();
  const lockMinutesRemaining = isLocked
    ? Math.ceil((lockUntil - Date.now()) / 60000)
    : 0;

  return {
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - loginAttempts),
    isLocked,
    lockMinutesRemaining
  };
}

function lockAccount(req) {
  req.session.loginLockUntil = Date.now() + LOCK_TIME_MS;
}

module.exports = {
  MAX_LOGIN_ATTEMPTS,
  LOCK_TIME_MINUTES,
  LOCK_TIME_MS,
  toSafeCounter,
  isUserActive,
  clearExpiredLock,
  buildLoginMeta,
  lockAccount
};
