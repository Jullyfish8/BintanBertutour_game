import { env } from 'cloudflare:workers';
type State = {phase:string;batch:number;side:number;heat:number;until:number;tick:number;results:string[];players:number[];lastFan?:number};
const fresh=():State=>({phase:'lobby',batch:0,side:0,heat:20,until:0,tick:Date.now()/1000,results:[],players:[0]});
function update(s:State){const now=Date.now()/1000;
 if(s.phase==='countdown'&&now>=s.until){s.tick=s.until;s.until+=10;s.phase='cooking';}
 if(s.phase==='cooking'){
  const end=Math.min(now,s.until);s.heat=Math.max(0,s.heat-Math.max(0,end-s.tick)*12);s.tick=end;
  if(now>=s.until){s.results.push(s.heat<40?'Undercooked':s.heat>70?'Burnt':'Well-done');s.phase=s.side===0?'flip':'result';}
 }
}
const reply=(s:unknown,status=200)=>Response.json(s,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const code=new URL(request.url).searchParams.get('room');
 const row=await env.DB.prepare('SELECT data FROM rooms WHERE code = ?').bind(code).first<{data:string}>();
 if(!row)return reply({error:'Room not found. Create a new room.'},404);
 const s=JSON.parse(row.data);update(s);return reply({...s,serverTime:Date.now()/1000});
}
export async function POST(request:Request){
 const d=await request.json() as {action:string;room?:string;player?:number;amount?:number};
 if(d.action==='create'){
  const code=crypto.randomUUID().replaceAll('-','').slice(0,6).toUpperCase();
  await env.DB.prepare('INSERT INTO rooms (code,data,revision) VALUES (?,?,0)').bind(code,JSON.stringify(fresh())).run();
  return reply({room:code,player:0});
 }
 const code=String(d.room||'').toUpperCase();
 for(let attempt=0;attempt<8;attempt++){
  const row=await env.DB.prepare('SELECT data,revision FROM rooms WHERE code = ?').bind(code).first<{data:string;revision:number}>();
  if(!row)return reply({error:'Room not found. Check the code.'},404);
  let s:State=JSON.parse(row.data);update(s);const p=d.player;
  if(d.action==='join'){
   if(s.players.includes(1))return reply({error:'This room already has two players. Create a new room.'},409);
   s.players.push(1);
  }
  if(d.action==='start'&&(s.phase==='lobby'||(s.phase==='result'&&s.batch===0))){
   if(s.phase==='result'){s.batch=1;s.side=0;}
   s.phase='countdown';s.until=Date.now()/1000+3;s.heat=20;s.lastFan=0;
  }
  if(d.action==='swipe'&&p===s.batch&&s.phase==='cooking'){s.heat=Math.min(100,s.heat+Math.min(9,Math.max(0,Number(d.amount)||0)));s.lastFan=Date.now()/1000;}
  if(d.action==='flip'&&p===1-s.batch&&s.phase==='flip'){s.side=1;s.phase='countdown';s.until=Date.now()/1000+3;s.heat=20;s.lastFan=0;}
  if(d.action==='reset'){const players=s.players;s=fresh();s.players=players;}
  const saved=await env.DB.prepare('UPDATE rooms SET data=?, revision=revision+1 WHERE code=? AND revision=?').bind(JSON.stringify(s),code,row.revision).run();
  if(saved.meta.changes)return reply(d.action==='join'?{room:code,player:1}:{...s,serverTime:Date.now()/1000});
 }
 return reply({error:'Please try that action again.'},409);
}
