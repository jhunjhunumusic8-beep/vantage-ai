const ALLOWED = new Set(["AUD/USD","EUR/USD","GBP/USD","USD/JPY","USD/CHF","USD/CAD","NZD/USD","EUR/JPY"]);

function ema(values, period) {
  const k = 2 / (period + 1);
  let result = values.slice(0, period).reduce((a,b)=>a+b,0) / period;
  for (let i=period; i<values.length; i++) result = values[i]*k + result*(1-k);
  return result;
}
function rsi(values, period=14) {
  let gains=0, losses=0;
  for(let i=1;i<=period;i++){ const d=values[i]-values[i-1]; if(d>0) gains+=d; else losses-=d; }
  let avgGain=gains/period, avgLoss=losses/period;
  for(let i=period+1;i<values.length;i++){
    const d=values[i]-values[i-1];
    avgGain=(avgGain*(period-1)+Math.max(d,0))/period;
    avgLoss=(avgLoss*(period-1)+Math.max(-d,0))/period;
  }
  if(avgLoss===0) return 100;
  return 100-(100/(1+avgGain/avgLoss));
}
export default async (request) => {
  const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
  const symbol=new URL(request.url).searchParams.get("symbol") || "AUD/USD";
  if(!ALLOWED.has(symbol)) return new Response(JSON.stringify({error:"Unsupported currency pair."}),{status:400,headers});
  const key=process.env.TWELVE_DATA_API_KEY;
  if(!key) return new Response(JSON.stringify({error:"Missing TWELVE_DATA_API_KEY. Add it in Netlify → Site configuration → Environment variables."}),{status:503,headers});
  try{
    const url=new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol",symbol); url.searchParams.set("interval","1min");
    url.searchParams.set("outputsize","100"); url.searchParams.set("timezone","UTC");
    const upstream=await fetch(url,{headers:{Authorization:`apikey ${key}`}});
    const payload=await upstream.json();
    if(!upstream.ok || payload.status==="error" || !Array.isArray(payload.values)){
      return new Response(JSON.stringify({error:payload.message||payload.code||"Market data provider did not return candle data. Check your Twelve Data plan and symbol access."}),{status:502,headers});
    }
    // Provider returns newest first; indicators require oldest first.
    const candles=payload.values.map(v=>({time:v.datetime,close:Number(v.close)})).filter(v=>Number.isFinite(v.close)).reverse();
    if(candles.length<30) return new Response(JSON.stringify({error:"Not enough recent candles to calculate the strategy."}),{status:502,headers});
    const closes=candles.map(v=>v.close), last=closes.at(-1), fast=ema(closes,9), slow=ema(closes,21), momentum=rsi(closes,14);
    const up=fast>slow, down=fast<slow;
    let signal="WAIT", reason="Conditions are mixed. Wait for a clearer setup.", strength=35;
    if(up && momentum>=50 && momentum<=70){ signal="BUY"; reason="EMA 9 is above EMA 21 and RSI confirms positive momentum."; strength=Math.min(95,60+Math.round((momentum-50)*1.1)); }
    else if(down && momentum>=30 && momentum<=50){ signal="SELL"; reason="EMA 9 is below EMA 21 and RSI confirms negative momentum."; strength=Math.min(95,60+Math.round((50-momentum)*1.1)); }
    else { strength=Math.min(55,25+Math.round(Math.abs(momentum-50)*0.6)); }
    return new Response(JSON.stringify({
      symbol,signal,reason,price:last,rsi:momentum,trend:up?"BULLISH":down?"BEARISH":"FLAT",
      strength,candleTime:candles.at(-1).time,interval:"1-minute",
      indicators:{ema9:fast,ema21:slow},provider:"Twelve Data"
    }),{status:200,headers});
  }catch(error){
    return new Response(JSON.stringify({error:"Market data request failed. Please try again shortly."}),{status:502,headers});
  }
};