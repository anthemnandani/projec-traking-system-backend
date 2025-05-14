const express = require('express');
const { authenticate, restrictToAdmin } = require('../utils/authMiddleware');
const clientController = require('../controllers/clientController');

const router = express.Router();

router.use(authenticate); // Require authentication for all routes
router.get('/', clientController.getClients); // Fetch clients
router.post('/', restrictToAdmin, clientController.createClient); // Create client
router.put('/:id', restrictToAdmin, clientController.updateClient); // Update client
router.delete('/:id', restrictToAdmin, clientController.deleteClient); // Delete client
router.patch('/:id/status', restrictToAdmin, clientController.changeClientStatus); // Change client status
router.post('/:id/account', restrictToAdmin, clientController.createClientAccount); // Create client account
router.post('/:id/resend-credentials', restrictToAdmin, clientController.resendClientCredentials); // Resend credentials

module.exports = router;