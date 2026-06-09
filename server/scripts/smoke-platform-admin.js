/**
 * Smoke test da API usada pelo painel /admin (platform).
 *
 * Uso:
 *   npm run smoke:platform-admin
 *   PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... npm run smoke:platform-admin
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE = process.env.API_BASE || 'http://localhost:3001/api';
const PLATFORM_BASE = `${BASE.replace(/\/$/, '')}/platform`;

const ADMIN_EMAIL = String(
  process.env.PLATFORM_ADMIN_EMAIL || process.argv[2] || 'admin@sloot.com',
).trim().toLowerCase();
const ADMIN_PASSWORD = String(
  process.env.PLATFORM_ADMIN_PASSWORD || process.argv[3] || 'SenhaSegura1',
);

async function request(method, path, { token, body, expectEmpty } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${PLATFORM_BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (expectEmpty && res.status === 204) {
    return { status: res.status, data: null };
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

function assertStatus(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual} — ${JSON.stringify(actual)}`);
  }
  console.log(`OK ${label} (${actual})`);
}

function assertTruthy(label, value) {
  if (value == null || value === '') throw new Error(`${label}: expected truthy value`);
  console.log(`OK ${label}`);
}

function assertFields(label, obj, fields) {
  for (const field of fields) {
    if (obj == null || obj[field] === undefined) {
      throw new Error(`${label}: missing field "${field}"`);
    }
  }
  console.log(`OK ${label} fields`);
}

async function main() {
  const ts = Date.now();
  let token = '';
  let tenantId = null;
  let barberId = null;
  let serviceId = null;
  let productId = null;
  let smokeAdminId = null;

  // 1. Login
  const login = await request('POST', '/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  assertStatus('POST /platform/login', login.status, 200);
  token = login.data?.token;
  assertTruthy('platform token', token);

  // 2. Stats
  const stats = await request('GET', '/stats', { token });
  assertStatus('GET /platform/stats', stats.status, 200);
  assertFields('stats', stats.data, ['tenants', 'appointments', 'topTenants']);
  assertFields('stats.tenants', stats.data.tenants, [
    'active',
    'suspended',
    'total',
    'newLast7Days',
    'newLast30Days',
  ]);
  assertFields('stats.appointments', stats.data.appointments, ['total']);
  if (!Array.isArray(stats.data.topTenants)) {
    throw new Error('stats.topTenants must be an array');
  }
  console.log('OK stats.topTenants is array');

  // 3. Tenants
  const listTenants = await request('GET', '/tenants?q=&status=&sort=createdAt_desc', { token });
  assertStatus('GET /platform/tenants', listTenants.status, 200);
  if (!Array.isArray(listTenants.data)) throw new Error('tenants list must be array');
  console.log('OK GET /platform/tenants returns array');

  const slug = `admin-smoke-${ts}`;
  const createTenant = await request('POST', '/tenants', {
    token,
    body: {
      shopName: `Admin Smoke ${ts}`,
      slug,
      managerName: 'Smoke Manager',
      email: `manager-${ts}@test.local`,
      password: 'SenhaSegura1',
      createDefaultServices: true,
      createDefaultHours: true,
    },
  });
  assertStatus('POST /platform/tenants', createTenant.status, 201);
  tenantId = createTenant.data?.tenant?.id ?? createTenant.data?.id;
  assertTruthy('tenant id', tenantId);

  const getTenant = await request('GET', `/tenants/${tenantId}`, { token });
  assertStatus(`GET /platform/tenants/${tenantId}`, getTenant.status, 200);
  assertTruthy('tenant manager', getTenant.data?.manager);
  assertFields('tenant counts', getTenant.data?._count || {}, [
    'barbers',
    'appointments',
    'customers',
    'services',
  ]);

  const suspend = await request('PATCH', `/tenants/${tenantId}/status`, {
    token,
    body: { status: 'suspended' },
  });
  assertStatus('PATCH tenant status → suspended', suspend.status, 200);

  const reactivate = await request('PATCH', `/tenants/${tenantId}/status`, {
    token,
    body: { status: 'active' },
  });
  assertStatus('PATCH tenant status → active', reactivate.status, 200);

  const tenantPrefix = `/tenants/${tenantId}`;

  // 4. Tenant ops — barbers
  const listBarbers = await request('GET', `${tenantPrefix}/barbers`, { token });
  assertStatus('GET barbers', listBarbers.status, 200);
  if (!Array.isArray(listBarbers.data)) throw new Error('barbers must be array');

  const createBarber = await request('POST', `${tenantPrefix}/barbers`, {
    token,
    body: {
      name: `Barber Smoke ${ts}`,
      email: `barber-${ts}@test.local`,
      password: 'SenhaSegura1',
      role: 'Barbeiro',
    },
  });
  assertStatus('POST barber', createBarber.status, 201);
  barberId = createBarber.data?.id;
  assertTruthy('barber id', barberId);

  const suspendBarber = await request('PATCH', `${tenantPrefix}/barbers/${barberId}`, {
    token,
    body: { status: 'Suspenso' },
  });
  assertStatus('PATCH barber → Suspenso', suspendBarber.status, 200);

  const reactivateBarber = await request('PATCH', `${tenantPrefix}/barbers/${barberId}`, {
    token,
    body: { status: 'Ativo' },
  });
  assertStatus('PATCH barber → Ativo', reactivateBarber.status, 200);

  const patchPerms = await request('PATCH', `${tenantPrefix}/barbers/${barberId}/permissions`, {
    token,
    body: { permissions: ['dashboard', 'scheduler', 'clients'] },
  });
  assertStatus('PATCH barber permissions', patchPerms.status, 200);

  const patchBarberProfile = await request('PATCH', `${tenantPrefix}/barbers/${barberId}`, {
    token,
    body: {
      name: `Barber Updated ${ts}`,
      email: `barber-upd-${ts}@test.local`,
    },
  });
  assertStatus('PATCH barber profile (name/email)', patchBarberProfile.status, 200);

  const managerId = getTenant.data?.manager?.id;
  if (managerId) {
    const patchManagerBarber = await request('PATCH', `${tenantPrefix}/barbers/${managerId}`, {
      token,
      body: { name: `Smoke Manager ${ts}` },
    });
    assertStatus('PATCH manager via barbers', patchManagerBarber.status, 200);
  }

  // Tenant admin + contact (Resumo / Config)
  const patchTenant = await request('PATCH', `/tenants/${tenantId}`, {
    token,
    body: {
      phone: `(11) 9000-${String(ts).slice(-4)}`,
      email: `contact-${ts}@test.local`,
      address: `Rua Smoke ${ts}`,
    },
  });
  assertStatus('PATCH tenant contact', patchTenant.status, 200);

  // Business
  const getBusiness = await request('GET', `${tenantPrefix}/business`, { token });
  assertStatus('GET business', getBusiness.status, 200);

  const patchBusiness = await request('PATCH', `${tenantPrefix}/business`, {
    token,
    body: {
      tagline: `Smoke tagline ${ts}`,
      slogan: `Smoke slogan ${ts}`,
      phone: `(11) 8000-${String(ts).slice(-4)}`,
      banner_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    },
  });
  assertStatus('PATCH business', patchBusiness.status, 200);
  assertTruthy('business banner set', patchBusiness.data?.banner_url);

  const clearBanner = await request('PATCH', `${tenantPrefix}/business`, {
    token,
    body: { banner_url: null },
  });
  assertStatus('PATCH business clear banner', clearBanner.status, 200);
  if (clearBanner.data?.banner_url != null) {
    throw new Error('banner_url should be null after removal');
  }
  console.log('OK PATCH business clear banner_url');

  // Services
  const listServices = await request('GET', `${tenantPrefix}/services`, { token });
  assertStatus('GET services', listServices.status, 200);

  const createService = await request('POST', `${tenantPrefix}/services`, {
    token,
    body: { name: `Smoke Service ${ts}`, price: 49.9, duration: '30 min' },
  });
  assertStatus('POST service', createService.status, 201);
  serviceId = createService.data?.id;
  assertTruthy('service id', serviceId);

  const updateService = await request('PUT', `${tenantPrefix}/services/${serviceId}`, {
    token,
    body: { name: `Smoke Service Updated ${ts}`, price: 59.9, duration: '45 min' },
  });
  assertStatus('PUT service', updateService.status, 200);

  const deleteService = await request('DELETE', `${tenantPrefix}/services/${serviceId}`, {
    token,
    expectEmpty: true,
  });
  assertStatus('DELETE service', deleteService.status, 204);

  // Products
  const listProducts = await request('GET', `${tenantPrefix}/products`, { token });
  assertStatus('GET products', listProducts.status, 200);

  const createProduct = await request('POST', `${tenantPrefix}/products`, {
    token,
    body: {
      name: `Smoke Product ${ts}`,
      price: 25,
      cost: 10,
      stock: 5,
      category: 'Geral',
    },
  });
  assertStatus('POST product', createProduct.status, 201);
  productId = createProduct.data?.id;
  assertTruthy('product id', productId);

  const updateProduct = await request('PUT', `${tenantPrefix}/products/${productId}`, {
    token,
    body: {
      name: `Smoke Product Updated ${ts}`,
      price: 30,
      cost: 12,
      stock: 8,
      category: 'Premium',
    },
  });
  assertStatus('PUT product', updateProduct.status, 200);

  const patchStock = await request('PATCH', `${tenantPrefix}/products/${productId}/stock`, {
    token,
    body: { delta: 1 },
  });
  assertStatus('PATCH product stock', patchStock.status, 200);
  if (Number(patchStock.data?.stock) !== 9) {
    throw new Error(`expected stock 9, got ${patchStock.data?.stock}`);
  }
  console.log('OK product stock incremented');

  const deleteProduct = await request('DELETE', `${tenantPrefix}/products/${productId}`, {
    token,
    expectEmpty: true,
  });
  assertStatus('DELETE product', deleteProduct.status, 204);

  const listSales = await request('GET', `${tenantPrefix}/sales`, { token });
  assertStatus('GET sales', listSales.status, 200);
  if (!Array.isArray(listSales.data)) throw new Error('sales must be array');

  // Modules — disable inventory, re-enable
  const currentModules = Array.isArray(getTenant.data?.enabledModules)
    ? getTenant.data.enabledModules
    : ['dashboard', 'scheduler', 'clients', 'finance', 'users', 'inventory', 'settings'];
  const withoutInventory = currentModules.filter((m) => m !== 'inventory');

  const patchModulesOff = await request('PATCH', `${tenantPrefix}/modules`, {
    token,
    body: { enabledModules: withoutInventory },
  });
  assertStatus('PATCH modules (disable inventory)', patchModulesOff.status, 200);

  const patchModulesOn = await request('PATCH', `${tenantPrefix}/modules`, {
    token,
    body: { enabledModules: currentModules },
  });
  assertStatus('PATCH modules (restore)', patchModulesOn.status, 200);

  // Manager — rename + email via platform route
  const patchManager = await request('PATCH', `${tenantPrefix}/manager`, {
    token,
    body: { name: `Smoke Manager ${ts}`, email: `manager-upd-${ts}@test.local` },
  });
  assertStatus('PATCH manager name/email', patchManager.status, 200);

  // 5. Platform admins
  const listAdmins = await request('GET', '/admins', { token });
  assertStatus('GET /admins', listAdmins.status, 200);
  if (!Array.isArray(listAdmins.data)) throw new Error('admins must be array');

  const smokeAdminEmail = `smoke-admin-${ts}@test.local`;
  const createAdmin = await request('POST', '/admins', {
    token,
    body: {
      name: `Smoke Admin ${ts}`,
      email: smokeAdminEmail,
      password: 'SenhaSegura1',
    },
  });
  assertStatus('POST /admins', createAdmin.status, 201);
  smokeAdminId = createAdmin.data?.id;
  assertTruthy('smoke admin id', smokeAdminId);

  const renameAdmin = await request('PATCH', `/admins/${smokeAdminId}`, {
    token,
    body: { name: `Smoke Admin Renamed ${ts}` },
  });
  assertStatus('PATCH /admins/:id', renameAdmin.status, 200);

  const deactivateAdmin = await request('PATCH', `/admins/${smokeAdminId}/status`, {
    token,
    body: { status: 'inactive' },
  });
  assertStatus('PATCH admin → inactive', deactivateAdmin.status, 200);

  const activateAdmin = await request('PATCH', `/admins/${smokeAdminId}/status`, {
    token,
    body: { status: 'active' },
  });
  assertStatus('PATCH admin → active', activateAdmin.status, 200);

  // 6. Auth negative
  const unauthorized = await request('GET', '/stats');
  assertStatus('GET /stats without token → 401', unauthorized.status, 401);

  console.log('\nAll platform admin smoke tests passed');
  console.log(`Disposable tenant: ${slug} (id ${tenantId})`);
  console.log(`Disposable admin: ${smokeAdminEmail} (id ${smokeAdminId})`);
}

main()
  .catch((err) => {
    console.error('\nFAILED:', err.message);
    process.exit(1);
  });
