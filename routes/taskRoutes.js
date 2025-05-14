const express = require('express');
const { authenticate, restrictToAdmin } = require('../utils/authMiddleware');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.use(authenticate);
router.get('/', taskController.getTasks);
router.post('/', restrictToAdmin, taskController.createTask);
router.put('/:id', restrictToAdmin, taskController.updateTask);
router.delete('/:id', restrictToAdmin, taskController.deleteTask);

module.exports = router;