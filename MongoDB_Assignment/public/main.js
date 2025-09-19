async function postJSON(url, data) {
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Request failed');
	return res.json();
}

async function deleteLogs() {
	const res = await fetch('/api/anomalies', { method: 'DELETE' });
	if (!res.ok) throw new Error('Delete failed');
	return res.json();
}

function getFormValues(form) {
	const fd = new FormData(form);
	const data = {
		age_group: fd.get('age_group'),
		usage_frequency: fd.get('usage_frequency'),
		payment_methods: fd.getAll('payment_methods'),
		security_fears: fd.getAll('security_fears'),
		security_practices: fd.getAll('security_practices'),
		security_expectations: fd.getAll('security_expectations')
	};
	return data;
}

async function refreshInsights() {
	const res = await fetch('/api/survey/insights');
	const data = await res.json();
	renderCharts(data);
}

let fearsChartRef = null;
let methodsChartRef = null;

function renderCharts(data) {
	const fearsCtx = document.getElementById('fearsChart');
	const methodsCtx = document.getElementById('methodsChart');
	const fearsLabels = data.securityFears.map(x => x.label);
	const fearsCounts = data.securityFears.map(x => x.count);
	const methodLabels = data.paymentMethods.map(x => x.label);
	const methodCounts = data.paymentMethods.map(x => x.count);

	if (fearsChartRef) fearsChartRef.destroy();
	fearsChartRef = new Chart(fearsCtx, {
		type: 'bar',
		data: { labels: fearsLabels, datasets: [{ label: 'Security Fears', data: fearsCounts, backgroundColor: '#4f83ff' }] },
		options: { scales: { y: { beginAtZero: true } } }
	});
	if (methodsChartRef) methodsChartRef.destroy();
	methodsChartRef = new Chart(methodsCtx, {
		type: 'bar',
		data: { labels: methodLabels, datasets: [{ label: 'Payment Methods', data: methodCounts, backgroundColor: '#25c2a0' }] },
		options: { scales: { y: { beginAtZero: true } } }
	});
}

let evtSrc = null;
let ssePaused = false;

function startSSE() {
	const el = document.getElementById('anomalies');
	evtSrc = new EventSource('/api/anomalies/stream');
	evtSrc.onmessage = (e) => {
		if (ssePaused) return;
		try {
			const doc = JSON.parse(e.data);
			const row = document.createElement('div');
			row.className = 'row';
			row.innerHTML = `<div><span class="badge">Risk ${doc.risk_score}</span> <b>${doc.transaction_id}</b> • ${doc.user_id}</div>
			<div class="status">${(doc.reason || []).map(r => r.code).join(', ')}</div>`;
			el.prepend(row);
		} catch (err) {}
	};
	return evtSrc;
}

function stopSSE() {
	if (evtSrc) {
		evtSrc.close();
		evtSrc = null;
	}
}

window.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('survey-form');
	const status = document.getElementById('submit-status');
	const toggle = document.getElementById('toggle-sse');
	const delBtn = document.getElementById('delete-logs');
	const logEl = document.getElementById('anomalies');
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		status.textContent = 'Submitting...';
		try {
			const data = getFormValues(form);
			await postJSON('/api/survey', data);
			status.textContent = 'Thanks! Your response was recorded.';
			form.reset();
			refreshInsights();
		} catch (err) {
			status.textContent = 'Submit failed';
		}
	});
	refreshInsights();
	startSSE();

	if (toggle) {
		toggle.addEventListener('click', () => {
			if (evtSrc) {
				stopSSE();
				toggle.textContent = 'Resume';
				ssePaused = true;
			} else {
				ssePaused = false;
				startSSE();
				toggle.textContent = 'Pause';
			}
		});
	}

	if (delBtn) {
		delBtn.addEventListener('click', async () => {
			try {
				await deleteLogs();
				logEl.innerHTML = '';
			} catch (err) {
				// no-op
			}
		});
	}
}); 