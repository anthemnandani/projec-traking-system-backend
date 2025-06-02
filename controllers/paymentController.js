const supabase = require("../config/supabase");
const { sendClientNotification } = require("../services/notificationService");
const dotenv = require('dotenv');
dotenv.config();

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
    res
      .status(500)
      .json({ error: error.message || "Failed to fetch payments" });
  }
};

const createPayment = async (req, res) => {
  try {
    const user = req.user;
    if (user.app_metadata.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized: Admin access required" });
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
      return res.status(400).json({
        error: "Task ID, client ID, amount, status, and due date are required",
      });
    }

    const { data, error } = await supabase
      .from("payments")
      .insert([
        {
          task_id,
          client_id,
          amount,
          status,
          due_date: new Date(due_date).toISOString(),
          invoice_number,
          notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw new Error("Failed to create payment");

    if (status === "invoiced") {
      await sendClientNotification(client_id, "payment_invoiced", {
        paymentId: data.id,
      });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error("Error creating payment:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to create payment" });
  }
};

const updatePayment = async (req, res) => {
  try {
    const user = req.user;
    if (user.app_metadata.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized: Admin access required" });
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
      await sendClientNotification(client_id, "payment_invoiced", {
        paymentId: id,
      });
    } else if (status === "received") {
      await sendClientNotification(client_id, "payment_received", {
        paymentId: id,
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error updating payment:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to update payment" });
  }
};

const deletePayment = async (req, res) => {
  try {
    const user = req.user;
    if (user.app_metadata.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized: Admin access required" });
    }

    const { id } = req.params;

    const { error } = await supabase.from("payments").delete().eq("id", id);

    if (error) throw new Error("Failed to delete payment");

    res.status(200).json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to delete payment" });
  }
};

const stripe = require("stripe")(
  `${process.env.STRIPE_SECRET_KEY}`
);

const makePayment = async (req, res) => {
  try {
    const { items, paymentId } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: item.price * 100,
        },
        quantity: item.quantity,
      })),
      success_url: `${process.env.FRONTEND_URL}/dashboard/payments/success`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/payments/cancel`,
      metadata: {
        paymentId,
      },
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    console.log('Webhook triggered');

    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log('✅ Stripe event type:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('Session received:', session);

      const transactionId = session.payment_intent;
      const paymentId = session.metadata?.paymentId;

      console.log('transactionId:', transactionId);
      console.log('paymentId:', paymentId);

      if (paymentId && transactionId) {
        const { error } = await supabase
          .from('payments')
          .update({
            status: 'received',
            received_at: new Date().toISOString(),
            transactionId,
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentId);

        if (error) {
          console.error('Supabase update error:', error.message);
        } else {
          console.log('Payment updated in DB');
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook Error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

module.exports = {
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
  makePayment,
  webhook
};
