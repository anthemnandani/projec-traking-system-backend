const { supabase, supabaseAdmin } = require('../config/supabase');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    console.log('Attempting login for:', email);

    // Authenticate with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Supabase auth error:', error.message);
      return res.status(400).json({
        error: error.message.includes('Email not confirmed')
          ? 'Email not confirmed. Please check your email for the confirmation link.'
          : 'Invalid email or password'
      });
    }

    const userId = data.user.id;

    // Fetch user details from your custom "users" table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email, phone, role, client_id, avatar_url, notification_preferences, appearance_settings, created_at, updated_at, last_login')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('User fetch error:', userError?.message || 'No user data');
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Update last_login timestamp
    const { error: updateError } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);
    if (updateError) {
      console.error('Failed to update last_login:', updateError.message);
    }

    const user = {
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

    // Send Supabase token instead of custom JWT
    const accessToken = data.session.access_token;

    console.log('Login successful for:', email);
    return res.status(200).json({ user, session: data.session, token: accessToken });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({ error: 'Login failed. Please try again later.' });
  }
};

const register = async (req, res) => {
  try {
    // Validate Supabase client
    if (!supabase || !supabaseAdmin) {
      console.error('Supabase client not initialized');
      throw new Error('Server configuration error: Supabase client not initialized');
    }

    // Validate request body
    if (!req.body) {
      console.error('Request body is missing');
      return res.status(400).json({ error: 'Request body is missing' });
    }
    const { email, password, name, role, phone, client_id, avatar_url } = req.body;
    if (!email || !password || !name || !role) {
      console.error('Missing required fields:', { email, password, name, role });
      return res.status(400).json({ error: 'Email, password, name, and role are required' });
    }

    // Validate role
    const validRoles = ['admin', 'user'];
    if (!validRoles.includes(role)) {
      console.error('Invalid role:', role);
      return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!passwordRegex.test(password)) {
      console.error('Invalid password format');
      return res.status(400).json({
        error: 'Password must contain at least 1 uppercase letter, 1 number, 1 special character, and be at least 6 characters long'
      });
    }

    console.log('Checking for existing user in users table:', email);

    // Check if email exists in users table
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    if (existingUser) {
      console.error('Email already registered in users table:', email);
      return res.status(400).json({ error: 'Email already registered' });
    }
    if (userCheckError && userCheckError.code !== 'PGRST116') { // PGRST116: no rows found
      console.error('User check error:', userCheckError.message);
      throw new Error('Failed to check existing user');
    }

    console.log('Attempting Supabase auth registration for:', email);

    // Register user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role }
      }
    });
    if (error) {
      console.error('Supabase auth error:', error.message, error);
      if (error.message.includes('already registered')) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      throw new Error(error.message || 'Registration failed');
    }

    if (!data.user) {
      console.error('No user returned from Supabase:', data);
      throw new Error('Failed to create user');
    }

    console.log('Supabase user created with ID:', data.user.id);

    // Auto-confirm email
    const { error: confirmError } = await supabaseAdmin.auth.updateUserById(
      data.user.id,
      { email_confirm: true }
    );
    if (confirmError) {
      console.error('Error auto-confirming email:', confirmError.message);
      // Clean up: Delete user from auth.users if confirmation fails
      try {
        await supabaseAdmin.auth.deleteUser(data.user.id);
        console.log('Cleaned up unconfirmed auth user:', data.user.id);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError.message);
      }
      throw new Error('Failed to confirm email');
    }

    console.log('Email auto-confirmed for:', email);

    // Default notification preferences and appearance settings
    const defaultNotificationPreferences = {
      app_tasks: true,
      app_clients: true,
      email_tasks: true,
      app_payments: true,
      email_clients: true,
      email_payments: true
    };
    const defaultAppearanceSettings = {
      theme: 'dark',
      density: 'default',
      sticky_sidebar: true,
      collapsed_sidebar: false
    };

    console.log('Inserting user data into users table for ID:', data.user.id);

    // Insert user data into users table
    const now = new Date().toISOString();
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: data.user.id,
          email,
          name,
          role,
          phone: phone || null,
          client_id: client_id || null,
          avatar_url: avatar_url || null,
          notification_preferences: defaultNotificationPreferences,
          appearance_settings: defaultAppearanceSettings,
          created_at: now,
          updated_at: now,
          last_login: null
        }
      ])
      .select('id, name, email, phone, role, client_id, avatar_url, notification_preferences, appearance_settings, created_at, updated_at, last_login')
      .single();

    if (userError || !userData) {
      console.error('User insert error:', userError?.message || 'No user data');
      // Clean up: Delete user from auth.users if users table insert fails
      try {
        const { error: deleteError } = await supabaseAdmin.auth.deleteUser(data.user.id);
        if (deleteError) {
          console.error('Failed to clean up auth user:', deleteError.message);
        } else {
          console.log('Cleaned up orphaned auth user:', data.user.id);
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError.message);
      }
      throw new Error('Failed to create user profile');
    }

    console.log('User data inserted successfully for:', email);

    // Generate custom JWT
    const customToken = jwt.sign(
      { userId: userData.id, email: userData.email, role: userData.role, name: userData.name },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Combine auth user data with users table data
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

    console.log('Registration successful for:', email);
    res.status(201).json({ user: userResponse, session: data.session, token: customToken });
  } catch (error) {
    console.error('Registration error:', error.message, error.stack);
    res.status(400).json({ error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error('Failed to logout');
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout failed:', error);
    res.status(500).json({ error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      console.error('Email is required');
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('Sending password reset email for:', email);

    // Send password reset email via Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `http://localhost:8080/reset-password`
    });
    if (error) {
      console.error('Supabase reset password error:', error.message);
      throw new Error('Failed to send reset email');
    }

    console.log('Password reset email sent to:', email);
    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error.message, error.stack);
    res.status(400).json({ error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must contain at least 1 uppercase letter, 1 number, 1 special character, and be at least 6 characters long',
      });
    }

    // Extract the token from the Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }

    // Get the user using the token
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.getUser(token);

    if (getUserError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Update the password using admin privileges
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password,
    });

    if (updateError) {
      return res.status(500).json({ error: 'Failed to reset password' });
    }

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { login, register, logout, forgotPassword, resetPassword };