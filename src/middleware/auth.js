const isAuthenticated = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  // Make user data available to all views AND to req.user
  res.locals.user = req.session.user;
  req.user = req.session.user;
  next();
};

const isAdmin = (req, res, next) => {
  const role = req.user && typeof req.user.role === 'string' ? req.user.role.toLowerCase().trim() : '';
  if (role === 'admin') {
    return next();
  }

  const wantsJson = req.xhr
    || (req.headers.accept && req.headers.accept.includes('application/json'))
    || req.method !== 'GET'
    || /^\/(users|customers|vehicules|inspectionItems|reports)(\/|$)/.test(req.path);

  if (wantsJson) {
    return res.status(403).json({
      error: 'Accès interdit. Vous n\'êtes pas autorisé à accéder à cette section.'
    });
  }

  return res.status(403).render('error', {
    message: 'Accès interdit. Vous n\'êtes pas autorisé à accéder à cette section.',
    errors: [],
    user: req.session.user
  });
};

module.exports = {
  isAuthenticated,
  isAdmin
};
