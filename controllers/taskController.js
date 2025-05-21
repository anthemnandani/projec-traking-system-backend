const supabase = require('../config/supabase');
const { sendTaskNotification } = require('../services/notificationService');

// Get tasks (admin sees all, others see only their client tasks)
const getTasks = async (req, res) => {
  try {
    const user = req.user;

    let query = supabase.from('tasks').select('*');

    if (user.app_metadata.role !== 'admin') {
      query = query.eq('client_id', user.app_metadata.clientId);
    }

    const { data, error } = await query;

    if (error) throw new Error('Failed to fetch tasks');

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: error.message || "Failed to fetch tasks" });
  }
};

// Create task
const createTask = async (req, res) => {
  try {
    const {
      title,
      client_id,
      description,
      status,
      estimated_hours,
      estimated_cost,
      project,
      due_date,
    } = req.body;

    if (!title || !client_id || !status) {
      return res.status(400).json({ error: 'Title, client ID, and status are required' });
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        title,
        client_id,
        description,
        status,
        estimated_hours,
        estimated_cost,
        project,
        due_date: due_date ? new Date(due_date).toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw new Error('Failed to create task');

    await sendTaskNotification(data.id, 'created');

    res.status(201).json(data);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: error.message || "Failed to create task" });
  }
};

// Update task
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error('Failed to update task');

    if (updateData.status === 'complete' && updateData.completed_at) {
      await sendTaskNotification(id, 'completed');
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: error.message || "Failed to update task" });
  }
};

// Delete task
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw new Error('Failed to delete task');

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: error.message || "Failed to delete task" });
  }
};

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask
};
