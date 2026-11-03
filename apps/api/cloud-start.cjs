const { Database } = require('./dist/db');
const { provisionStore } = require('./dist/provision');
const { createApp } = require('./dist/main');
(async () => {
  const db = new Database();
  try {
    await db.onModuleInit();
    const existing = (await db.pool.query('SELECT COUNT(*)::int count FROM users')).rows[0].count;
    if (existing === 0) {
      if (!process.env.AGRISTOCK_OWNER_PASSWORD) throw new Error('Initial owner password is required for the empty operational store.');
      await provisionStore(db, {
        username: 'owner', password: process.env.AGRISTOCK_OWNER_PASSWORD,
        ownerName: 'Chủ cửa hàng Trung Hiếu', storeName: 'HTAgri', warehouseName: 'Kho cửa hàng',
      });
      console.log('Initialized an empty operational store; change the initial owner password in the app.');
    }
  } finally { await db.onModuleDestroy(); }
  delete process.env.AGRISTOCK_OWNER_PASSWORD;
  const app = await createApp();
  await app.listen(Number(process.env.PORT || 10000), '0.0.0.0');
})().catch(error => { console.error({ name: error.name, code: error.code, message: 'Cloud startup failed. Check database and bootstrap configuration.' }); process.exit(1); });
