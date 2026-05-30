const express = require('express');
const {
  listBarbers,
  createBarber,
  updateBarber,
  updateBarberPermissions,
  listServices,
  createService,
  updateService,
  deleteService,
  getBusiness,
  patchBusiness,
  listAppointments,
  patchAppointment,
  listClients,
  getClient,
  patchClient,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  listMonthClosings,
  createMonthClosing,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustProductStock,
  listSales,
  createSale,
} = require('../controllers/platformTenantOpsController');

const router = express.Router({ mergeParams: true });

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/barbers', wrap(listBarbers));
router.post('/barbers', wrap(createBarber));
router.patch('/barbers/:barberId', wrap(updateBarber));
router.patch('/barbers/:barberId/permissions', wrap(updateBarberPermissions));

router.get('/services', wrap(listServices));
router.post('/services', wrap(createService));
router.put('/services/:serviceId', wrap(updateService));
router.delete('/services/:serviceId', wrap(deleteService));

router.get('/business', wrap(getBusiness));
router.patch('/business', wrap(patchBusiness));

router.get('/appointments', wrap(listAppointments));
router.patch('/appointments/:appointmentId', wrap(patchAppointment));

router.get('/clients', wrap(listClients));
router.get('/clients/:clientId', wrap(getClient));
router.patch('/clients/:clientId', wrap(patchClient));

router.get('/expenses', wrap(listExpenses));
router.post('/expenses', wrap(createExpense));
router.put('/expenses/:expenseId', wrap(updateExpense));
router.delete('/expenses/:expenseId', wrap(deleteExpense));

router.get('/month-closings', wrap(listMonthClosings));
router.post('/month-closings', wrap(createMonthClosing));

router.get('/products', wrap(listProducts));
router.post('/products', wrap(createProduct));
router.put('/products/:productId', wrap(updateProduct));
router.delete('/products/:productId', wrap(deleteProduct));
router.patch('/products/:productId/stock', wrap(adjustProductStock));

router.get('/sales', wrap(listSales));
router.post('/sales', wrap(createSale));

module.exports = router;
