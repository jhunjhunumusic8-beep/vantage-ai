export default async (request) => {
 const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
 if(request.method!=="GET") return new Response(JSON.stringify({error:"Use GET."}),{status:405,headers});
 const token=process.env.TELEGRAM_BOT_TOKEN;
 const chatId=process.env.TELEGRAM_PREMIUM_CHAT_ID;
 if(!token||!chatId) return new Response(JSON.stringify({error:"Missing Telegram environment variables."}),{status:503,headers});
 const call=async(method,params={})=>{
  const q=new URLSearchParams(params);
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}?${q}`);
  return await r.json();
 };
 try{
  const me=await call("getMe");
  if(!me.ok) return new Response(JSON.stringify({stage:"getMe",telegramError:me.description||"Bot authentication failed"}),{status:502,headers});
  const chat=await call("getChat",{chat_id:chatId});
  if(!chat.ok) return new Response(JSON.stringify({stage:"getChat",bot:me.result.username,configuredChatId:chatId,telegramError:chat.description||"Telegram could not find this chat"}),{status:502,headers});
  const member=await call("getChatMember",{chat_id:chatId,user_id:me.result.id});
  return new Response(JSON.stringify({
   ok:true,bot:me.result.username,configuredChatId:chatId,
   chat:{id:chat.result.id,type:chat.result.type,title:chat.result.title||null},
   botMembership:member.ok?member.result.status:null,
   membershipError:member.ok?null:(member.description||"Could not read bot membership")
  }),{status:200,headers});
 }catch{
  return new Response(JSON.stringify({error:"Telegram diagnostic request failed."}),{status:502,headers});
 }
};