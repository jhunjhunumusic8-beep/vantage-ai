export default async (request) => {
 const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
 if(request.method!=="POST")return new Response(JSON.stringify({error:"Use POST."}),{status:405,headers});
 const token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;
 if(!token||!chat)return new Response(JSON.stringify({error:"Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Netlify environment variables."}),{status:503,headers});
 try{
  const body=await request.json();
  if(!["BUY","SELL"].includes(body.signal)||!body.tradePlan)return new Response(JSON.stringify({error:"Only actionable BUY/SELL signals can be sent."}),{status:400,headers});
  const p=body.tradePlan,fmt=n=>Number(n).toFixed(Number(n)>100?3:5);
  const message=`VANTAGE AI SIGNAL\n${body.signal} · ${body.symbol}\nEntry: ${fmt(p.entry)}\nStop Loss: ${fmt(p.stopLoss)}\nTP1: ${fmt(p.takeProfit1)}\nTP2: ${fmt(p.takeProfit2)}\nTP3: ${fmt(p.takeProfit3)}\nRisk/Reward: ${p.riskReward}\n${body.reason}\n\nRule-based analysis only. Not financial advice.`;
  const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chat,text:message})});
  const data=await r.json();
  if(!r.ok||!data.ok)return new Response(JSON.stringify({error:data.description||"Telegram delivery failed."}),{status:502,headers});
  return new Response(JSON.stringify({ok:true}),{status:200,headers});
 }catch{return new Response(JSON.stringify({error:"Invalid request or Telegram service unavailable."}),{status:400,headers});}
};
