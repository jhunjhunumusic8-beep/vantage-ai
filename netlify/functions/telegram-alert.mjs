export default async (request) => {
 const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
 if(request.method!=="POST")return new Response(JSON.stringify({error:"Use POST."}),{status:405,headers});
 const token=process.env.TELEGRAM_BOT_TOKEN;
 const freeChat=process.env.TELEGRAM_CHAT_ID;
 const premiumChat=process.env.TELEGRAM_PREMIUM_CHAT_ID;
 if(!token||!freeChat||!premiumChat)return new Response(JSON.stringify({error:"Add TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and TELEGRAM_PREMIUM_CHAT_ID in Netlify environment variables."}),{status:503,headers});
 try{
  const body=await request.json();
  if(!["BUY","SELL"].includes(body.signal)||!body.tradePlan)return new Response(JSON.stringify({error:"Only actionable BUY/SELL signals can be sent."}),{status:400,headers});
  const p=body.tradePlan,fmt=n=>Number(n).toFixed(Number(n)>100?3:5);
  const freeMessage=`VANTAGE AI · FREE SIGNAL
${body.signal} · ${body.symbol}
Market price: ${fmt(body.price)}
${body.reason||"Rule-based market signal."}

Full trade plan is available in VANTAGE AI PREMIUM.
Educational analysis only; not financial advice. Trading involves risk.`;
  const premiumMessage=`VANTAGE AI · PREMIUM TRADE PLAN
${body.signal} · ${body.symbol}
Entry: ${fmt(p.entry)}
Stop Loss: ${fmt(p.stopLoss)}
TP1: ${fmt(p.takeProfit1)}
TP2: ${fmt(p.takeProfit2)}
TP3: ${fmt(p.takeProfit3)}
Risk/Reward: ${p.riskReward}
Analysis: ${body.reason||"Rule-based market analysis."}

Educational analysis only; not financial advice. Trading involves risk.`;
  const send=async(chat_id,text)=>{
   const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id,text})});
   const data=await r.json();
   return {ok:r.ok&&data.ok,error:data.description||(!r.ok?"Telegram delivery failed.":null)};
  };
  const [free,premium]=await Promise.all([send(freeChat,freeMessage),send(premiumChat,premiumMessage)]);
  if(!free.ok||!premium.ok)return new Response(JSON.stringify({ok:false,freeSent:free.ok,premiumSent:premium.ok,error:[!free.ok&&`Free: ${free.error}`,!premium.ok&&`Premium: ${premium.error}`].filter(Boolean).join("; ")}),{status:502,headers});
  return new Response(JSON.stringify({ok:true,freeSent:true,premiumSent:true}),{status:200,headers});
 }catch{return new Response(JSON.stringify({error:"Invalid request or Telegram service unavailable."}),{status:400,headers});}
};
