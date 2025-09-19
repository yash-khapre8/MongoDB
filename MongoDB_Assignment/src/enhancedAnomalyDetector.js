// Enhanced anomaly detection rules for comprehensive fraud pattern analysis

import { getDb } from './db.js';

// Cross-user pattern detection
async function checkCrossUserPatterns(txn, db) {
	const sameDeviceUsers = await db.collection('transactions').distinct('user_id', {
		device_id: txn.device_id,
		timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // last 24 hours
	});
	
	if (sameDeviceUsers.length > 3) {
		return {
			code: 'CROSS_USER_DEVICE',
			message: `Device used by ${sameDeviceUsers.length} different users in 24h`
		};
	}
	return null;
}

// Geographic anomaly detection
async function checkGeographicAnomaly(txn, db) {
	const lastTxn = await db.collection('transactions').findOne(
		{ user_id: txn.user_id },
		{ sort: { timestamp: -1 } }
	);
	
	if (lastTxn && lastTxn.location !== txn.location) {
		const timeDiff = txn.timestamp - lastTxn.timestamp;
		const hoursDiff = timeDiff / (1000 * 60 * 60);
		
		// If locations are far apart and time is too short for travel
		if (hoursDiff < 2 && lastTxn.location !== txn.location) {
			return {
				code: 'IMPOSSIBLE_TRAVEL',
				message: `Location changed from ${lastTxn.location} to ${txn.location} in ${hoursDiff.toFixed(1)}h`
			};
		}
	}
	return null;
}

// Velocity check (spending pattern)
async function checkSpendingVelocity(txn, db) {
	const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const recentTxns = await db.collection('transactions').find({
		user_id: txn.user_id,
		timestamp: { $gte: last24h }
	}).toArray();
	
	const totalSpent = recentTxns.reduce((sum, t) => sum + t.amount, 0);
	const avgDailySpend = 500; // Could be calculated from historical data
	
	if (totalSpent > avgDailySpend * 5) {
		return {
			code: 'HIGH_VELOCITY_SPENDING',
			message: `Spent ₹${totalSpent} in 24h (5x daily average)`
		};
	}
	return null;
}

// Money laundering pattern detection
async function checkMoneyLaunderingPattern(txn, db) {
	const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const recentTxns = await db.collection('transactions').find({
		user_id: txn.user_id,
		timestamp: { $gte: last24h },
		amount: { $gte: 9000, $lt: 10000 } // Just under reporting threshold
	}).toArray();
	
	if (recentTxns.length >= 3) {
		return {
			code: 'STRUCTURING_PATTERN',
			message: `${recentTxns.length} transactions just under ₹10k threshold`
		};
	}
	return null;
}

// Account takeover pattern
async function checkAccountTakeover(txn, db) {
	const lastTxn = await db.collection('transactions').findOne(
		{ user_id: txn.user_id },
		{ sort: { timestamp: -1 } }
	);
	
	if (lastTxn) {
		const timeDiff = txn.timestamp - lastTxn.timestamp;
		const hoursDiff = timeDiff / (1000 * 60 * 60);
		
		// New device + high amount + short time since last transaction
		if (lastTxn.device_id !== txn.device_id && 
			txn.amount > 5000 && 
			hoursDiff < 1) {
			return {
				code: 'ACCOUNT_TAKEOVER_RISK',
				message: `New device + ₹${txn.amount} transaction within ${hoursDiff.toFixed(1)}h`
			};
		}
	}
	return null;
}

// Enhanced anomaly evaluation
export async function evaluateEnhancedAnomalies(txn, db) {
	const reasons = [];
	
	// Run all enhanced checks
	const checks = [
		checkCrossUserPatterns(txn, db),
		checkGeographicAnomaly(txn, db),
		checkSpendingVelocity(txn, db),
		checkMoneyLaunderingPattern(txn, db),
		checkAccountTakeover(txn, db)
	];
	
	const results = await Promise.all(checks);
	results.forEach(result => {
		if (result) reasons.push(result);
	});
	
	return reasons;
}

// Enhanced risk scoring
export function computeEnhancedRiskScore(reasons) {
	let score = 0;
	reasons.forEach((reason) => {
		switch (reason.code) {
			case 'CROSS_USER_DEVICE': score += 35; break;
			case 'IMPOSSIBLE_TRAVEL': score += 30; break;
			case 'HIGH_VELOCITY_SPENDING': score += 25; break;
			case 'STRUCTURING_PATTERN': score += 40; break;
			case 'ACCOUNT_TAKEOVER_RISK': score += 45; break;
			default: score += 10; break;
		}
	});
	return Math.min(99, score);
}
