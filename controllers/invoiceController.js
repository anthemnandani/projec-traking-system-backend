const invoiceService = require('../services/invoiceService');

const getInvoices = async (req, res) => {
  try {
    const invoices = await invoiceService.getInvoices(req.user);
    res.status(200).json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.createInvoice(req.body);
    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
    res.status(200).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    await invoiceService.deleteInvoice(req.params.id);
    res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getInvoices, createInvoice, updateInvoice, deleteInvoice };