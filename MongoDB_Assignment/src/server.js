import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import { getDb, initDb } from './db.js';
import surveyRouter from './routes/survey.js';
import { startTransactionChangeStream } from './anomalyDetector.js';
import { startTransactionSimulator } from './transactionSimulator.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static frontend
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/survey', surveyRouter);

// Survey insights endpoint
app.get('/api/survey/insights', async (req, res) => {
	try {
		const db = getDb();
		const pipeline = [
			{
				$facet: {
					securityFears: [
						{ $unwind: '$security_fears' },
						{ $group: { _id: '$security_fears', count: { $sum: 1 } } },
						{ $project: { label: '$_id', count: 1, _id: 0 } },
						{ $sort: { count: -1 } }
					],
					paymentMethods: [
						{ $unwind: '$payment_methods' },
						{ $group: { _id: '$payment_methods', count: { $sum: 1 } } },
						{ $project: { label: '$_id', count: 1, _id: 0 } },
						{ $sort: { count: -1 } }
					],
					demographics: [
						{ $group: { _id: '$age_group', count: { $sum: 1 } } },
						{ $project: { label: '$_id', count: 1, _id: 0 } },
						{ $sort: { count: -1 } }
					]
				}
			}
		];
		const cursor = db.collection('survey_responses').aggregate(pipeline);
		const results = await cursor.toArray();
		const { securityFears, paymentMethods, demographics } = results[0] || {
			securityFears: [],
			paymentMethods: [],
			demographics: []
		};
		const totalResponses = await db.collection('survey_responses').countDocuments();
		res.json({ totalResponses, securityFears, paymentMethods, demographics });
	} catch (err) {
		console.error('Insights error', err);
		res.status(500).json({ error: 'Failed to compute insights' });
	}
});

// SSE for live anomalies
app.get('/api/anomalies/stream', async (req, res) => {
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive'
	});
	res.write('\n');

	const db = getDb();
	const changeStream = db.collection('fraud_logs').watch([], { fullDocument: 'updateLookup' });
	changeStream.on('change', (change) => {
		if (change.operationType === 'insert') {
			res.write(`data: ${JSON.stringify(change.fullDocument)}\n\n`);
		}
	});
	changeStream.on('error', (err) => {
		console.error('SSE change stream error:', err);
		try { res.end(); } catch {}
	});
	req.on('close', () => {
		changeStream.close().catch(() => {});
	});
});

// Delete all fraud logs
app.delete('/api/anomalies', async (req, res) => {
	try {
		const db = getDb();
		const result = await db.collection('fraud_logs').deleteMany({});
		res.json({ deleted: result.deletedCount });
	} catch (err) {
		console.error('Delete anomalies error', err);
		res.status(500).json({ error: 'Failed to delete anomalies' });
	}
});

const port = process.env.PORT || 3000;

(async () => {
	await initDb();
	// start change stream detector
	startTransactionChangeStream();
	// start simulator (can be disabled with ENV)
	if (process.env.SIMULATOR_DISABLED !== '1') {
		startTransactionSimulator();
	}
	app.listen(port, () => {
		console.log(`Server listening on http://localhost:${port}`);
	});
})(); 
// Fraud analysis endpoint
app.get('/api/fraud/analysis', async (req, res) => {
	try {
		const db = getDb();
		
		// Risk score distribution
		const riskDistribution = await db.collection('fraud_logs').aggregate([
			{
				$group: {
					_id: null,
					low: { $sum: { $cond: [{ $lte: ['$risk_score', 30] }, 1, 0] } },
					medium: { $sum: { $cond: [{ $and: [{ $gt: ['$risk_score', 30] }, { $lte: ['$risk_score', 60] }] }, 1, 0] } },
					high: { $sum: { $cond: [{ $and: [{ $gt: ['$risk_score', 60] }, { $lte: ['$risk_score', 80] }] }, 1, 0] } },
					critical: { $sum: { $cond: [{ $gt: ['$risk_score', 80] }, 1, 0] } }
				}
			}
		]).toArray();
		
		// Pattern counts
		const patternCounts = await db.collection('fraud_logs').aggregate([
			{ $unwind: '$reason' },
			{ $group: { _id: '$reason.code', count: { $sum: 1 } } },
			{ $sort: { count: -1 } }
		]).toArray();
		
		// High-risk transactions (last 24h)
		const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const highRiskTxns = await db.collection('fraud_logs').find({
			timestamp: { $gte: last24h },
			risk_score: { $gte: 70 }
		}).sort({ timestamp: -1 }).limit(20).toArray();
		
		// Trend data (last 24 hours by hour)
		const trendData = await db.collection('fraud_logs').aggregate([
			{ $match: { timestamp: { $gte: last24h } } },
			{
				$group: {
					_id: { $hour: '$timestamp' },
					count: { $sum: 1 }
				}
			},
			{ $sort: { _id: 1 } }
		]).toArray();
		
		// Cross-user device analysis
		const crossUserDevices = await db.collection('transactions').aggregate([
			{ $match: { timestamp: { $gte: last24h } } },
			{
				$group: {
					_id: '$device_id',
					user_count: { $addToSet: '$user_id' },
					transaction_count: { $sum: 1 }
				}
			},
			{
				$project: {
					device_id: '$_id',
					user_count: { $size: '$user_count' },
					transaction_count: 1,
					_id: 0
				}
			},
			{ $match: { user_count: { $gt: 2 } } },
			{ $sort: { user_count: -1 } },
			{ $limit: 10 }
		]).toArray();
		
		// Geographic anomalies
		const geoAnomalies = await db.collection('fraud_logs').aggregate([
			{ $match: { 'reason.code': 'IMPOSSIBLE_TRAVEL' } },
			{ $sort: { timestamp: -1 } },
			{ $limit: 10 }
		]).toArray();
		
		res.json({
			riskDistribution: riskDistribution[0] || { low: 0, medium: 0, high: 0, critical: 0 },
			patternCounts: Object.fromEntries(patternCounts.map(p => [p._id, p.count])),
			highRiskTxns,
			trendData: trendData.map(t => ({ hour: `${t._id}:00`, count: t.count })),
			crossUserDevices,
			geoAnomalies: geoAnomalies.map(g => ({
				user_id: g.user_id,
				from_location: g.reason.find(r => r.code === 'IMPOSSIBLE_TRAVEL')?.message?.split(' from ')[1]?.split(' to ')[0] || 'Unknown',
				to_location: g.reason.find(r => r.code === 'IMPOSSIBLE_TRAVEL')?.message?.split(' to ')[1]?.split(' in ')[0] || 'Unknown',
				time_diff_hours: g.reason.find(r => r.code === 'IMPOSSIBLE_TRAVEL')?.message?.split(' in ')[1]?.split('h')[0] || '0'
			}))
		});
	} catch (err) {
		console.error('Fraud analysis error:', err);
		res.status(500).json({ error: 'Failed to analyze fraud patterns' });
	}
});

