import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let client;
let db;

const DEFAULT_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'armaan_gang';

export async function initDb() {
	const uri = process.env.MONGODB_URI || DEFAULT_URI;
	client = new MongoClient(uri, {
		maxPoolSize: 10
	});
	await client.connect();
	db = client.db(DB_NAME);

	// useful indexes
	await Promise.all([
		db.collection('transactions').createIndex({ user_id: 1, timestamp: -1 }),
		db.collection('transactions').createIndex({ transaction_id: 1 }, { unique: true }),
		db.collection('transactions').createIndex({ device_id: 1 }),
		db.collection('transactions').createIndex({ ip_address: 1 }),
		db.collection('fraud_logs').createIndex({ user_id: 1, timestamp: -1 }),
		db.collection('survey_responses').createIndex({ created_at: -1 })
	]);

	console.log(`Connected to MongoDB db=${DB_NAME}`);
}

export function getDb() {
	if (!db) throw new Error('DB not initialized');
	return db;
}

export function getClient() {
	if (!client) throw new Error('Client not initialized');
	return client;
} 