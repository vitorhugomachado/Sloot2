const { requireTenantModule, assertModuleEnabled } = require('../lib/tenantModules.js');

module.exports = requireTenantModule;
module.exports.assertModuleEnabled = assertModuleEnabled;
