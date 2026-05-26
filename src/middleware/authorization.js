const { getDatabase } = require('../config/database');

const isAdminUser = (user) => Boolean(
  user &&
  typeof user.role === 'string' &&
  user.role.toLowerCase() === 'admin'
);

const canAccessReport = (user, report) => Boolean(
  user &&
  report &&
  (isAdminUser(user) || report.created_by === user.id)
);

const renderError = (req, res, statusCode, message) => (
  res.status(statusCode).render('error', {
    message,
    errors: [],
    user: req.session.user
  })
);

const sendError = (req, res, statusCode, message, responseType = 'auto') => {
  if (responseType === 'html') {
    return renderError(req, res, statusCode, message);
  }

  if (responseType === 'json') {
    return res.status(statusCode).json({ error: message });
  }

  if (req.path.includes('/api-') || req.xhr || req.method !== 'GET') {
    return res.status(statusCode).json({ error: message });
  }

  return renderError(req, res, statusCode, message);
};

const getReportAccessRecord = (reportId) => new Promise((resolve, reject) => {
  const db = getDatabase();
  db.get(
    'SELECT report_id, created_by, vehicule_id FROM InspectionReports WHERE report_id = ?',
    [reportId],
    (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row || null);
    }
  );
});

const resolveParam = (req, paramOrResolver, fallback = 'id') => {
  if (typeof paramOrResolver === 'function') {
    return paramOrResolver(req);
  }

  return req.params[paramOrResolver || fallback];
};

const requireAdmin = (req, res, next) => {
  const user = req.user || req.session.user;
  if (isAdminUser(user)) {
    return next();
  }

  return sendError(req, res, 403, 'Accès interdit.');
};

const requireSelfOrAdmin = (paramOrResolver = 'id', options = {}) => (req, res, next) => {
  const user = req.user || req.session.user;
  const targetUserId = resolveParam(req, paramOrResolver);

  if (user && (isAdminUser(user) || user.id === targetUserId)) {
    return next();
  }

  return sendError(req, res, 403, 'Accès interdit.', options.responseType);
};

const requireReportAccess = (paramOrResolver = 'id', options = {}) => async (req, res, next) => {
  try {
    const reportId = resolveParam(req, paramOrResolver);
    const report = await getReportAccessRecord(reportId);

    if (!report) {
      return sendError(req, res, 404, 'Report not found', options.responseType);
    }

    const user = req.user || req.session.user;
    if (!canAccessReport(user, report)) {
      return sendError(req, res, 403, 'Accès interdit.', options.responseType);
    }

    req.reportAccess = report;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  canAccessReport,
  isAdminUser,
  requireAdmin,
  requireReportAccess,
  requireSelfOrAdmin
};
