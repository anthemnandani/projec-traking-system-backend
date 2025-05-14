const supabase = require('../config/supabase');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header provided' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

const restrictToAdmin = (req, res, next) => {
  if (req.user.app_metadata.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can perform this action' });
  }
  next();
};

module.exports = { authenticate, restrictToAdmin };