const express = require('express');
const bcrypt = require('bcrypt');
const { getUserWithPasswordByUsername } = require('../config/database');
const logger = require('../utils/logger');
const {
  MAX_LOGIN_ATTEMPTS,
  LOCK_TIME_MINUTES,
  clearExpiredLock,
  buildLoginMeta,
  lockAccount,
  isUserActive
} = require('../utils/loginLock');

const router = express.Router();

const SESSION_OP_TIMEOUT_MS = 10000;
// Hash pré-calculé pour uniformiser le temps de réponse (utilisateur inconnu / inactif).
const DUMMY_PASSWORD_HASH = '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxnRQ7XO9/MTt5p8.FmN/VN2.9.K6';

function renderLogin(res, { error = null, loginMeta, user = null } = {}) {
  return res.render('login', {
    error,
    errors: [],
    user,
    loginMeta,
    maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
    lockTimeMinutes: LOCK_TIME_MINUTES
  });
}

function runSessionOperation(operation, label) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, SESSION_OP_TIMEOUT_MS);

    operation((err) => {
      clearTimeout(timeout);
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function persistSessionIfNeeded(req) {
  if (clearExpiredLock(req)) {
    await runSessionOperation((cb) => req.session.save(cb), 'Session save');
  }
}

async function recordFailedLoginAttempt(req, res) {
  req.session.loginAttempts = Number(req.session.loginAttempts || 0) + 1;
  if (req.session.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    lockAccount(req);
  }

  try {
    await runSessionOperation((cb) => req.session.save(cb), 'Session save');
  } catch (err) {
    logger.error('Failed to persist login attempt counter:', err);
    return renderLogin(res, {
      error: 'Une erreur est survenue lors de la connexion',
      loginMeta: buildLoginMeta(req)
    });
  }

  const loginMeta = buildLoginMeta(req);
  return renderLogin(res, {
    error: 'Identifiants invalides',
    loginMeta
  });
}

router.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

router.get('/login', async (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  try {
    await persistSessionIfNeeded(req);
    return renderLogin(res, { loginMeta: buildLoginMeta(req) });
  } catch (err) {
    logger.error('Login page error:', err);
    return renderLogin(res, {
      error: 'Une erreur est survenue lors de la connexion',
      loginMeta: buildLoginMeta(req)
    });
  }
});

router.post('/login', async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  try {
    await persistSessionIfNeeded(req);
    const loginMeta = buildLoginMeta(req);

    if (loginMeta.isLocked) {
      return renderLogin(res, {
        error: null,
        loginMeta
      });
    }

    if (!username || !password) {
      return recordFailedLoginAttempt(req, res);
    }

    const user = await getUserWithPasswordByUsername(username);

    if (!user || !isUserActive(user)) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return recordFailedLoginAttempt(req, res);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return recordFailedLoginAttempt(req, res);
    }

    const sessionUser = {
      id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      username: user.username,
      role: user.role.toLowerCase()
    };

    await runSessionOperation(
      (cb) => req.session.regenerate(cb),
      'Session regeneration'
    );

    req.session.user = sessionUser;
    req.session.loginAttempts = 0;
    req.session.loginLockUntil = 0;

    await runSessionOperation(
      (cb) => req.session.save(cb),
      'Session save'
    );

    logger.info('Login succeeded', { user_id: user.user_id });
    return res.redirect('/dashboard');
  } catch (err) {
    logger.error('Login error:', err);
    return renderLogin(res, {
      error: 'Une erreur est survenue lors de la connexion',
      loginMeta: buildLoginMeta(req)
    });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) logger.error('Session destruction error:', err);
    res.redirect('/auth/login');
  });
});

module.exports = router;
