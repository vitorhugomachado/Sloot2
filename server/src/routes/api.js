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
const {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
} = require('../controllers/purchaseOrderController');
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
  createManualService,
  createManualProduct,
} = require('../controllers/financeManualController');
const {
  getCurrentCash,
  listCashSessions,
  getCashSession,
  openCash,
  closeCash,
  reopenCash,
  createCashMovement,
} = require('../controllers/cashController');
const {
  listComandas,
  getComanda,
  createComanda,
  createDirectSale,
  updateComandaItems,
  settleComanda,
  reverseComanda,
  cancelComanda,
} = require('../controllers/comandaController');
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listFinanceExpenses,
  createFinanceExpense,
  updateFinanceExpense,
  deleteFinanceExpense,
  reverseFinanceExpense,
  payFinanceExpense,
  getLedgerSummary,
  getCashFlow,
  getCommissions,
  listCommissionPayouts,
  createCommissionPayout,
  getAccountBalances,
  transferAccounts,
  listClosings,
  createClosing,
  getDre,
  getAuditLog,
  getKpis,
  listCardFees,
  upsertCardFee,
} = require('../controllers/financeV2Controller');
const {
  requireStaff,
  getVapidPublicKeyHandler,
  subscribePush,
  unsubscribePush,
  testPush,
} = require('../controllers/pushController');
const requirePlatformTenant = require('../middlewares/requirePlatformTenant');
const platformTenantOpsRoutes = require('./platformTenantOpsRoutes');
const {
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
} = require('../controllers/billingController');

const router = express.Router();

function requireBillingManager(req, res, next) {
  if (req.user?.role !== 'Gerente') {
    return res.status(403).json({ message: 'Apenas o gerente pode gerenciar a assinatura.' });
  }
  next();
}

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
router.get('/billing/status', authMiddleware, requireBillingManager, getBillingStatus);
router.post('/billing/checkout', authMiddleware, requireBillingManager, createCheckoutSession);
router.post('/billing/portal', authMiddleware, requireBillingManager, createPortalSession);
router.get('/appointments', authMiddleware, requireTenantModule('scheduler'), getAppointments);
router.patch('/appointments/:id', authMiddleware, requireTenantModule('scheduler'), updateAppointment);

router.get('/push/vapid-public-key', authMiddleware, requireStaff, getVapidPublicKeyHandler);
router.post('/push/subscribe', authMiddleware, requireStaff, subscribePush);
router.post('/push/test', authMiddleware, requireStaff, testPush);
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

router.get('/purchase-orders', authMiddleware, requireTenantModule('inventory'), listPurchaseOrders);
router.get('/purchase-orders/:id', authMiddleware, requireTenantModule('inventory'), getPurchaseOrder);
router.post('/purchase-orders', authMiddleware, requireTenantModule('inventory'), createPurchaseOrder);
router.put('/purchase-orders/:id', authMiddleware, requireTenantModule('inventory'), updatePurchaseOrder);
router.post('/purchase-orders/:id/cancel', authMiddleware, requireTenantModule('inventory'), cancelPurchaseOrder);
router.post('/purchase-orders/:id/receive', authMiddleware, requireTenantModule('inventory'), receivePurchaseOrder);

router.get('/expenses', authMiddleware, requireTenantModule('finance'), getExpenses);
router.post('/expenses', authMiddleware, requireTenantModule('finance'), createExpense);
router.put('/expenses/:id', authMiddleware, requireTenantModule('finance'), updateExpense);
router.delete('/expenses/:id', authMiddleware, requireTenantModule('finance'), deleteExpense);

router.get('/month-closings', authMiddleware, requireTenantModule('finance'), getMonthClosings);
router.post('/month-closings', authMiddleware, requireTenantModule('finance'), createMonthClosing);

router.put('/business', authMiddleware, requireTenantModule('settings'), updateBusinessInfo);

router.get('/period-closings', authMiddleware, requireTenantModule('finance'), getPeriodClosings);
router.post('/period-closings', authMiddleware, requireTenantModule('finance'), createPeriodClosing);

router.post('/finance/manual-service', authMiddleware, requireTenantModule('finance'), createManualService);
router.post('/finance/manual-product', authMiddleware, requireTenantModule('finance'), createManualProduct);

// Financeiro V2 — caixa, comandas, extrato, fluxo
router.get('/cash/current', authMiddleware, requireTenantModule('finance'), getCurrentCash);
router.get('/cash/sessions', authMiddleware, requireTenantModule('finance'), listCashSessions);
router.get('/cash/sessions/:id', authMiddleware, requireTenantModule('finance'), getCashSession);
router.post('/cash/open', authMiddleware, requireTenantModule('finance'), openCash);
router.post('/cash/sessions/:id/reopen', authMiddleware, requireTenantModule('finance'), reopenCash);
router.post('/cash/close', authMiddleware, requireTenantModule('finance'), closeCash);
router.post('/cash/movements', authMiddleware, requireTenantModule('finance'), createCashMovement);

router.get('/comandas', authMiddleware, requireTenantModule('finance'), listComandas);
router.get('/comandas/:id', authMiddleware, requireTenantModule('finance'), getComanda);
router.post('/comandas', authMiddleware, requireTenantModule('finance'), createComanda);
router.post('/comandas/direct-sale', authMiddleware, requireTenantModule('finance'), createDirectSale);
router.put('/comandas/:id/items', authMiddleware, requireTenantModule('finance'), updateComandaItems);
router.post('/comandas/:id/settle', authMiddleware, requireTenantModule('finance'), settleComanda);
router.post('/comandas/:id/reverse', authMiddleware, requireTenantModule('finance'), reverseComanda);
router.post('/comandas/:id/cancel', authMiddleware, requireTenantModule('finance'), cancelComanda);

router.get('/finance-v2/categories', authMiddleware, requireTenantModule('finance'), listCategories);
router.post('/finance-v2/categories', authMiddleware, requireTenantModule('finance'), createCategory);
router.put('/finance-v2/categories/:id', authMiddleware, requireTenantModule('finance'), updateCategory);
router.delete('/finance-v2/categories/:id', authMiddleware, requireTenantModule('finance'), deleteCategory);
router.get('/finance-v2/expenses', authMiddleware, requireTenantModule('finance'), listFinanceExpenses);
router.post('/finance-v2/expenses', authMiddleware, requireTenantModule('finance'), createFinanceExpense);
router.put('/finance-v2/expenses/:id', authMiddleware, requireTenantModule('finance'), updateFinanceExpense);
router.post('/finance-v2/expenses/:id/pay', authMiddleware, requireTenantModule('finance'), payFinanceExpense);
router.post('/finance-v2/expenses/:id/reverse', authMiddleware, requireTenantModule('finance'), reverseFinanceExpense);
router.delete('/finance-v2/expenses/:id', authMiddleware, requireTenantModule('finance'), deleteFinanceExpense);
router.get('/finance-v2/ledger', authMiddleware, requireTenantModule('finance'), getLedgerSummary);
router.get('/finance-v2/cash-flow', authMiddleware, requireTenantModule('finance'), getCashFlow);
router.get('/finance-v2/commissions', authMiddleware, requireTenantModule('finance'), getCommissions);
router.get('/finance-v2/commissions/payouts', authMiddleware, requireTenantModule('finance'), listCommissionPayouts);
router.post('/finance-v2/commissions/payouts', authMiddleware, requireTenantModule('finance'), createCommissionPayout);
router.get('/finance-v2/card-fees', authMiddleware, requireTenantModule('finance'), listCardFees);
router.put('/finance-v2/card-fees', authMiddleware, requireTenantModule('finance'), upsertCardFee);
router.get('/finance-v2/accounts/balances', authMiddleware, requireTenantModule('finance'), getAccountBalances);
router.post('/finance-v2/accounts/transfer', authMiddleware, requireTenantModule('finance'), transferAccounts);
router.get('/finance-v2/closings', authMiddleware, requireTenantModule('finance'), listClosings);
router.post('/finance-v2/closings', authMiddleware, requireTenantModule('finance'), createClosing);
router.get('/finance-v2/dre', authMiddleware, requireTenantModule('finance'), getDre);
router.get('/finance-v2/audit', authMiddleware, requireTenantModule('finance'), getAuditLog);
router.get('/finance-v2/kpis', authMiddleware, requireTenantModule('finance'), getKpis);

module.exports = router;
