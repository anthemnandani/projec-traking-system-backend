const { supabase, supabaseAdmin } = require("../config/supabase");
const nodemailer = require("nodemailer");
const { encrypt, decrypt } = require('../utils/crypto');
const { sendClientNotification } = require("../services/notificationService"); // Assume a notification service for clients

const getClients = async (req, res) => {
  try {
    const user = req.user;
    let query = supabase.from("clients").select("*");

    if (user.app_metadata.role !== "admin") {
      query = query.eq("id", user.app_metadata.clientId);
    }

    const { data, error } = await query;
    if (error) throw new Error("Failed to fetch clients");

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: error.message || "Failed to fetch clients" });
  }
};

const createClient = async (req, res) => {
  try {
    const token = req.cookies["sb-access-token"];
    if (!token) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Access token missing in cookies" });
    }

    // Get user from Supabase Auth using the access token
    const { data: userData, error: authError } = await supabase.auth.getUser(
      token
    );
    if (authError || !userData?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const user = userData.user;

    const { name, email, phone, address, status, notes } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !address || !status) {
      return res.status(400).json({
        error: "Name, email, phone, address, and status are required",
      });
    }

    // Validate status
    if (!["active", "idle", "gone"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Invalid status. Must be active, idle, or gone" });
    }

    console.log("Creating client:", {
      name,
      email,
      phone,
      address,
      status,
      notes,
      created_by: user.id,
    });

    const { data, error } = await supabase
      .from("clients")
      .insert([
        {
          name,
          email,
          phone,
          address,
          status,
          notes,
          has_account: false,
          created_by: user.id,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      if (error.code === "23505") {
        return res
          .status(400)
          .json({ error: "A client with this email already exists" });
      }
      return res
        .status(500)
        .json({ error: `Failed to create client: ${error.message}` });
    }

    console.log("Client created:", data);

    await sendClientNotification(data.id, "created");

    res.status(201).json(data);
  } catch (error) {
    console.error("Error creating client:", error);
    res.status(500).json({ error: error.message || "Failed to create client" });
  }
};

const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, status, notes, previousStatus } =
      req.body;

    const { data, error } = await supabase
      .from("clients")
      .update({
        name,
        email,
        phone,
        address,
        status,
        notes,
        updated_at: new Date(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error("Failed to update client");

    if (data.status !== previousStatus) {
      await sendClientNotification(data.id, "status_updated", {
        newStatus: data.status,
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ error: error.message || "Failed to update client" });
  }
};

const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("clients").delete().eq("id", id);

    if (error) {
      throw new Error("Failed to delete client");
    }

    // Send notification for client deletion
    await sendClientNotification(id, "deleted");

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting client:", error);
    res.status(500).json({ error: error.message || "Failed to delete client" });
  }
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'neeraj@antheminfotech.com',
    pass: 'pcwgfixsrnvingtv', // Use environment variable in production
  },
});

// Create Client Account and Send Credentials
const resendClientCredentials = async (req, res) => {
  try {
    const { email, password, name, client_id } = req.body;

    if (!email || !password || !name || !client_id)
      return res.status(400).json({ message: 'Missing fields' });

    // 1. Create user in Supabase Auth
    const { data: user, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'client',
        client_id,
      },
    });

    if (signUpError) throw signUpError;

    // 2. Encrypt and store password in custom users table
    const encryptedPassword = encrypt(password);

    const { error: insertError } = await supabaseAdmin.from('users').insert({
      id: user.user.id,
      email,
      name,
      role: 'client',
      client_id,
      password: encryptedPassword,
      created_at: new Date().toISOString(),
    });
    if (insertError) throw insertError;

    // 3. Mark client as having an account
    await supabaseAdmin.from('clients').update({ has_account: true }).eq('id', client_id);

    // 4. Send email with credentials
    await transporter.sendMail({
      from: 'neeraj@antheminfotech.com',
      to: email,
      subject: 'Your Client Account Credentials',
      html: `
        <h2>Welcome, ${name}</h2>
        <p>Your client account has been created successfully.</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
        <p>You can login here: <a href="http://localhost:8080/login">Login</a></p>
        <p>Please change your password after your first login.</p>
      `,
    });

    res.status(200).json({ message: 'Account created and credentials sent' });

  } catch (err) {
    console.error('Create Client Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Resend Credentials from Stored Encrypted Password
const resendCredentialsOnly = async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name)
      return res.status(400).json({ message: 'Missing fields' });

    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('password')
      .eq('email', email)
      .single();

    if (fetchError || !user)
      return res.status(404).json({ message: 'User not found or failed to fetch password' });

    // Decrypt password
    const originalPassword = decrypt(user.password);

    // Send email with original credentials
    await transporter.sendMail({
      from: 'neeraj@antheminfotech.com',
      to: email,
      subject: 'Your Client Account Credentials (Resend)',
      html: `
        <h2>Hello, ${name}</h2>
        <p>Your client account credentials are as follows:</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${originalPassword}</p>
        <p>Login here: <a href="http://localhost:8080/login">Login</a></p>
        <p>Please reset your password after first login if needed.</p>
      `,
    });

    res.status(200).json({ message: 'Credentials resent successfully' });

  } catch (err) {
    console.error('Resend Credentials Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getClients,
  createClient,
  updateClient,
  deleteClient,
  resendClientCredentials,
  resendCredentialsOnly
};
