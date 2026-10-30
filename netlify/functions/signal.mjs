const ALLOWED = new Set(["AUD/USD","EUR/USD","GBP/USD","USD/JPY","USD/CHF","USD/CAD","NZD/USD","EUR/JPY"]);
function ema(values, period) {
  const k=2/(period+1); let result=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=period;i<values.length;i++) result=values[i]*k+result*(1-k); return result;
}
function rsi(values,period=14){
  let gains=0,losses=0;for(let i=1;i<=period;i++){const d=values[i]-values[i-1];if(d>0)gains+=d;else losses-=d;}
  let ag=gains/period,al=losses/period;
  for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];ag=(ag*(period-1)+Math.max(d,0))/period;al=(al*(period-1)+Math.max(-d,0))/period;}
  if(al===0)return 100;return 100-100/(1+ag/al);
}
function atr(candles,period=14){
 const tr=[];for(let i=1;i<candles.length;i++){const c=candles[i],p=candles[i-1];tr.push(Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close)));}
 return tr.slice(-period).reduce((a,b)=>a+b,0)/Math.min(period,tr.length);
}
export default async (request)=>{
 const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
 const symbol=new URL(request.url).searchParams.get("symbol")||"AUD/USD";
 if(!ALLOWED.has(symbol))return new Response(JSON.stringify({error:"Unsupported currency pair."}),{status:400,headers});
 const key=process.env.TWELVE_DATA_API_KEY;
 if(!key)return new Response(JSON.stringify({error:"Missing TWELVE_DATA_API_KEY in Netlify environment variables."}),{status:503,headers});
 try{
  const url=new URL("https://api.twelvedata.com/time_series");url.searchParams.set("symbol",symbol);url.searchParams.set("interval","1min");url.searchParams.set("outputsize","100");url.searchParams.set("timezone","UTC");
  const upstream=await fetch(url,{headers:{Authorization:`apikey ${key}`}});
  const payload=await upstream.json();
  if(!upstream.ok||payload.status==="error"||!Array.isArray(payload.values))return new Response(JSON.stringify({error:payload.message||payload.code||"Provider did not return candle data. Check your Twelve Data plan."}),{status:502,headers});
  const candles=payload.values.map(v=>({time:v.datetime,open:Number(v.open),high:Number(v.high),low:Number(v.low),close:Number(v.close)})).filter(v=>[v.open,v.high,v.low,v.close].every(Number.isFinite)).reverse();
  if(candles.length<30)return new Response(JSON.stringify({error:"Not enough candles to calculate indicators."}),{status:502,headers});
  const closes=candles.map(v=>v.close),last=closes.at(-1),fast=ema(closes,9),slow=ema(closes,21),momentum=rsi(closes,14),vol=atr(candles);
  const up=fast>slow,down=fast<slow,lastCandle=candles.at(-1);
  const bullishCandle=lastCandle.close>lastCandle.open;
  const bearishCandle=lastCandle.close<lastCandle.open;
  const emaGapAtr=vol>0?Math.abs(fast-slow)/vol:0;
  const gapScore=Math.min(15,Math.round(emaGapAtr*30));
  let signal="WAIT",reason="Conditions are mixed or the setup is not strong enough. Wait for confirmation.",strength=35;
  if(up&&momentum>=52&&momentum<=68&&bullishCandle&&emaGapAtr>=0.08){
   strength=Math.min(95,70+20+gapScore);
   if(strength>=80){signal="BUY";reason="BUY confirmed: EMA trend, RSI momentum, ATR-normalized EMA separation and bullish candle agree.";}
  } else if(down&&momentum>=32&&momentum<=48&&bearishCandle&&emaGapAtr>=0.08){
   strength=Math.min(95,70+20+gapScore);
   if(strength>=80){signal="SELL";reason="SELL confirmed: EMA trend, RSI momentum, ATR-normalized EMA separation and bearish candle agree.";}
  }
  if(signal==="WAIT")strength=Math.min(69,Math.max(25,35+gapScore+Math.round(Math.abs(momentum-50)*0.5)));
  let tradePlan=null;
  if(signal!=="WAIT"&&vol>0){
   const risk=vol*1.5,dir=signal==="BUY"?1:-1;
   tradePlan={entry:last,stopLoss:last-dir*risk,takeProfit1:last+dir*risk,takeProfit2:last+dir*risk*2,takeProfit3:last+dir*risk*3,riskReward:"1:1 / 1:2 / 1:3"};
  }
  return new Response(JSON.stringify({symbol,signal,reason,price:last,rsi:momentum,trend:up?"BULLISH":down?"BEARISH":"FLAT",strength,candleTime:candles.at(-1).time,interval:"1-minute",indicators:{ema9:fast,ema21:slow,atr14:vol},tradePlan,candles:candles.slice(-40),provider:"Twelve Data"}),{status:200,headers});
 }catch{return new Response(JSON.stringify({error:"Market data request failed. Try again shortly."}),{status:502,headers});}
};
