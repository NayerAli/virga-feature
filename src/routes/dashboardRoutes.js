const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { canViewAllReports } = require('../middleware/authorization');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const DEFAULT_PAGE_SIZE = 10;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { search } = req.query;
    const requestedPage = parsePositiveInteger(req.query.page, 1);
    const requestedPageSize = parsePositiveInteger(req.query.pageSize, DEFAULT_PAGE_SIZE);
    const allowedPageSizes = [10, 25, 50];
    const pageSize = allowedPageSizes.includes(requestedPageSize)
      ? requestedPageSize
      : DEFAULT_PAGE_SIZE;
    logger.debug(`Search query: ${search || ''}`);
    const db = getDatabase();

    const baseQuery = `
      FROM InspectionReports ir
      LEFT JOIN Vehicules v ON ir.vehicule_id = v.vehicule_id
      LEFT JOIN Customers c ON v.customer_id = c.customer_id
    `;

    const whereConditions = [];
    const whereParams = [];

    if (!canViewAllReports(req.user)) {
      whereConditions.push('ir.created_by = ?');
      whereParams.push(req.user.id);
    }

    if (search) {
      whereConditions.push(`
        (
          LOWER(v.license_plate) LIKE LOWER(?)
          OR REPLACE(REPLACE(LOWER(v.license_plate), '-', ''), ' ', '') LIKE ?
          OR LOWER(c.name) LIKE LOWER(?)
          OR LOWER(v.brand) LIKE LOWER(?)
          OR LOWER(v.model) LIKE LOWER(?)
        )
      `);
      const searchParam = `%${search}%`;
      const normalizedSearch = String(search).replace(/[\s-]/g, '').toLowerCase();
      const normalizedPlateSearch = normalizedSearch ? `%${normalizedSearch}%` : '__NO_PLATE_MATCH__';
      whereParams.push(searchParam, normalizedPlateSearch, searchParam, searchParam, searchParam);
    }

    const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const totalReports = await new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) as total ${baseQuery} ${whereClause}`, whereParams, (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.total : 0);
      });
    });

    const totalPages = Math.max(Math.ceil(totalReports / pageSize), 1);
    const currentPage = Math.min(requestedPage, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const query = `
      SELECT
        ir.report_id,
        ir.created_at,
        v.license_plate,
        v.brand,
        v.model,
        c.name as client_name,
        c.customer_id
      ${baseQuery}
      ${whereClause}
      ORDER BY ir.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const reports = await new Promise((resolve, reject) => {
      db.all(query, [...whereParams, pageSize, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const pagination = {
      currentPage,
      pageSize,
      totalReports,
      totalPages,
      hasPreviousPage: currentPage > 1,
      hasNextPage: currentPage < totalPages,
      previousPage: currentPage > 1 ? currentPage - 1 : 1,
      nextPage: currentPage < totalPages ? currentPage + 1 : totalPages,
      startItem: totalReports > 0 ? offset + 1 : 0,
      endItem: Math.min(offset + reports.length, totalReports)
    };

    if (req.xhr) {
      return res.json({ reports, pagination });
    }

    res.render('dashboard', {
      reports,
      pagination,
      search: search || '',
      errors: [],
      success: req.flash('success'),
      user: req.session.user
    });
  } catch (error) {
    logger.error('Error loading dashboard:', error);
    if (req.xhr) {
      return res.status(500).json({ error: 'Error loading reports' });
    }
    res.render('dashboard', {
      reports: [],
      pagination: {
        currentPage: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalReports: 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
        previousPage: 1,
        nextPage: 1,
        startItem: 0,
        endItem: 0
      },
      search: '',
      errors: ['Error loading reports'],
      user: req.session.user
    });
  }
});

module.exports = router;
