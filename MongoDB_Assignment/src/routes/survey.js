import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// POST /api/survey
// Expected body example:
// {
//   user_id, age_group, usage_frequency,
//   payment_methods: ['UPI','CARD'],
//   security_fears: ['phishing','upi_fraud'],
//   past_fraud_experience: { had_fraud: true, details: '...', chargeback: false },
//   security_practices: ['otp','biometrics','transaction_checks'],
//   security_expectations: ['alerts','insurance','ai_fraud_detection']
// }
router.post('/', async (req, res) => {
	try {
		const body = req.body || {};
		const required = ['age_group', 'usage_frequency'];
		for (const f of required) {
			if (!body[f]) {
				return res.status(400).json({ error: `Missing field: ${f}` });
			}
		}
		const doc = {
			user_id: body.user_id || null,
			age_group: body.age_group,
			usage_frequency: body.usage_frequency,
			payment_methods: Array.isArray(body.payment_methods) ? body.payment_methods : [],
			security_fears: Array.isArray(body.security_fears) ? body.security_fears : [],
			past_fraud_experience: body.past_fraud_experience || null,
			security_practices: Array.isArray(body.security_practices) ? body.security_practices : [],
			security_expectations: Array.isArray(body.security_expectations) ? body.security_expectations : [],
			created_at: new Date()
		};
		const db = getDb();
		const result = await db.collection('survey_responses').insertOne(doc);
		res.json({ insertedId: result.insertedId, ok: true });
	} catch (err) {
		console.error('Survey insert error', err);
		res.status(500).json({ error: 'Failed to save survey' });
	}
});

router.get('/', async (req, res) => {
	try {
		const db = getDb();
		const items = await db.collection('survey_responses').find({}).sort({ created_at: -1 }).limit(100).toArray();
		res.json(items);
	} catch (err) {
		console.error('Survey list error', err);
		res.status(500).json({ error: 'Failed to list survey responses' });
	}
});

export default router; 