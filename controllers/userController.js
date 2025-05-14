const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

const getCurrentUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    // Verify custom JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.error('Invalid custom JWT:', error.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch user data from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, phone, role, client_id, avatar_url, notification_preferences, appearance_settings, created_at, updated_at, last_login')
      .eq('id', decoded.userId)
      .single();
    if (userError || !userData) {
      console.error('User fetch error:', userError?.message || 'No user data');
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userResponse = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      clientId: userData.client_id,
      phone: userData.phone,
      avatar_url: userData.avatar_url,
      notification_preferences: userData.notification_preferences,
      appearance_settings: userData.appearance_settings,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
      last_login: userData.last_login
    };

    console.log('User data fetched for:', userData.email);
    res.status(200).json(userResponse);
  } catch (error) {
    console.error('Get user error:', error.message, error.stack);
    res.status(400).json({ error: error.message });
  }
};

module.exports = { getCurrentUser };