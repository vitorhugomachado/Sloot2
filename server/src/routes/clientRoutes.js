const express = require('express');
const {
  listClients,
  getClientStats,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  promoteFromAppointment,
  exportCsv
} = require('../controllers/clientController');

const router = express.Router();

router.get('/', listClients);
router.get('/stats', getClientStats);
router.get('/export', exportCsv);
router.post('/', createClient);
router.post('/promote', promoteFromAppointment);
router.get('/:id', getClientById);
router.patch('/:id', updateClient);
router.delete('/:id', deleteClient);

module.exports = router;
