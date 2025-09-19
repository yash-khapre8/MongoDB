import { getDb } from './db.js';
import { evaluateEnhancedAnomalies, computeEnhancedRiskScore } from './enhancedAnomalyDetector.js';

function computeRiskScore(reasons) {
	let score = 0;
	reasons.forEach((reason) => {
		switch (reason.code) {
			case 'HIGH_AMOUNT_OUTLIER': score += 40; break;
			case 'RAPID_TXNS': score += 25; break;
			case 'LOCATION_DEVICE_MISMATCH': score += 20; break;
			case 'ODD_HOUR': score += 15; break;
			// Enhanced rules
			case 'CROSS_USER_DEVICE': score += 35; break;
			case 'IMPOSSIBLE_TRAVEL': score += 30; break;
			case 'HIGH_VELOCITY_SPENDING': score += 25; break;
			case 'STRUCTURING_PATTERN': score += 40; break;
			case 'ACCOUNT_TAKEOVER_RISK': score += 45; break;
			default: score += 5; break;
		}
	});
	return Math.min(99, score);
}

async function evaluateAnomaliesForTransaction(txn, db) {
	const reasons = [];
	const userId = txn.user_id;
	const txnsCol = db.collection('transactions');

	// Basic anomaly rules
	// Average amount for user in last 30 days
	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	const avgAgg = await txnsCol.aggregate([
		{ $match: { user_id: userId, timestamp: { $gte: thirtyDaysAgo } } },
		{ $group: { _id: '$user_id', avgAmount: { $avg: '$amount' }, count: { $sum: 1 } } }
	]).toArray();
	const avgAmount = avgAgg[0]?.avgAmount || null;
	if (avgAmount && txn.amount > avgAmount * 3) {
		reasons.push({ code: 'HIGH_AMOUNT_OUTLIER', message: `Amount ${txn.amount} > 3x avg ${avgAmount.toFixed(2)}` });
	}

	// Rapid multiple transactions in last 2 minutes
	const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
	const rapidCount = await txnsCol.countDocuments({ user_id: userId, timestamp: { $gte: twoMinutesAgo } });
	if (rapidCount >= 5) {
		reasons.push({ code: 'RAPID_TXNS', message: `${rapidCount} txns in last 2 minutes` });
	}

	// Location/device mismatch: last known device/location for user
	const lastTxn = await txnsCol.find({ user_id: userId }).sort({ timestamp: -1 }).limit(1).toArray();
	if (lastTxn[0]) {
		if (lastTxn[0].device_id !== txn.device_id || lastTxn[0].ip_address !== txn.ip_address) {
			reasons.push({ code: 'LOCATION_DEVICE_MISMATCH', message: 'Device/IP mismatch from previous txn' });
		}
	}

	// Odd hours: 12am-5am local server time
	const hour = new Date(txn.timestamp).getHours();
	if (hour >= 0 && hour < 5) {
		reasons.push({ code: 'ODD_HOUR', message: `Transaction at ${hour}:00` });
	}

	// Enhanced fraud pattern detection
	try {
		const enhancedReasons = await evaluateEnhancedAnomalies(txn, db);
		reasons.push(...enhancedReasons);
	} catch (err) {
		console.error('Enhanced anomaly detection error:', err);
	}

	if (reasons.length > 0) {
		const riskScore = computeRiskScore(reasons);
		await db.collection('fraud_logs').insertOne({
			transaction_id: txn.transaction_id,
			user_id: txn.user_id,
			timestamp: txn.timestamp,
			anomaly_detected: true,
			risk_score: riskScore,
			reason: reasons,
			detection_version: '2.0' // Mark enhanced version
		});
	}
}

export function startTransactionChangeStream() {
	const db = getDb();
	const changeStream = db.collection('transactions').watch([], { fullDocument: 'updateLookup' });
	changeStream.on('change', async (change) => {
		try {
			if (change.operationType === 'insert') {
				const txn = change.fullDocument;
				await evaluateAnomaliesForTransaction(txn, db);
			}
		} catch (err) {
			console.error('Anomaly detector error:', err);
		}
	});
	changeStream.on('error', (err) => {
		console.error('Transaction change stream error:', err);
	});
	console.log('Enhanced anomaly detector listening to transactions change stream');
}
