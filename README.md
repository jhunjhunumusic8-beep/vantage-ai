# Vantage AI — Netlify Forex Signal Dashboard

A responsive static website with a Netlify Function that fetches 1-minute Forex candles from Twelve Data and calculates a transparent EMA(9)/EMA(21) + RSI(14) signal.

## 1. Get a market-data API key
1. Create an account at https://twelvedata.com/
2. Copy your API key from the dashboard.
3. Check your plan's Forex and 1-minute intraday data entitlements. Provider access, rate limits, delays and commercial-use rights depend on your plan.

## 2. Deploy to Netlify
1. Unzip this project.
2. Push the project folder to a GitHub repository.
3. In Netlify, choose **Add new site → Import an existing project** and select the repository.
4. Build settings: publish directory `.`; functions directory `netlify/functions` (already in `netlify.toml`).
5. Deploy the site.
6. In Netlify: **Site configuration → Environment variables → Add a variable**:
   - Key: `TWELVE_DATA_API_KEY`
   - Value: your Twelve Data API key
7. Trigger a new deploy so the function receives the environment variable.

## 3. Local development
Install Node.js, then in the project folder:
```bash
npm install -g netlify-cli
netlify dev
```
Set `TWELVE_DATA_API_KEY` in your shell before running `netlify dev`, or use a local `.env` file (do not commit it).

## 4. Customize
- Change the Telegram URL in `app.js` by editing `TELEGRAM_URL`.
- Add/remove allowed pairs in `netlify/functions/signal.mjs` and matching options in `index.html`.
- Change colors and layout in `styles.css`.

## Signal logic
- BUY: EMA 9 > EMA 21 and RSI(14) is between 50 and 70.
- SELL: EMA 9 < EMA 21 and RSI(14) is between 30 and 50.
- Otherwise: WAIT.

This is an educational rule-based indicator, not an AI model or a verified profitable strategy. The displayed strength is a heuristic score, **not probability or win-rate**. The app does not place trades. A 1-minute candle feed does not mean a signal is guaranteed to work for the next minute. Always verify data timestamps, test on historical data and paper-trade before risking money. Forex trading involves substantial risk.

## Security
The API key is read only by the server-side Netlify Function and is not included in browser JavaScript. Never put your API key in `app.js`, `index.html`, a public repository, or a client-side URL.
