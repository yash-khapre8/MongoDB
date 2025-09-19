import { getDb } from './db.js';
import { nanoid } from 'nanoid';

const PAYMENT_METHODS = ['UPI', 'CARD', 'WALLET', 'NET_BANKING'];
let USER_IDS = Array.from({ length: 10 }, (_, i) => `user_${i + 1}`);
const DEVICES = Array.from({ length: 15 }, (_, i) => `device_${i + 1}`);
const IPS = Array.from({ length: 15 }, (_, i) => `192.168.1.${i + 10}`);
const LOCATIONS = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata'];

function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateTransaction() {
	const userId = randomChoice(USER_IDS);
	const amountBase = Math.random() < 0.85 ? Math.random() * 2000 + 100 : Math.random() * 20000 + 5000; // occasional spikes
	return {
		transaction_id: nanoid(12),
		user_id: userId,
		timestamp: new Date(),
		amount: Math.round(amountBase * 100) / 100,
		payment_method: randomChoice(PAYMENT_METHODS),
		location: randomChoice(LOCATIONS),
		device_id: randomChoice(DEVICES),
		ip_address: randomChoice(IPS),
		status: Math.random() < 0.95 ? 'SUCCESS' : 'FAILED'
	};
}

async function loadUserIdsFromDb(db) {
	try {
		const users = await db.collection('users').find({}, { projection: { user_id: 1 } }).toArray();
		if (users.length > 0) {
			USER_IDS = users.map(u => u.user_id);
			console.log(`Simulator using ${USER_IDS.length} user ids from DB`);
		}
	} catch (e) {
		console.warn('Could not load user ids from DB; using defaults');
	}
}

export function startTransactionSimulator() {
	const db = getDb();
	const col = db.collection('transactions');
	const baseIntervalMs = Number(process.env.SIMULATOR_INTERVAL_MS || 1000);
	console.log(`Transaction simulator started (base interval=${baseIntervalMs}ms, random jitter enabled)`);

	loadUserIdsFromDb(db).then(() => {
		const emit = async () => {
			try {
				// Occasionally emit a burst to trigger rapid transaction rule
				const isBurst = Math.random() < 0.15;
				const batchSize = isBurst ? randomInt(3, 6) : 1;
				const batch = Array.from({ length: batchSize }).map(generateTransaction);
				await col.insertMany(batch);
			} catch (err) {
				console.error('Simulator insert error', err);
			}
			// Randomize next delay around baseIntervalMs (50% - 300%)
			const nextDelay = Math.max(250, Math.floor(baseIntervalMs * (0.5 + Math.random() * 2.5)));
			setTimeout(emit, nextDelay);
		};
		setTimeout(emit, baseIntervalMs);
	});
} 