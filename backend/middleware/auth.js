const MOCK_USERS = {
  netrunnerX: { id: 'netrunnerX', role: 'contributor' },
  reliefAdmin: { id: 'reliefAdmin', role: 'admin' },
};

export const mockAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (userId && MOCK_USERS[userId]) {
    req.user = MOCK_USERS[userId];
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Provide a valid x-user-id header (netrunnerX or reliefAdmin).' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden. Admin role required.' });
  }
};