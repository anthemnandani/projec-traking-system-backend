const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

const getCurrentUser = async (req, res) => {
  try {
    let token;

    // 1. Try reading token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies['sb-access-token']) {
      // 2. Fallback: Try reading token from cookie
      token = req.cookies['sb-access-token'];
    }

    if (!token) {
      return res.status(401).json({ error: 'Token not found' });
    }

    // Supabase Auth Token can't be verified manually like custom JWT
    // So instead, call Supabase Auth API to get the user
    const { data: userInfo, error } = await supabase.auth.getUser(token);
    if (error || !userInfo?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = userInfo.user.id;

    // Now get user data from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.status(200).json(userData);
  } catch (error) {
    console.error('Error getting user:', error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};


module.exports = { getCurrentUser };