import { initDb, getDb } from './db.js';

const DUMMY_USERS = Array.from({ length: 10 }, (_, i) => ({
	user_id: `user_${i + 1}`,
	email: `user${i + 1}@example.com`,
	phone: `+91-90000000${(i + 1).toString().padStart(2, '0')}`,
	preferred_channels: ['email'],
	risk_profile: { avg_amount_30d: Math.round((Math.random() * 1500 + 300) * 100) / 100 },
	created_at: new Date(),
	last_seen_at: new Date()
}));

(async () => {
	await initDb();
	const db = getDb();
	const col = db.collection('users');
	await col.createIndex({ user_id: 1 }, { unique: true });
	for (const u of DUMMY_USERS) {
		await col.updateOne({ user_id: u.user_id }, { $setOnInsert: u }, { upsert: true });
	}
	const count = await col.countDocuments();
	console.log(`Users seeded. Total users in DB: ${count}`);
	process.exit(0);
})(); 