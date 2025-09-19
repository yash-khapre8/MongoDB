// Fraud Pattern Analysis Dashboard

let riskChart, patternChart, trendChart;

async function fetchFraudData() {
	try {
		const res = await fetch('/api/fraud/analysis');
		return await res.json();
	} catch (err) {
		console.error('Failed to fetch fraud data:', err);
		return null;
	}
}

function renderRiskDistribution(data) {
	const ctx = document.getElementById('riskChart');
	const riskRanges = [
		{ label: 'Low (0-30)', count: data.riskDistribution.low },
		{ label: 'Medium (31-60)', count: data.riskDistribution.medium },
		{ label: 'High (61-80)', count: data.riskDistribution.high },
		{ label: 'Critical (81-99)', count: data.riskDistribution.critical }
	];
	
	if (riskChart) riskChart.destroy();
	riskChart = new Chart(ctx, {
		type: 'doughnut',
		data: {
			labels: riskRanges.map(r => r.label),
			datasets: [{
				data: riskRanges.map(r => r.count),
				backgroundColor: ['#25c2a0', '#ffa726', '#ff7043', '#f44336']
			}]
		},
		options: {
			responsive: true,
			plugins: {
				legend: { position: 'bottom' }
			}
		}
	});
}

function renderPatternAnalysis(data) {
	const ctx = document.getElementById('patternChart');
	const patterns = Object.entries(data.patternCounts).map(([pattern, count]) => ({
		label: pattern.replace(/_/g, ' '),
		count
	}));
	
	if (patternChart) patternChart.destroy();
	patternChart = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: patterns.map(p => p.label),
			datasets: [{
				label: 'Occurrences',
				data: patterns.map(p => p.count),
				backgroundColor: '#4569ff'
			}]
		},
		options: {
			scales: { y: { beginAtZero: true } },
			plugins: {
				legend: { display: false }
			}
		}
	});
}

function renderTrendAnalysis(data) {
	const ctx = document.getElementById('trendChart');
	const hours = data.trendData.map(d => d.hour);
	const counts = data.trendData.map(d => d.count);
	
	if (trendChart) trendChart.destroy();
	trendChart = new Chart(ctx, {
		type: 'line',
		data: {
			labels: hours,
			datasets: [{
				label: 'Fraud Alerts',
				data: counts,
				borderColor: '#f44336',
				backgroundColor: 'rgba(244, 67, 54, 0.1)',
				fill: true
			}]
		},
		options: {
			scales: { y: { beginAtZero: true } },
			plugins: {
				legend: { display: false }
			}
		}
	});
}

function renderHighRiskTransactions(txns) {
	const el = document.getElementById('highRiskTxns');
	el.innerHTML = '';
	
	txns.forEach(txn => {
		const row = document.createElement('div');
		row.className = 'row';
		row.innerHTML = `
			<div>
				<span class="badge">Risk ${txn.risk_score}</span>
				<b>${txn.transaction_id}</b> • ${txn.user_id}
			</div>
			<div class="status">${txn.reason.map(r => r.code).join(', ')}</div>
			<div class="status">${new Date(txn.timestamp).toLocaleString()}</div>
		`;
		el.appendChild(row);
	});
}

function renderCrossUserAnalysis(data) {
	const el = document.getElementById('crossUserAnalysis');
	el.innerHTML = '';
	
	data.crossUserDevices.forEach(device => {
		const row = document.createElement('div');
		row.className = 'row';
		row.innerHTML = `
			<div><b>${device.device_id}</b> used by ${device.user_count} users</div>
			<div class="status">Last 24h: ${device.transaction_count} transactions</div>
		`;
		el.appendChild(row);
	});
}

function renderGeoAnomalies(data) {
	const el = document.getElementById('geoAnomalies');
	el.innerHTML = '';
	
	data.geoAnomalies.forEach(anomaly => {
		const row = document.createElement('div');
		row.className = 'row';
		row.innerHTML = `
			<div><b>${anomaly.user_id}</b>: ${anomaly.from_location} → ${anomaly.to_location}</div>
			<div class="status">Time diff: ${anomaly.time_diff_hours}h</div>
		`;
		el.appendChild(row);
	});
}

async function loadFraudAnalysis() {
	const data = await fetchFraudData();
	if (!data) return;
	
	renderRiskDistribution(data);
	renderPatternAnalysis(data);
	renderTrendAnalysis(data);
	renderHighRiskTransactions(data.highRiskTxns);
	renderCrossUserAnalysis(data);
	renderGeoAnomalies(data);
}

// Auto-refresh every 30 seconds
window.addEventListener('DOMContentLoaded', () => {
	loadFraudAnalysis();
	setInterval(loadFraudAnalysis, 30000);
});
