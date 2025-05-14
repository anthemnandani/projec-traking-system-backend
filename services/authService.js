const supabase = require('../config/supabase');

const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Invalid email or password');
  return { user: data.user, session: data.session };
};

const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error('Failed to logout');
};

const forgotPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`
  });
  if (error) throw new Error('Failed to send reset email');
};

const resetPassword = async (password) => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('Invalid session');
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) throw new Error('Failed to reset password');
};

module.exports = { login, logout, forgotPassword, resetPassword };