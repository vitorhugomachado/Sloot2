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
  getTenant,
  createTenant,
  updateTenant,
  updateTenantManager,
  updateTenantStatus,
  updateTenantModules,
  getPlatformStats,
  listPlatformAdmins,
  createPlatformAdmin,
  updatePlatformAdmin,
  updatePlatformAdminStatus,
} = require('../controllers/platformController');
const requireTenantModule = require('../middlewares/requireTenantModule');
const { getPeriodClosings, createPeriodClosing } = require('../controllers/periodClosingController');
const {
  requireStaff,
  getVapidPublicKeyHandler,
  subscribePush,
  unsubscribePush,
} = require('../controllers/pushController');
const requirePlatformTenant = require('../middlewares/requirePlatformTenant');
const platformTenantOpsRoutes = require('./platformTenantOpsRoutes');

const router = express.Router();

// Platform (sem tenant) — sub-router isolado do requireTenant
const platformRouter = express.Router();
platformRouter.post('/login', platformLogin);
platformRouter.get('/stats', platformAuthMiddleware, getPlatformStats);
platformRouter.get('/admins', platformAuthMiddleware, listPlatformAdmins);
platformRouter.post('/admins', platformAuthMiddleware, createPlatformAdmin);
platformRouter.patch('/admins/:id', platformAuthMiddleware, updatePlatformAdmin);
platformRouter.patch('/admins/:id/status', platformAuthMiddleware, updatePlatformAdminStatus);
platformRouter.get('/tenants', platformAuthMiddleware, listTenants);
platformRouter.get('/tenants/:id', platformAuthMiddleware, getTenant);
platformRouter.post('/tenants', platformAuthMiddleware, createTenant);
platformRouter.patch('/tenants/:id', platformAuthMiddleware, updateTenant);
platformRouter.patch('/tenants/:id/manager', platformAuthMiddleware, updateTenantManager);
platformRouter.patch('/tenants/:id/modules', platformAuthMiddleware, updateTenantModules);
platformRouter.patch('/tenants/:id/status', platformAuthMiddleware, updateTenantStatus);
platformRouter.use('/tenants/:id', platformAuthMiddleware, requirePlatformTenant, platformTenantOpsRoutes);
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
router.use('/clients', authMiddleware, requireTenantModule('clients'), clientRoutes);
router.get('/appointments', authMiddleware, requireTenantModule('scheduler'), getAppointments);
router.patch('/appointments/:id', authMiddleware, requireTenantModule('scheduler'), updateAppointment);

router.get('/push/vapid-public-key', authMiddleware, requireStaff, getVapidPublicKeyHandler);
router.post('/push/subscribe', authMiddleware, requireStaff, subscribePush);
router.delete('/push/unsubscribe', authMiddleware, requireStaff, unsubscribePush);

router.post('/services', authMiddleware, createService);
router.put('/services/:id', authMiddleware, updateService);
router.delete('/services/:id', authMiddleware, deleteService);

router.get('/products', authMiddleware, requireTenantModule('inventory'), getProducts);
router.post('/products', authMiddleware, requireTenantModule('inventory'), createProduct);
router.patch('/products/:id/stock', authMiddleware, requireTenantModule('inventory'), adjustProductStock);
router.put('/products/:id', authMiddleware, requireTenantModule('inventory'), updateProduct);
router.delete('/products/:id', authMiddleware, requireTenantModule('inventory'), deleteProduct);
router.get('/sales', authMiddleware, requireTenantModule('inventory'), getSales);
router.post('/sales', authMiddleware, requireTenantModule('inventory'), createSale);

router.get('/expenses', authMiddleware, requireTenantModule('finance'), getExpenses);
router.post('/expenses', authMiddleware, requireTenantModule('finance'), createExpense);
router.put('/expenses/:id', authMiddleware, requireTenantModule('finance'), updateExpense);
router.delete('/expenses/:id', authMiddleware, requireTenantModule('finance'), deleteExpense);

router.get('/month-closings', authMiddleware, requireTenantModule('finance'), getMonthClosings);
router.post('/month-closings', authMiddleware, requireTenantModule('finance'), createMonthClosing);

router.put('/business', authMiddleware, requireTenantModule('settings'), updateBusinessInfo);

router.get('/period-closings', authMiddleware, requireTenantModule('finance'), getPeriodClosings);
router.post('/period-closings', authMiddleware, requireTenantModule('finance'), createPeriodClosing);

module.exports = router;
