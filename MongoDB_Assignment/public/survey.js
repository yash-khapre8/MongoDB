function getValues(form) {
	const fd = new FormData(form);
	return {
		age_group: fd.get('age_group'),
		usage_frequency: fd.get('usage_frequency'),
		payment_methods: fd.getAll('payment_methods'),
		security_fears: fd.getAll('security_fears'),
		security_practices: fd.getAll('security_practices'),
		security_expectations: fd.getAll('security_expectations'),
		past_fraud_experience: (function(){
			const had = document.getElementById('had_fraud_toggle').checked;
			const details = fd.get('fraud_details') || null;
			const chargeback = document.getElementById('had_chargeback').checked;
			return had ? { had_fraud: true, details, chargeback } : { had_fraud: false };
		})()
	};
}

async function postJSON(url, data) {
	const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
	if (!res.ok) throw new Error('Request failed');
	return res.json();
}

window.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('full-survey');
	const status = document.getElementById('full-status');
	const toggle = document.getElementById('had_fraud_toggle');
	const details = document.getElementById('fraud_details');
	toggle.addEventListener('change', () => {
		details.style.display = toggle.checked ? 'block' : 'none';
	});
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		status.textContent = 'Submitting...';
		try {
			const payload = getValues(form);
			await postJSON('/api/survey', payload);
			status.textContent = 'Thanks! Your response was recorded.';
			form.reset();
			details.style.display = 'none';
		} catch (err) {
			status.textContent = 'Submit failed';
		}
	});
}); 