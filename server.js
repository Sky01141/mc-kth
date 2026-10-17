const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const PUB=path.join(__dirname,'public'),MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css'};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);if(p=='/')p='/index.html';
  const f=path.normalize(path.join(PUB,p));
  if(!f.startsWith(PUB))return res.writeHead(403).end();
  fs.readFile(f,(e,d)=>{if(e)return res.writeHead(404).end('not found');res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d)});
});
const wss=new WebSocketServer({server});
const seed=Math.floor(Math.random()*100000),edits=new Map(),players=new Map();let nextId=1;
const send=(w,o)=>w.readyState===1&&w.send(JSON.stringify(o));
const bcast=(o,ex)=>{for(const w of players.keys())if(w!==ex)send(w,o)};
wss.on('connection',ws=>{
  const me={id:nextId++,name:null,x:8,y:60,z:8,ry:0};players.set(ws,me);ws.alive=true;
  ws.on('pong',()=>ws.alive=true);
  send(ws,{t:'init',id:me.id,seed,
    edits:[...edits].map(([k,b])=>[...k.split(',').map(Number),b]),
    players:[...players.values()].filter(p=>p.name&&p!==me)});
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    if(m.t=='hello'){me.name=String(m.name||'Player').slice(0,12);bcast({t:'join',...me},ws)}
    else if(m.t=='pos'&&me.name){me.x=+m.x||0;me.y=+m.y||0;me.z=+m.z||0;me.ry=+m.ry||0;bcast({t:'pos',id:me.id,x:me.x,y:me.y,z:me.z,ry:me.ry},ws)}
    else if(m.t=='set'){const{x,y,z,b}=m;
      if([x,y,z,b].every(Number.isInteger)&&y>=0&&y<64&&b>=0&&b<=8&&Math.abs(x)<1e6&&Math.abs(z)<1e6){
        edits.set(x+','+y+','+z,b);bcast({t:'set',x,y,z,b},ws)}}
  });
  ws.on('close',()=>{players.delete(ws);bcast({t:'leave',id:me.id})});
});
setInterval(()=>{for(const w of wss.clients){if(!w.alive){w.terminate();continue}w.alive=false;w.ping()}},30000);
server.listen(process.env.PORT||3000,()=>console.log('listening'));
