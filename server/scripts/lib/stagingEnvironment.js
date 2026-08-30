function isIsolatedRailwayStaging(env = process.env) {
  return env.STAGING_BOOTSTRAP === 'true'
    && env.RAILWAY_ENVIRONMENT_NAME === 'staging';
}

module.exports = { isIsolatedRailwayStaging };
