const $ = (id) => document.getElementById(id);
const asset = $("asset"), scanBtn = $("scanBtn");
let countdown = 60, busy = false, latestSignal = null;
const HISTORY_KEY = "vantage_ai_signal_history_v1";
const TELEGRAM_URL = ""; // Optional: https://t.me/your_channel
if (TELEGRAM_URL) $("telegramLink").href = TELEGRAM_URL;
else $("telegramLink").addEventListener("click", e => { e.preventDefault(); $("hint").textContent = "Set your Telegram channel URL in app.js."; });

function clock(){ $("clock").textContent = new Date().toLocaleTimeString([], {hour12:false}); }
clock(); setInterval(clock,1000);
function tick(){ countdown--; if(countdown<=0) countdown=60; $("timer").textContent=`00:${String(countdown).padStart(2,"0")}`; }
tick(); setInterval(tick,1000);

function readHistory(){ try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");}catch{return [];} }
function saveHistory(items){ localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,100))); }
function fmt(n){ if(n===null||n===undefined||!Number.isFinite(Number(n))) return "—"; const v=Number(n); return v>100? v.toFixed(3):v.toFixed(5); }
function renderHistory(){
  const items=readHistory(), list=$("historyList");
  if(!items.length){list.innerHTML='<span class="empty-log">No saved signals yet.</span>';}
  else list.innerHTML=items.slice(0,12).map(x=>`<div class="history-row"><div><b class="${x.signal.toLowerCase()}">${x.signal}</b><span>${x.symbol} · ${new Date(x.createdAt).toLocaleString()}</span></div><strong>${x.outcome||"PENDING"}</strong></div>`).join("");
  const done=items.filter(x=>x.outcome==="WIN"||x.outcome==="LOSS"), wins=done.filter(x=>x.outcome==="WIN").length, losses=done.length-wins;
  $("wins").textContent=wins; $("losses").textContent=losses; $("resolved").textContent=done.length;
  $("winRate").textContent=done.length?`${Math.round(wins/done.length*100)}%`:"—";
  $("accuracyFill").style.width=done.length?`${wins/done.length*100}%`:"0%";
}
function renderLevels(data){
  const p=data.tradePlan;
  $("entryPrice").textContent=p?fmt(p.entry):"—"; $("stopLoss").textContent=p?fmt(p.stopLoss):"—";
  $("takeProfit1").textContent=p?fmt(p.takeProfit1):"—"; $("takeProfit2").textContent=p?fmt(p.takeProfit2):"—";
  $("takeProfit3").textContent=p?fmt(p.takeProfit3):"—"; $("riskReward").textContent=p?`1 : ${p.riskReward}`:"—";
  $("telegramAlertBtn").disabled=!p;
}
function setSignal(type,data){
  const panel=$("signalPanel"), orb=$("signalOrb");
  panel.dataset.signal=type; orb.className="signal-orb";
  if(type==="BUY"||type==="SELL") orb.classList.add(type.toLowerCase());
  $("signal").textContent=type; $("signal").style.color=type==="BUY"?"#40e0a0":type==="SELL"?"#ff5d78":"#e8edf4";
  $("signalSub").textContent=data.reason; $("status").textContent="ANALYSIS COMPLETE";
  $("price").textContent=fmt(data.price); $("rsi").textContent=Number(data.rsi).toFixed(1); $("trend").textContent=data.trend;
  $("strength").textContent=`${data.strength}%`; $("meterFill").style.width=`${data.strength}%`;
  $("feedState").textContent="Connected"; $("lastUpdate").textContent=`Updated ${new Date().toLocaleTimeString()}`;
  $("hint").textContent=`${data.symbol} · ${data.candleTime} UTC · ${data.interval} candles`;
  const chip=document.createElement("span"); chip.className=`log-chip ${type.toLowerCase()}`;
  chip.textContent=`${data.symbol} ${type} · ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
  const list=$("logList"); if(list.querySelector(".empty-log")) list.innerHTML="";
  list.prepend(chip); while(list.children.length>4) list.lastChild.remove(); $("logCount").textContent=`${list.children.length} entries`;
  latestSignal=data; renderLevels(data);
}
async function resolveMatured(){
  const items=readHistory(), now=Date.now(); let changed=false;
  for(const item of items){
    if(item.outcome || now-item.createdAt<15*60*1000) continue;
    try{
      const r=await fetch(`/.netlify/functions/signal?symbol=${encodeURIComponent(item.symbol)}`);
      const d=await r.json(); if(!r.ok||!Number.isFinite(Number(d.price))) continue;
      const delta=Number(d.price)-item.entry;
      item.outcome=(item.signal==="BUY" ? delta>0 : delta<0)?"WIN":(delta===0?"FLAT":"LOSS");
      item.exitPrice=Number(d.price); item.resolvedAt=now; changed=true;
    }catch{}
  }
  if(changed){saveHistory(items);renderHistory();}
}

async function analyze(){
  if(busy) return;

  busy = true;
  scanBtn.disabled = true;
  scanBtn.querySelector("strong").textContent = "ANALYZING...";
  $("status").textContent = "FETCHING DATA";
  $("hint").textContent = "Requesting latest 1-minute market candles…";

  try {
    const response = await fetch(
      `/.netlify/functions/signal?symbol=${encodeURIComponent(asset.value)}`
    );

    const data = await response.json();

    if(!response.ok) {
      throw new Error(data.error || "Unable to retrieve market data.");
    }

    setSignal(data.signal, data);

    const symbol = data.symbol;
    const signal = data.signal;

    let observed = {};
    let alerted = {};

    try {
      observed = JSON.parse(localStorage.getItem("vantage_observed_signals") || "{}");
      alerted = JSON.parse(localStorage.getItem("vantage_alerted_signals") || "{}");
    } catch {}

    const isNewSignal =
      (signal === "BUY" || signal === "SELL") &&
      observed[symbol] !== signal;

    observed[symbol] = signal;
    localStorage.setItem("vantage_observed_signals", JSON.stringify(observed));

    if(signal === "WAIT") {
      delete alerted[symbol];
      localStorage.setItem("vantage_alerted_signals", JSON.stringify(alerted));
    }

    if(isNewSignal) {
      const items = readHistory();

      items.unshift({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        symbol: symbol,
        signal: signal,
        entry: Number(data.price),
        createdAt: Date.now(),
        outcome: null
      });

      saveHistory(items);
      renderHistory();
    }

    if(
      (signal === "BUY" || signal === "SELL") &&
      alerted[symbol] !== signal &&
      data.tradePlan
    ) {
      try {
        const telegramResponse = await fetch(
          "/.netlify/functions/telegram-alert",
          {
            method: "POST",
            headers: {"content-type": "application/json"},
            body: JSON.stringify({
              symbol: data.symbol,
              signal: data.signal,
              price: data.price,
              tradePlan: data.tradePlan,
              reason: data.reason
            })
          }
        );

        const telegramData = await telegramResponse.json();

        if(!telegramResponse.ok) {
          throw new Error(telegramData.error || "Telegram alert failed.");
        }

        alerted[symbol] = signal;
        localStorage.setItem("vantage_alerted_signals", JSON.stringify(alerted));
        $("telegramStatus").textContent = "Automatic Telegram alert sent successfully.";
      } catch(error) {
        $("telegramStatus").textContent = "Telegram alert failed: " + error.message;
      }
    }

    await resolveMatured();

  } catch(err) {
    $("status").textContent = "DATA UNAVAILABLE";
    $("signal").textContent = "— —";
    $("signalSub").textContent = "No signal generated. Check API setup and try again.";
    $("feedState").textContent = "Connection issue";
    $("lastUpdate").textContent = err.message;
    $("hint").textContent = err.message;

  } finally {
    busy = false;
    scanBtn.disabled = false;
    scanBtn.querySelector("strong").textContent = "ANALYZE MARKET";
  }
}

    await resolveMatured();
  }catch(err){
    $("status").textContent="DATA UNAVAILABLE"; $("signal").textContent="— —"; $("signalSub").textContent="No signal generated. Check API setup and try again.";
    $("feedState").textContent="Connection issue"; $("lastUpdate").textContent=err.message; $("hint").textContent=err.message;
  }finally{busy=false;scanBtn.disabled=false;scanBtn.querySelector("strong").textContent="ANALYZE MARKET";}
}
scanBtn.addEventListener("click",analyze);
asset.addEventListener("change",()=>{$("signal").textContent="— —";$("signalSub").textContent="Asset changed. Run a fresh analysis.";$("status").textContent="AWAITING SCAN";["price","rsi","trend","strength"].forEach(id=>$(id).textContent="—");$("meterFill").style.width="0";latestSignal=null;renderLevels({});});
$("clearHistoryBtn").addEventListener("click",()=>{if(confirm("Clear signal history stored in this browser?")){saveHistory([]);renderHistory();}});
$("telegramAlertBtn").addEventListener("click",async()=>{
 if(!latestSignal?.tradePlan)return;
 const btn=$("telegramAlertBtn");btn.disabled=true;$("telegramStatus").textContent="Sending Telegram alert…";
 try{
  const r=await fetch("/.netlify/functions/telegram-alert",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({symbol:latestSignal.symbol,signal:latestSignal.signal,price:latestSignal.price,tradePlan:latestSignal.tradePlan,reason:latestSignal.reason})});
  const d=await r.json();if(!r.ok)throw new Error(d.error||"Telegram alert failed.");
  $("telegramStatus").textContent="Telegram alert sent successfully.";
 }catch(e){$("telegramStatus").textContent=e.message;}
 finally{btn.disabled=false;}
});
renderHistory();
resolveMatured();
analyze();
setInterval(analyze, 60000);
