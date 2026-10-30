import { getStore } from "@netlify/blobs";

export const config = { schedule: "* * * * *" };
const PAIRS = ["AUD/USD","EUR/USD","GBP/USD","USD/JPY","USD/CHF","USD/CAD","NZD/USD","EUR/JPY"];
const store = getStore("vantage-signal-state");
const fmt = n => Number(n).toFixed(Number(n) > 100 ? 3 : 5);

async function send(chatId, message, token) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram send failed");
}

export default async () => {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: freeChat, TELEGRAM_PREMIUM_CHAT_ID: premiumChat, TWELVE_DATA_API_KEY: apiKey } = process.env;
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!token || !freeChat || !premiumChat || !apiKey || !base) throw new Error("Missing required Netlify environment variables.");

  const slot = Math.floor(Date.now() / 60000);
  const symbol = PAIRS[slot % PAIRS.length];
  const response = await fetch(`${base}/.netlify/functions/signal?symbol=${encodeURIComponent(symbol)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Signal scan failed");

  const stateKey = `alert-${symbol.replace("/", "-")}`;
  const previous = await store.get(stateKey, { type: "json" });
  if (data.signal === "WAIT") {
    if (previous) await store.delete(stateKey);
    return;
  }
  if (!["BUY", "SELL"].includes(data.signal) || !data.tradePlan || previous?.signal === data.signal) return;

  const p = data.tradePlan;
  const freeText = `VANTAGE AI · FREE SIGNAL
${data.signal} · ${symbol}
Market price: ${fmt(data.price)}
${data.reason}
Premium trade plan: VANTAGE AI PREMIUM
Educational analysis only; trading involves risk.`;
  const premiumText = `VANTAGE AI · PREMIUM TRADE PLAN
${data.signal} · ${symbol}
Entry: ${fmt(p.entry)}
Stop Loss: ${fmt(p.stopLoss)}
TP1: ${fmt(p.takeProfit1)}
TP2: ${fmt(p.takeProfit2)}
TP3: ${fmt(p.takeProfit3)}
Risk/Reward: ${p.riskReward}
${data.reason}
Educational analysis only; trading involves risk.`;

  await Promise.all([send(freeChat, freeText, token), send(premiumChat, premiumText, token)]);
  await store.setJSON(stateKey, { signal: data.signal, candleTime: data.candleTime, sentAt: new Date().toISOString() });
};
