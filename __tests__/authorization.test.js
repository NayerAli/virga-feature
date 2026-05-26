jest.mock('../src/config/database', () => ({
  getDatabase: jest.fn()
}));

const { getDatabase } = require('../src/config/database');
const {
  canAccessReport,
  requireAdmin,
  requireReportAccess,
  requireSelfOrAdmin
} = require('../src/middleware/authorization');

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis()
  };

  return res;
};

describe('authorization middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('canAccessReport allows admins and report owners only', () => {
    expect(canAccessReport({ id: 'admin-id', role: 'admin' }, { created_by: 'other-id' })).toBe(true);
    expect(canAccessReport({ id: 'owner-id', role: 'mechanic' }, { created_by: 'owner-id' })).toBe(true);
    expect(canAccessReport({ id: 'user-id', role: 'mechanic' }, { created_by: 'other-id' })).toBe(false);
  });

  test('requireAdmin denies non-admin users', () => {
    const req = {
      method: 'GET',
      path: '/api-secure',
      session: { user: { id: 'user-id', role: 'mechanic' } },
      user: { id: 'user-id', role: 'mechanic' }
    };
    const res = createResponse();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('requireSelfOrAdmin allows self access', () => {
    const req = {
      params: { id: 'user-id' },
      session: { user: { id: 'user-id', role: 'mechanic' } },
      user: { id: 'user-id', role: 'mechanic' }
    };
    const res = createResponse();
    const next = jest.fn();

    requireSelfOrAdmin('id', { responseType: 'json' })(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('requireReportAccess returns 404 when the report does not exist', async () => {
    getDatabase.mockReturnValue({
      get: (_query, _params, callback) => callback(null, null)
    });

    const req = {
      method: 'GET',
      path: '/api-inspection-report/missing',
      params: { id: 'missing' },
      session: { user: { id: 'user-id', role: 'mechanic' } },
      user: { id: 'user-id', role: 'mechanic' }
    };
    const res = createResponse();
    const next = jest.fn();

    await requireReportAccess('id', { responseType: 'json' })(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Report not found' });
  });

  test('requireReportAccess returns 403 for non-owners', async () => {
    getDatabase.mockReturnValue({
      get: (_query, _params, callback) => callback(null, {
        report_id: 'report-id',
        created_by: 'owner-id',
        vehicule_id: 'vehicule-id'
      })
    });

    const req = {
      method: 'GET',
      path: '/api-inspection-report/report-id',
      params: { id: 'report-id' },
      session: { user: { id: 'other-id', role: 'mechanic' } },
      user: { id: 'other-id', role: 'mechanic' }
    };
    const res = createResponse();
    const next = jest.fn();

    await requireReportAccess('id', { responseType: 'json' })(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Accès interdit.' });
  });

  test('requireReportAccess allows the report owner', async () => {
    getDatabase.mockReturnValue({
      get: (_query, _params, callback) => callback(null, {
        report_id: 'report-id',
        created_by: 'owner-id',
        vehicule_id: 'vehicule-id'
      })
    });

    const req = {
      method: 'GET',
      path: '/api-inspection-report/report-id',
      params: { id: 'report-id' },
      session: { user: { id: 'owner-id', role: 'mechanic' } },
      user: { id: 'owner-id', role: 'mechanic' }
    };
    const res = createResponse();
    const next = jest.fn();

    await requireReportAccess('id', { responseType: 'json' })(req, res, next);

    expect(req.reportAccess).toEqual({
      report_id: 'report-id',
      created_by: 'owner-id',
      vehicule_id: 'vehicule-id'
    });
    expect(next).toHaveBeenCalled();
  });
});
