const express = require('express');
const clientController = require('../controllers/clientController');

const router = express.Router();

router.get('/', clientController.getClients);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient); 
router.delete('/:id', clientController.deleteClient);
// router.post('/:id/account', clientController.createClientAccount); 
router.post('/resend-credentials', clientController.resendClientCredentials);
router.post('/resend-credentials-only', clientController.resendCredentialsOnly);

module.exports = router;