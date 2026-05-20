const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const { optionalAuthMiddleware } = require('../middlewares/authMiddleware');
const { requireTenant, requireTenantAuthMatch } = require('../middlewares/tenantMiddleware');
const platformAuthMiddleware = require('../middlewares/platformAuthMiddleware');

const authRoutes = require('./authRoutes');
const customerAuthRoutes = require('./customerAuthRoutes');
const barberRoutes = require('./barberRoutes');
const clientRoutes = require('./clientRoutes');
const { getServices, createService, updateService, deleteService } = require('../controllers/serviceController');
const {
  getAppointments,
  getPublicAppointments,
  createAppointment,
  updateAppointment,
} = require('../controllers/appointmentController');
const {
  getProducts,
  createProduct,
  deleteProduct,
  updateProduct,
  adjustProductStock,
  getSales,
  createSale,
} = require('../controllers/productController');
const { getBusinessInfo, updateBusinessInfo } = require('../controllers/businessController');
const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const { getMonthClosings, createMonthClosing } = require('../controllers/monthClosingController');
const { cachePublic } = require('../middlewares/publicCache');
const { getPublicBootstrap } = require('../controllers/publicBootstrapController');
const { resolveTenant } = require('../controllers/tenantController');
const {
  platformLogin,
  listTenants,
  createTenant,
  updateTenantStatus,
} = require('../controllers/platformController');
const { getPeriodClosings, createPeriodClosing } = require('../controllers/periodClosingController');

const router = express.Router();

// Platform (sem tenant) — sub-router isolado do requireTenant
const platformRouter = express.Router();
platformRouter.post('/login', platformLogin);
platformRouter.get('/tenants', platformAuthMiddleware, listTenants);
platformRouter.post('/tenants', platformAuthMiddleware, createTenant);
platformRouter.patch('/tenants/:id/status', platformAuthMiddleware, updateTenantStatus);
router.use('/platform', platformRouter);

router.get('/tenant/resolve/:slug', resolveTenant);

// Rotas com escopo de barbearia
router.use(requireTenant);

router.use('/auth', authRoutes);
router.use('/customer-auth', customerAuthRoutes);

router.get('/public/bootstrap', cachePublic(50), getPublicBootstrap);
router.get('/services', cachePublic(120), getServices);
router.get('/business', cachePublic(300), getBusinessInfo);
router.get('/appointments/public', cachePublic(45), getPublicAppointments);
router.post('/appointments', optionalAuthMiddleware, requireTenantAuthMatch, createAppointment);

const { getPublicScheduleBlocks } = require('../controllers/scheduleBlockController');
router.get('/schedule-blocks/public', cachePublic(60), getPublicScheduleBlocks);

router.use(requireTenantAuthMatch);

router.use('/barbers', barberRoutes);
router.use('/clients', authMiddleware, clientRoutes);
router.get('/appointments', authMiddleware, getAppointments);
router.patch('/appointments/:id', authMiddleware, updateAppointment);

router.post('/services', authMiddleware, createService);
router.put('/services/:id', authMiddleware, updateService);
router.delete('/services/:id', authMiddleware, deleteService);

router.get('/products', authMiddleware, getProducts);
router.post('/products', authMiddleware, createProduct);
router.patch('/products/:id/stock', authMiddleware, adjustProductStock);
router.put('/products/:id', authMiddleware, updateProduct);
router.delete('/products/:id', authMiddleware, deleteProduct);
router.get('/sales', authMiddleware, getSales);
router.post('/sales', authMiddleware, createSale);

router.get('/expenses', authMiddleware, getExpenses);
router.post('/expenses', authMiddleware, createExpense);
router.put('/expenses/:id', authMiddleware, updateExpense);
router.delete('/expenses/:id', authMiddleware, deleteExpense);

router.get('/month-closings', authMiddleware, getMonthClosings);
router.post('/month-closings', authMiddleware, createMonthClosing);

router.put('/business', authMiddleware, updateBusinessInfo);

router.get('/period-closings', authMiddleware, getPeriodClosings);
router.post('/period-closings', authMiddleware, createPeriodClosing);

module.exports = router;
