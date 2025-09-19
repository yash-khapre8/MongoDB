# Payment Security Survey & Fraud Monitoring Demo

Tech: Node.js, Express, MongoDB, Chart.js, SSE

## Features
- Survey module saves responses to `survey_responses`
- Transaction simulator inserts mock `transactions`
- Change Streams powered anomaly detector writes `fraud_logs`
- Dashboard shows survey insights and live anomaly logs

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start MongoDB with a replica set (required for change streams). For local `mongod`:
   - Start with replSet:
     ```bash
     mongod --replSet rs0 --dbpath /path/to/db --bind_ip 127.0.0.1
     ```
   - Initialize the replica set (run once in mongosh):
     ```javascript
     rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })
     ```
3. Configure environment (optional): copy `.env.example` to `.env` and adjust.
4. Start server:
   ```bash
   npm run dev
   ```
5. Open the dashboard at `http://localhost:3000`.

## API
- `POST /api/survey` → create survey response
- `GET /api/survey` → list latest responses
- `GET /api/survey/insights` → aggregated insights
- `GET /api/anomalies/stream` → SSE of new fraud logs

## Data Models
- `transactions`:
  ```json
  { "transaction_id": "string", "user_id": "string", "timestamp": "Date", "amount": 123.45, "payment_method": "UPI|CARD|WALLET|NET_BANKING", "location": "string", "device_id": "string", "ip_address": "string", "status": "SUCCESS|FAILED" }
  ```
- `survey_responses`:
  ```json
  { "user_id": "string|null", "age_group": "string", "usage_frequency": "string", "payment_methods": ["..."], "security_fears": ["..."], "past_fraud_experience": {"had_fraud": true}, "security_practices": ["..."], "security_expectations": ["..."], "created_at": "Date" }
  ```
- `fraud_logs`:
  ```json
  { "transaction_id": "string", "user_id": "string", "timestamp": "Date", "anomaly_detected": true, "risk_score": 0-99, "reason": [{"code": "...", "message": "..."}] }
  ```

## Notes
- You can disable the simulator with `SIMULATOR_DISABLED=1`.
- Adjust `SIMULATOR_INTERVAL_MS` to increase/decrease traffic. 