const ALLOWED = new Set(["AUD/USD","EUR/USD","GBP/USD","USD/JPY","USD/CHF","USD/CAD","NZD/USD","EUR/JPY"]);

function ema(values, period) {
  const k = 2 / (period + 1);
  let value = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
  for (let i = period; i < values.length; i++) value = values[i] * k + value * (1 - k);
  return value;
}

function rsi(values, period = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function atr(candles, period = 14) {
  const ranges = [];
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i], previous = candles[i - 1];
    ranges.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    ));
  }
  const recent = ranges.slice(-period);
  return recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : 0;
}

async function getCandles(symbol, interval, outputsize, key) {
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("timezone", "UTC");
  const response = await fetch(url, { headers: { Authorization: `apikey ${key}` } });
  const payload = await response.json();
  if (!response.ok || payload.status === "error" || !Array.isArray(payload.values)) {
    throw new Error(payload.message || payload.code || `No ${interval} candle data returned.`);
  }
  const candles = payload.values
    .map(value => ({
      time: value.datetime,
      open: Number(value.open),
      high: Number(value.high),
      low: Number(value.low),
      close: Number(value.close)
    }))
    .filter(candle => [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
    .reverse();

  // The newest candle may still be forming. Exclude it to avoid intrabar repainting.
  return candles.slice(0, -1);
}

export default async (request) => {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  const symbol = new URL(request.url).searchParams.get("symbol") || "AUD/USD";
  if (!ALLOWED.has(symbol)) return new Response(JSON.stringify({ error: "Unsupported currency pair." }), { status: 400, headers });

  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) return new Response(JSON.stringify({ error: "Missing TWELVE_DATA_API_KEY in Netlify environment variables." }), { status: 503, headers });

  try {
    const [oneMinute, fiveMinute] = await Promise.all([
      getCandles(symbol, "1min", 100, key),
      getCandles(symbol, "5min", 100, key)
    ]);
    if (oneMinute.length < 35 || fiveMinute.length < 55) {
      return new Response(JSON.stringify({ error: "Not enough completed 1-minute and 5-minute candles. No signal generated." }), { status: 502, headers });
    }

    const closes1m = oneMinute.map(candle => candle.close);
    const closes5m = fiveMinute.map(candle => candle.close);
    const last = oneMinute.at(-1);
    const previous5mEma20 = ema(closes5m.slice(0, -1), 20);
    const ema20_5m = ema(closes5m, 20);
    const ema50_5m = ema(closes5m, 50);
    const ema9_1m = ema(closes1m, 9);
    const ema21_1m = ema(closes1m, 21);
    const momentum = rsi(closes1m, 14);
    const volatility = atr(oneMinute, 14);

    if (!(volatility > 0) || !Number.isFinite(volatility)) {
      return new Response(JSON.stringify({ error: "Volatility data is unavailable. No signal generated." }), { status: 502, headers });
    }

    const higherBullish = ema20_5m > ema50_5m && ema20_5m > previous5mEma20;
    const higherBearish = ema20_5m < ema50_5m && ema20_5m < previous5mEma20;
    const lowerBullish = ema9_1m > ema21_1m;
    const lowerBearish = ema9_1m < ema21_1m;
    const candleRange = last.high - last.low;
    const bodyRatio = candleRange > 0 ? Math.abs(last.close - last.open) / candleRange : 0;
    const closePosition = candleRange > 0 ? (last.close - last.low) / candleRange : 0;
    const separationAtr = Math.abs(ema9_1m - ema21_1m) / volatility;

    const bullishCandle = last.close > last.open && closePosition >= 0.65 && bodyRatio >= 0.35;
    const bearishCandle = last.close < last.open && closePosition <= 0.35 && bodyRatio >= 0.35;
    const buyRsi = momentum >= 52 && momentum <= 68;
    const sellRsi = momentum >= 32 && momentum <= 48;
    const trendSeparated = separationAtr >= 0.10;

    let signal = "WAIT";
    let reason = "No trade: multi-timeframe trend, momentum and completed-candle confirmation are not all aligned.";
    let strength = 0;
    if (higherBullish) strength += 30;
    if (lowerBullish) strength += 20;
    if (buyRsi) strength += 20;
    if (bullishCandle) strength += 15;
    if (trendSeparated) strength += 15;

    if (higherBearish) strength = 30;
    if (lowerBearish) strength += 20;
    if (sellRsi) strength += 20;
    if (bearishCandle) strength += 15;
    if (trendSeparated) strength += 15;

    if (higherBullish && lowerBullish && buyRsi && bullishCandle && trendSeparated) {
      signal = "BUY";
      reason = "BUY: completed 1-minute candle, 1-minute EMA trend, rising 5-minute EMA trend and RSI momentum are aligned.";
    } else if (higherBearish && lowerBearish && sellRsi && bearishCandle && trendSeparated) {
      signal = "SELL";
      reason = "SELL: completed 1-minute candle, 1-minute EMA trend, falling 5-minute EMA trend and RSI momentum are aligned.";
    } else {
      strength = Math.min(69, strength);
    }

    let tradePlan = null;
    if (signal !== "WAIT") {
      const direction = signal === "BUY" ? 1 : -1;
      const risk = volatility * 1.5;
      tradePlan = {
        entry: last.close,
        stopLoss: last.close - direction * risk,
        takeProfit1: last.close + direction * risk,
        takeProfit2: last.close + direction * risk * 2,
        takeProfit3: last.close + direction * risk * 3,
        riskReward: "1:1 / 1:2 / 1:3"
      };
    }

    return new Response(JSON.stringify({
      symbol, signal, reason, price: last.close, rsi: momentum,
      trend: higherBullish ? "BULLISH" : higherBearish ? "BEARISH" : "FLAT",
      strength, candleTime: last.time, interval: "1-minute (closed candle)",
      indicators: { ema9: ema9_1m, ema21: ema21_1m, ema20_5m, ema50_5m, atr14: volatility },
      tradePlan, candles: oneMinute.slice(-40), provider: "Twelve Data"
    }), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Market data request failed. Try again shortly." }), { status: 502, headers });
  }
};
