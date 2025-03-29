import { init } from '@instantdb/admin';

const { INSTANT_APP_ID: appId, INSTANT_APP_ADMIN_TOKEN: adminToken } = process.env;

if (!appId || !adminToken) {
  throw new Error('Missing INSTANT_APP_ID or INSTANT_APP_ADMIN_TOKEN');
}

export const db = init({ appId, adminToken });