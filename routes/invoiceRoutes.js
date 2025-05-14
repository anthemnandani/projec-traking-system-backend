const express = require('express');
const { authenticate, restrictToAdmin } = require('../utils/authMiddleware');
const invoiceController = require('../controllers/invoiceController');

const router = express.Router();

router.use(authenticate);
router.get('/', invoiceController.getInvoices);
router.post('/', restrictToAdmin, invoiceController.createInvoice);
router.put('/:id', restrictToAdmin, invoiceController.updateInvoice);
router.delete('/:id', restrictToAdmin, invoiceController.deleteInvoice);

module.exports = router;