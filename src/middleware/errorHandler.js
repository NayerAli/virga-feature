const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  logger.error('Unhandled error:', err);

  const errorMessage = err.message || 'Une erreur interne est survenue';
  const statusCode = err.status || 500;

  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
    return res.status(statusCode).json({ error: errorMessage });
  }

  if (req.flash) {
    req.flash('error', errorMessage);
  }

  return res.status(statusCode).render('error', {
    message: errorMessage,
    user: req.session?.user || null,
    success: req.flash ? req.flash('success') : [],
    error: req.flash ? req.flash('error') : []
  });
};
