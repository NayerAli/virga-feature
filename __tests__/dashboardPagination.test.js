const request = require('supertest');
const path = require('path');
const express = require('express');
require('dotenv').config({ path: path.join(__dirname, '.env.test') });

const dashboardRoutes = require('../src/routes/dashboardRoutes');
const { initializeDatabase, getDatabase } = require('../src/config/database');

const TEST_CUSTOMER_ID = 'pagination-customer';
const TEST_USER_ID = 'pagination-user';
const REPORT_PREFIX = 'pagination-report-';
const VEHICULE_PREFIX = 'pagination-vehicule-';

const run = (db, query, params = []) => new Promise((resolve, reject) => {
  db.run(query, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const createTestApp = () => {
  const app = express();
  app.use((req, res, next) => {
    req.session = {
      user: {
        id: TEST_USER_ID,
        username: 'pagination-user',
        role: 'admin'
      }
    };
    res.locals.user = req.session.user;
    next();
  });
  app.use('/dashboard', dashboardRoutes);
  return app;
};

const cleanupPaginationData = async (db) => {
  await run(db, 'DELETE FROM InspectionReports WHERE report_id LIKE ?', [`${REPORT_PREFIX}%`]);
  await run(db, 'DELETE FROM Vehicules WHERE vehicule_id LIKE ?', [`${VEHICULE_PREFIX}%`]);
  await run(db, 'DELETE FROM Customers WHERE customer_id = ?', [TEST_CUSTOMER_ID]);
};

const seedPaginationData = async (db) => {
  await run(db, `
    INSERT INTO Customers (customer_id, name, phone, email, address, is_company)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [TEST_CUSTOMER_ID, 'Client Pagination', '0000000000', 'pagination@test.local', 'Test', false]);

  for (let index = 1; index <= 12; index += 1) {
    const paddedIndex = String(index).padStart(3, '0');
    const vehiculeId = `${VEHICULE_PREFIX}${paddedIndex}`;
    const reportId = `${REPORT_PREFIX}${paddedIndex}`;
    const licensePlate = `PG-${paddedIndex}-AB`;
    const createdAt = `2026-05-${String(index).padStart(2, '0')} 10:00:00`;

    await run(db, `
      INSERT INTO Vehicules (vehicule_id, license_plate, customer_id, brand, model)
      VALUES (?, ?, ?, ?, ?)
    `, [vehiculeId, licensePlate, TEST_CUSTOMER_ID, 'Peugeot', `Pagination ${paddedIndex}`]);

    await run(db, `
      INSERT INTO InspectionReports (
        report_id,
        vehicule_id,
        mileage,
        comments,
        inspection_results,
        created_by,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [reportId, vehiculeId, index * 1000, 'Test pagination', '{}', TEST_USER_ID, createdAt]);
  }
};

describe('Dashboard pagination', () => {
  let app;
  let db;

  beforeAll(async () => {
    await initializeDatabase();
    db = getDatabase();
    await cleanupPaginationData(db);
    await seedPaginationData(db);
    app = createTestApp();
  }, 15000);

  afterAll(async () => {
    if (db) {
      await cleanupPaginationData(db);
    }
  });

  test('returns the first page with total count and next-page metadata', async () => {
    const response = await request(app)
      .get('/dashboard?search=Client%20Pagination&page=1&pageSize=5')
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(response.statusCode).toBe(200);
    expect(response.body.reports).toHaveLength(5);
    expect(response.body.pagination).toEqual(expect.objectContaining({
      currentPage: 1,
      pageSize: 5,
      totalReports: 12,
      totalPages: 3,
      hasPreviousPage: false,
      hasNextPage: true,
      startItem: 1,
      endItem: 5
    }));
  });

  test('clamps an out-of-range page to the last page', async () => {
    const response = await request(app)
      .get('/dashboard?search=Client%20Pagination&page=999&pageSize=5')
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(response.statusCode).toBe(200);
    expect(response.body.reports).toHaveLength(2);
    expect(response.body.pagination).toEqual(expect.objectContaining({
      currentPage: 3,
      pageSize: 5,
      totalReports: 12,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: false,
      startItem: 11,
      endItem: 12
    }));
  });

  test('keeps normalized license plate search compatible with pagination', async () => {
    const response = await request(app)
      .get('/dashboard?search=PG005AB&page=1&pageSize=5')
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(response.statusCode).toBe(200);
    expect(response.body.reports).toHaveLength(1);
    expect(response.body.reports[0].license_plate).toBe('PG-005-AB');
    expect(response.body.pagination).toEqual(expect.objectContaining({
      currentPage: 1,
      pageSize: 5,
      totalReports: 1,
      totalPages: 1,
      startItem: 1,
      endItem: 1
    }));
  });
});
