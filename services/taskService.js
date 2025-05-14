const supabase = require('../config/supabase');
const { sendTaskNotification } = require('./notificationService');

const getTasks = async (user) => {
  let query = supabase.from('tasks').select('*');
  if (user.app_metadata.role !== 'admin') {
    query = query.eq('client_id', user.app_metadata.clientId);
  }
  const { data, error } = await query;
  if (error) throw new Error('Failed to fetch tasks');
  return data;
};

const createTask = async (task, user) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([task])
    .select()
    .single();
  if (error) throw new Error('Failed to create task');
  
  // Send task creation notification
  await sendTaskNotification(data.id, 'created');
  
  return data;
};

const updateTask = async (id, task) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(task)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error('Failed to update task');
  
  if (task.status === 'complete' && task.completed_at) {
    await sendTaskNotification(id, 'completed');
  }
  
  return data;
};

const deleteTask = async (id) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) throw new Error('Failed to delete task');
};

module.exports = { getTasks, createTask, updateTask, deleteTask };