const express = require('express');
const bodyParser = require("body-parser");
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.get('/', paymentController.getPayments);
router.post('/', paymentController.createPayment);
router.put('/:id', paymentController.updatePayment);
router.delete('/:id', paymentController.deletePayment);
router.post('/create-checkout-session', paymentController.makePayment);
router.post('/webhook', bodyParser.raw({ type: "application/json" }), paymentController.webhook);

module.exports = router;