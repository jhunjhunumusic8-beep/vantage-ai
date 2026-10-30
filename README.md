# VANTAGE AI — Netlify Forex Signal Dashboard

## Deploy
- Publish directory: `.`
- Functions directory: `netlify/functions`
- Build command: leave blank
- Node runtime: Netlify default supported runtime

## Required Netlify environment variables
- `TWELVE_DATA_API_KEY` — required for market candles.
- `TELEGRAM_BOT_TOKEN` — optional; create a bot with BotFather.
- `TELEGRAM_CHAT_ID` — optional; target chat/group/channel ID. The bot must be allowed to post there.

After adding or changing variables, trigger a new deploy.

## Features
- EMA(9)/EMA(21) and RSI(14) rule-based signal.
- ATR(14)-based illustrative entry, stop and target levels.
- Browser-local signal history.
- 15-minute direction check for completed signal outcomes.
- Telegram alert sent only when user clicks the alert button.

## Important limitations
- History is stored in the current browser's localStorage; it is not shared across devices and can be cleared by the user.
- The accuracy tracker compares the latest observed price with entry after 15 minutes. It is a simple directional check, not a broker-executed trade record and does not account for spread, slippage, fees, or intrabar stop/target ordering.
- TP/SL levels use 1.5 × ATR as a volatility-based illustration, not a guarantee or personalized recommendation.
- Signals are educational rule-based analysis, not financial advice. Backtest and paper-trade before risking capital.
