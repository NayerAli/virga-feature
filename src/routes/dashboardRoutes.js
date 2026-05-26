const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { isAdminUser } = require('../middleware/authorization');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { search } = req.query;
    logger.debug(`Search query: ${search}`);
    const db = getDatabase();
    
    let query = `
      SELECT 
        ir.report_id,
        ir.created_at,
        ir.created_at,
        v.license_plate,
        v.brand,
        v.model,
        c.name as client_name,
        c.customer_id
      FROM InspectionReports ir
      LEFT JOIN Vehicules v ON ir.vehicule_id = v.vehicule_id
      LEFT JOIN Customers c ON v.customer_id = c.customer_id
    `;

    const params = [];
    
    const whereClauses = [];

    if (!isAdminUser(req.user)) {
      whereClauses.push('ir.created_by = ?');
      params.push(req.user.id);
    }

    if (search) {
      whereClauses.push(`(
        LOWER(v.license_plate) LIKE LOWER(?)
        OR LOWER(c.name) LIKE LOWER(?)
        OR LOWER(v.brand) LIKE LOWER(?)
        OR LOWER(v.model) LIKE LOWER(?)
      )`);
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (whereClauses.length > 0) {
      query += `
        WHERE ${whereClauses.join(' AND ')}
      `;
    }

    query += ' ORDER BY ir.created_at DESC';

    const reports = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    if (req.xhr) {
      return res.json({ reports });
    }
    
    res.render('dashboard', {
      reports,
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
      errors: ['Error loading reports'],
      user: req.session.user
    });
  }
});

module.exports = router;
