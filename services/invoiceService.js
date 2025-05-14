const supabase = require('../config/supabase');

const getInvoices = async (user) => {
  let query = supabase.from('invoices').select('*');
  if (user.app_metadata.role !== 'admin') {
    query = query.eq('client_id', user.app_metadata.clientId);
  }
  const { data, error } = await query;
  if (error) throw new Error('Failed to fetch invoices');
  return data;
};

const createInvoice = async (invoice) => {
  const { data, error } = await supabase
    .from('invoices')
    .insert([invoice])
    .select()
    .single();
  if (error) throw new Error('Failed to create invoice');
  return data;
};

const updateInvoice = async (id, invoice) => {
  const { data, error } = await supabase
    .from('invoices')
    .update(invoice)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error('Failed to update invoice');
  return data;
};

const deleteInvoice = async (id) => {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);
  if (error) throw new Error('Failed to delete invoice');
};

module.exports = { getInvoices, createInvoice, updateInvoice, deleteInvoice };