const $ = (id) => document.getElementById(id);
const asset = $("asset"), scanBtn = $("scanBtn");
let countdown = 60, timerId, busy = false;
const TELEGRAM_URL = ""; // Example: "https://t.me/your_channel"
if (TELEGRAM_URL) { $("telegramLink").href = TELEGRAM_URL; }
else { $("telegramLink").addEventListener("click", e => { e.preventDefault(); $("hint").textContent = "Add your Telegram URL in app.js (TELEGRAM_URL)."; }); }

function clock(){ $("clock").textContent = new Date().toLocaleTimeString([], {hour12:false}); }
clock(); setInterval(clock,1000);
function tick(){ countdown--; if(countdown<=0) countdown=60; $("timer").textContent=`00:${String(countdown).padStart(2,"0")}`; }
tick(); timerId=setInterval(tick,1000);

function setSignal(type, data){
  const panel=$("signalPanel"), orb=$("signalOrb");
  panel.dataset.signal=type; orb.className="signal-orb";
  if(type==="BUY"||type==="SELL") orb.classList.add(type.toLowerCase());
  $("signal").textContent=type==="WAIT"?"WAIT":type;
  $("signal").style.color=type==="BUY"?"#40e0a0":type==="SELL"?"#ff5d78":"#e8edf4";
  $("signalSub").textContent=data.reason;
  $("status").textContent="ANALYSIS COMPLETE";
  $("price").textContent=Number(data.price).toFixed(data.price>100?3:5);
  $("rsi").textContent=Number(data.rsi).toFixed(1);
  $("trend").textContent=data.trend;
  $("strength").textContent=`${data.strength}%`;
  $("meterFill").style.width=`${data.strength}%`;
  $("feedState").textContent="Connected";
  $("lastUpdate").textContent=`Updated ${new Date().toLocaleTimeString()}`;
  $("hint").textContent=`${data.symbol} · ${data.candleTime} UTC · ${data.interval} candles`;
  const chip=document.createElement("span"); chip.className=`log-chip ${type.toLowerCase()}`;
  chip.textContent=`${data.symbol} ${type} · ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
  const list=$("logList"); if(list.querySelector(".empty-log")) list.innerHTML="";
  list.prepend(chip); while(list.children.length>4) list.lastChild.remove();
  $("logCount").textContent=`${list.children.length} entries`;
}

async function analyze(){
  if(busy)return; busy=true; scanBtn.disabled=true; scanBtn.querySelector("strong").textContent="ANALYZING...";
  $("status").textContent="FETCHING DATA"; $("hint").textContent="Requesting latest 1-minute market candles…";
  try{
    const response=await fetch(`/.netlify/functions/signal?symbol=${encodeURIComponent(asset.value)}`);
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||"Unable to retrieve market data.");
    setSignal(data.signal,data);
  }catch(err){
    $("status").textContent="DATA UNAVAILABLE"; $("signal").textContent="— —";
    $("signalSub").textContent="No signal generated. Check API setup and try again.";
    $("feedState").textContent="Connection issue";
    $("lastUpdate").textContent=err.message;
    $("hint").textContent=err.message;
  }finally{
    busy=false; scanBtn.disabled=false; scanBtn.querySelector("strong").textContent="ANALYZE MARKET";
  }
}
scanBtn.addEventListener("click",analyze);
asset.addEventListener("change",()=>{ $("signal").textContent="— —"; $("signalSub").textContent="Asset changed. Run a fresh analysis."; $("status").textContent="AWAITING SCAN"; $("price").textContent="—"; $("rsi").textContent="—"; $("trend").textContent="—"; $("strength").textContent="—"; $("meterFill").style.width="0"; });
