const supabase = require("../config/supabase");
const { sendClientNotification } = require("../services/notificationService");

const getPayments = async (req, res) => {
  try {
    const user = req.user;
    let query = supabase.from("payments").select("*");

    if (user.app_metadata.role !== "admin") {
      query = query.eq("client_id", user.app_metadata.clientId);
    }

    const { data, error } = await query;
    if (error) throw new Error("Failed to fetch payments");

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payments" });
  }
};

const createPayment = async (req, res) => {
  try {
    const user = req.user;
    if (user.app_metadata.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const {
      task_id,
      client_id,
      amount,
      status,
      due_date,
      invoice_number,
      notes,
    } = req.body;

    if (!task_id || !client_id || !amount || !status || !due_date) {
      return res.status(400).json({ error: "Task ID, client ID, amount, status, and due date are required" });
    }

    const { data, error } = await supabase
      .from("payments")
      .insert([{
        task_id,
        client_id,
        amount,
        status,
        due_date: new Date(due_date).toISOString(),
        invoice_number,
        notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw new Error("Failed to create payment");

    if (status === "invoiced") {
      await sendClientNotification(client_id, "payment_invoiced", { paymentId: data.id });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ error: error.message || "Failed to create payment" });
  }
};

const updatePayment = async (req, res) => {
  try {
    const user = req.user;
    if (user.app_metadata.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const { id } = req.params;
    const {
      task_id,
      client_id,
      amount,
      status,
      due_date,
      invoice_number,
      notes,
      received_at,
    } = req.body;

    const updateData = {
      task_id,
      client_id,
      amount,
      status,
      due_date: due_date ? new Date(due_date).toISOString() : null,
      invoice_number,
      notes,
      received_at: received_at ? new Date(received_at).toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error("Failed to update payment");

    if (status === "received" && !received_at) {
      updateData.received_at = new Date().toISOString();
      await supabase
        .from("payments")
        .update({ received_at: updateData.received_at })
        .eq("id", id);
    }

    if (status === "invoiced") {
      await sendClientNotification(client_id, "payment_invoiced", { paymentId: id });
    } else if (status === "received") {
      await sendClientNotification(client_id, "payment_received", { paymentId: id });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ error: error.message || "Failed to update payment" });
  }
};

const deletePayment = async (req, res) => {
  try {
    const user = req.user;
    if (user.app_metadata.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", id);

    if (error) throw new Error("Failed to delete payment");

    res.status(200).json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ error: error.message || "Failed to delete payment" });
  }
};

module.exports = {
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
};