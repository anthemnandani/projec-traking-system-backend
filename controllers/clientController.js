const supabase = require('../config/supabase');
const { sendClientNotification } = require('./notificationService'); // Assume a notification service for clients

// Fetch all clients (admin) or client-specific data (non-admin)
const getClients = async (req, res) => {
  try {
    const user = req.user; // Set by authenticate middleware
    let query = supabase.from('clients').select('*');

    if (user.app_metadata.role !== 'admin') {
      query = query.eq('id', user.app_metadata.clientId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error('Failed to fetch clients');
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch clients' });
  }
};

// Create a new client (admin only)
const createClient = async (req, res) => {
  try {
    const { name, email, phone, address, status, notes } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !address || !status) {
      return res.status(400).json({ error: 'Name, email, phone, address, and status are required' });
    }

    const { data, error } = await supabase
      .from('clients')
      .insert([{ name, email, phone, address, status, notes, has_account: false }])
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create client');
    }

    // Send notification for client creation
    await sendClientNotification(data.id, 'created');

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: error.message || 'Failed to create client' });
  }
};

// Update an existing client (admin only)
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, status, notes } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !address || !status) {
      return res.status(400).json({ error: 'Name, email, phone, address, and status are required' });
    }

    const { data, error } = await supabase
      .from('clients')
      .update({ name, email, phone, address, status, notes, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update client');
    }

    // Send notification if status changed
    if (data.status !== req.body.previousStatus) { // Assume frontend sends previousStatus
      await sendClientNotification(data.id, 'status_updated', { newStatus: data.status });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: error.message || 'Failed to update client' });
  }
};

// Delete a client (admin only)
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from('clients').delete().eq('id', id);

    if (error) {
      throw new Error('Failed to delete client');
    }

    // Send notification for client deletion
    await sendClientNotification(id, 'deleted');

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: error.message || 'Failed to delete client' });
  }
};

// Change client status (admin only)
const changeClientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'idle', 'gone'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be active, idle, or gone' });
    }

    const { data, error } = await supabase
      .from('clients')
      .update({ status, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update client status');
    }

    // Send notification for status change
    await sendClientNotification(id, 'status_updated', { newStatus: status });

    res.status(200).json(data);
  } catch (error) {
    console.error('Error changing client status:', error);
    res.status(500).json({ error: error.message || 'Failed to update client status' });
  }
};

// Create client account and send credentials (admin only)
const createClientAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Fetch client to ensure it exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (clientError || !client) {
      throw new Error('Client not found');
    }

    if (client.has_account) {
      return res.status(400).json({ error: 'Client already has an account' });
    }

    // Create user account in Supabase auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: client.email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'user',
        clientId: id,
        name: client.name,
      },
    });

    if (authError || !authData.user) {
      throw new Error('Failed to create client account');
    }

    // Update client to mark has_account as true
    const { error: updateError } = await supabase
      .from('clients')
      .update({ has_account: true, updated_at: new Date() })
      .eq('id', id);

    if (updateError) {
      throw new Error('Failed to update client account status');
    }

    // Send notification with credentials
    await sendClientNotification(id, 'account_created', {
      email: client.email,
      password, // In production, handle securely
    });

    res.status(200).json({ message: `Account created for ${client.email}` });
  } catch (error) {
    console.error('Error creating client account:', error);
    res.status(500).json({ error: error.message || 'Failed to create client account' });
  }
};

// Resend client credentials (admin only)
const resendClientCredentials = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch client to ensure it exists and has an account
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (clientError || !client) {
      throw new Error('Client not found');
    }

    if (!client.has_account) {
      return res.status(400).json({ error: 'Client does not have an account' });
    }

    // In a real app, generate a new temporary password or reset token
    // For simplicity, assume notification service handles credential delivery
    await sendClientNotification(id, 'credentials_resent', {
      email: client.email,
    });

    res.status(200).json({ message: `Credentials resent to ${client.email}` });
  } catch (error) {
    console.error('Error resending client credentials:', error);
    res.status(500).json({ error: error.message || 'Failed to resend client credentials' });
  }
};

module.exports = {
  getClients,
  createClient,
  updateClient,
  deleteClient,
  changeClientStatus,
  createClientAccount,
  resendClientCredentials,
};