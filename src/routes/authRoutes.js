const express = require('express');
const bcrypt = require('bcrypt');
const { getUserWithPasswordByUsername } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();
const MAX_LOGIN_ATTEMPTS = Number.parseInt(process.env.MAX_LOGIN_ATTEMPTS || '4', 10);
const LOCK_TIME_MS = Number.parseInt(process.env.LOCK_TIME || '15', 10) * 60 * 1000;

const SESSION_OP_TIMEOUT_MS = 10000;

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

async function recordFailedLoginAttempt(req, res) {
  req.session.loginAttempts = Number(req.session.loginAttempts || 0) + 1;
  if (req.session.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    req.session.loginLockUntil = Date.now() + LOCK_TIME_MS;
  }

  await runSessionOperation((cb) => req.session.save(cb), 'Session save');
  return res.render('login', {
    error: 'Identifiants invalides',
    errors: [],
    user: null
  });
}

router.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', {
    error: null,
    errors: [],
    user: null
  });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const lockUntil = Number(req.session.loginLockUntil || 0);

  if (lockUntil > Date.now()) {
    return res.render('login', {
      error: 'Identifiants invalides',
      errors: [],
      user: null
    });
  }

  try {
    const user = await getUserWithPasswordByUsername(username);

    if (!user || !user.is_active) {
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
    const isSessionError = err.message?.includes('Session');
    res.render('login', {
      error: isSessionError
        ? 'Une erreur est survenue lors de la connexion'
        : 'Une erreur est survenue lors de la connexion',
      errors: [],
      user: null
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
