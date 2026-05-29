const request = require('supertest');
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Store = require('express-session/session/store');

require('dotenv').config({ path: path.join(__dirname, '.env.test') });

process.env.NODE_ENV = 'test';
process.env.MAX_LOGIN_ATTEMPTS = process.env.MAX_LOGIN_ATTEMPTS || '4';
process.env.LOCK_TIME = process.env.LOCK_TIME || '15';

jest.mock('../src/config/database', () => ({
  getUserWithPasswordByUsername: jest.fn()
}));

const { getUserWithPasswordByUsername } = require('../src/config/database');
const authRoutes = require('../src/routes/authRoutes');

const LOCK_TIME_MS =
  Number.parseInt(process.env.LOCK_TIME || '15', 10) * 60 * 1000;

const INVALID_CREDENTIALS = {
  username: 'auth-lockout-invalid-user',
  password: 'wrong-password'
};

const VALID_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME,
  password: process.env.ADMIN_PASSWORD
};

const LOCK_INDICATORS = [
  /Trop de tentatives de connexion/i,
  /Compte temporairement verrouill/i,
  /temporairement verrouill/i,
  /loginMeta[^]*isLocked\s*:\s*true/i,
  /"isLocked"\s*:\s*true/
];

class MemorySessionStore extends session.Store {
  constructor() {
    super();
    this.sessions = Object.create(null);
  }

  get(sid, callback) {
    callback(null, this.sessions[sid] || null);
  }

  set(sid, sessionData, callback) {
    this.sessions[sid] = sessionData;
    callback(null);
  }

  destroy(sid, callback) {
    delete this.sessions[sid];
    callback(null);
  }
}

function createAuthTestApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../src/views'));
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    store: new MemorySessionStore(),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  }));
  app.use('/auth', authRoutes);

  return app;
}

function responseIndicatesLock(res) {
  const html = res.text || '';
  return LOCK_INDICATORS.some((pattern) => pattern.test(html));
}

function postLogin(agent, credentials) {
  return agent.post('/auth/login').type('form').send(credentials);
}

const originalStoreRegenerate = Store.prototype.regenerate;
let failNextRegenerate = false;
let validUserPasswordHash;

describe('POST /auth/login lockout', () => {
  let app;

  beforeAll(async () => {
    validUserPasswordHash = await bcrypt.hash(
      process.env.ADMIN_PASSWORD,
      Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '4', 10)
    );

    getUserWithPasswordByUsername.mockImplementation(async (username) => {
      if (username === process.env.ADMIN_USERNAME) {
        return {
          user_id: 'auth-test-admin-id',
          first_name: process.env.ADMIN_FIRST_NAME,
          last_name: process.env.ADMIN_LAST_NAME,
          email: process.env.ADMIN_EMAIL,
          username: process.env.ADMIN_USERNAME,
          password: validUserPasswordHash,
          role: 'admin',
          is_active: 1
        };
      }
      return null;
    });

    Store.prototype.regenerate = function regenerate(req, callback) {
      if (failNextRegenerate) {
        failNextRegenerate = false;
        callback(new Error('Session regeneration failed'));
        return;
      }
      return originalStoreRegenerate.call(this, req, callback);
    };

    app = createAuthTestApp();
  });

  afterAll(() => {
    Store.prototype.regenerate = originalStoreRegenerate;
  });

  beforeEach(() => {
    failNextRegenerate = false;
    jest.clearAllMocks();
    getUserWithPasswordByUsername.mockImplementation(async (username) => {
      if (username === process.env.ADMIN_USERNAME) {
        return {
          user_id: 'auth-test-admin-id',
          first_name: process.env.ADMIN_FIRST_NAME,
          last_name: process.env.ADMIN_LAST_NAME,
          email: process.env.ADMIN_EMAIL,
          username: process.env.ADMIN_USERNAME,
          password: validUserPasswordHash,
          role: 'admin',
          is_active: 1
        };
      }
      return null;
    });
  });

  test('after 4 invalid attempts, the response indicates an active lock', async () => {
    const agent = request.agent(app);
    let fourthResponse;

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      fourthResponse = await postLogin(agent, INVALID_CREDENTIALS);
    }

    expect(fourthResponse.status).toBe(200);
    expect(responseIndicatesLock(fourthResponse)).toBe(true);
  });

  test('valid credentials during an active lock are not redirected to /dashboard', async () => {
    const agent = request.agent(app);

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await postLogin(agent, INVALID_CREDENTIALS);
    }

    const response = await postLogin(agent, VALID_CREDENTIALS);

    expect(response.status).not.toBe(302);
    if (response.status === 302) {
      expect(response.headers.location).not.toMatch(/\/dashboard$/);
    }
    expect(responseIndicatesLock(response)).toBe(true);
  });

  test('after the lock expires, valid login redirects to /dashboard', async () => {
    const agent = request.agent(app);

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await postLogin(agent, INVALID_CREDENTIALS);
    }

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + LOCK_TIME_MS + 1000);

    try {
      const response = await postLogin(agent, VALID_CREDENTIALS);
      expect(response.status).toBe(302);
      expect(response.headers.location).toMatch(/\/dashboard$/);
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('session errors do not increment loginAttempts toward lockout', async () => {
    const agent = request.agent(app);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await postLogin(agent, INVALID_CREDENTIALS);
    }

    failNextRegenerate = true;
    const sessionErrorResponse = await postLogin(agent, VALID_CREDENTIALS);

    expect(sessionErrorResponse.status).toBe(200);
    expect(sessionErrorResponse.text).toMatch(/Une erreur est survenue lors de la connexion/i);
    expect(responseIndicatesLock(sessionErrorResponse)).toBe(false);

    const lockoutResponse = await postLogin(agent, INVALID_CREDENTIALS);
    expect(lockoutResponse.status).toBe(200);
    expect(responseIndicatesLock(lockoutResponse)).toBe(true);
  });

  test('empty credentials return the same invalid-credentials feedback without a server error', async () => {
    const agent = request.agent(app);

    const response = await postLogin(agent, { username: '   ', password: '' });

    expect(response.status).toBe(200);
    expect(response.text).toMatch(/Identifiants invalides/i);
    expect(response.text).not.toMatch(/Une erreur est survenue lors de la connexion/i);
  });

  test('inactive users cannot log in and receive invalid-credentials feedback', async () => {
    getUserWithPasswordByUsername.mockImplementation(async (username) => {
      if (username === process.env.ADMIN_USERNAME) {
        return {
          user_id: 'auth-test-admin-id',
          first_name: process.env.ADMIN_FIRST_NAME,
          last_name: process.env.ADMIN_LAST_NAME,
          email: process.env.ADMIN_EMAIL,
          username: process.env.ADMIN_USERNAME,
          password: validUserPasswordHash,
          role: 'admin',
          is_active: 0
        };
      }
      return null;
    });

    const agent = request.agent(app);
    const response = await postLogin(agent, VALID_CREDENTIALS);

    expect(response.status).toBe(200);
    expect(response.text).toMatch(/Identifiants invalides/i);
    expect(response.text).not.toMatch(/Une erreur est survenue lors de la connexion/i);
  });
});
