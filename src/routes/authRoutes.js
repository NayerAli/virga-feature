const express = require('express');
const bcrypt = require('bcrypt');
const { getUserWithPasswordByUsername } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();
const MAX_LOGIN_ATTEMPTS = Number.parseInt(process.env.MAX_LOGIN_ATTEMPTS || '4', 10);
const LOCK_TIME_MS = Number.parseInt(process.env.LOCK_TIME || '15', 10) * 60 * 1000;

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
      req.session.loginAttempts = Number(req.session.loginAttempts || 0) + 1;
      if (req.session.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        req.session.loginLockUntil = Date.now() + LOCK_TIME_MS;
      }

      return req.session.save(() => {
        res.render('login', {
          error: 'Identifiants invalides',
          errors: [],
          user: null
        });
      });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      req.session.loginAttempts = Number(req.session.loginAttempts || 0) + 1;
      if (req.session.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        req.session.loginLockUntil = Date.now() + LOCK_TIME_MS;
      }

      return req.session.save(() => {
        res.render('login', {
          error: 'Identifiants invalides',
          errors: [],
          user: null
        });
      });
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        logger.error('Session regeneration error:', regenerateError);
        return res.render('login', {
          error: 'Une erreur est survenue lors de la connexion',
          errors: [],
          user: null
        });
      }

      req.session.user = {
        id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        username: user.username,
        role: user.role.toLowerCase()
      };
      req.session.loginAttempts = 0;
      req.session.loginLockUntil = 0;

      req.session.save((err) => {
        if (err) {
          logger.error('Session save error:', err);
          return res.render('login', {
            error: 'Une erreur est survenue lors de la connexion',
            errors: [],
            user: null
          });
        }

        return res.redirect('/dashboard');
      });
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.render('login', {
      error: 'Une erreur est survenue lors de la connexion',
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
