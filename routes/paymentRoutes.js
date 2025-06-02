const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.get('/', paymentController.getPayments);
router.post('/', paymentController.createPayment);
router.put('/:id', paymentController.updatePayment);
router.delete('/:id', paymentController.deletePayment);
router.post('/create-checkout-session', paymentController.makePayment);
router.post('/verify', paymentController.verifyPayment);
router.post('/webhook', paymentController.webhook);

module.exports = router;