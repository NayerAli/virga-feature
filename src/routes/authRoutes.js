const express = require('express');
const bcrypt = require('bcrypt');
const { getUserWithPasswordByUsername } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

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

  try {
    const user = await getUserWithPasswordByUsername(username);

    if (!user) {
      logger.warn('Login failed: unknown username');
      return res.render('login', { 
        error: 'Invalid username',
        errors: [],
        user: null
      });
    }

    if (!user.is_active) {
      logger.warn('Login denied: inactive user', { user_id: user.user_id });
      return res.render('login', { 
        error: 'User is disabled, contact your administrator',
        errors: [],
        user: null
      });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      logger.warn('Login failed: invalid password', { user_id: user.user_id });
      return res.render('login', { 
        error: 'Mot de passe incorrect',
        errors: [],
        user: null
      });
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
        ? `An error occurred during login (${err.message})`
        : 'An error occurred during login (login error)',
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
