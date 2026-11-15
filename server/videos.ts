import {auth} from './rooms';
import {MAX_LIBRARY_BYTES, MAX_VIDEO_BYTES} from '@/lib/video-limits';

type VideoEnv = Env & { VIDEOS?: R2Bucket };
type Video = {object_id:string; bytes:number; secret_hash:string};
const error = (message:string,status:number) => Response.json({error:message},{status});

async function sign(video:Video,expires:number) {
 const encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(video.secret_hash),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=await crypto.subtle.sign('HMAC',key,encoder.encode(`${video.object_id}:${expires}`));
 return Array.from(new Uint8Array(mac),n=>n.toString(16).padStart(2,'0')).join('');
}

export async function videos(request:Request,url:URL,env:VideoEnv) {
 const bucket=env.VIDEOS;
 if(!bucket)return error('Videospeicher ist noch nicht eingerichtet.',503);
 const id=url.searchParams.get('film')||'';
 if(!/^[0-9a-f-]{36}$/.test(id))return error('Film nicht gefunden.',404);
 const lookup=env.DB.prepare('SELECT v.object_id,v.bytes,r.secret_hash FROM film_videos v JOIN films f ON f.id=v.film_id JOIN rooms r ON r.id=f.room_id WHERE v.film_id=? AND v.ready=1');
 if(request.method==='GET'&&url.searchParams.has('signature')){
  const expires=Number(url.searchParams.get('expires'));
  const signature=url.searchParams.get('signature')||'';
  if(!Number.isSafeInteger(expires)||expires<Date.now()||!/^[0-9a-f]{64}$/.test(signature))return error('Videolink abgelaufen oder ungültig.',403);
  const video=await lookup.bind(id).first<Video>();
  if(!video)return error('Video nicht gefunden.',404);
  const expected=await sign(video,expires);
  let mismatch=0;
  for(let i=0;i<64;i++)mismatch|=signature.charCodeAt(i)^expected.charCodeAt(i);
  if(mismatch)return error('Videolink ungültig.',403);
  const range=request.headers.get('Range');
  const match=range?.match(/^bytes=(\d*)-(\d*)$/);
  let start=0,end=video.bytes-1;
  if(range){
   if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${video.bytes}`}});
   if(match[1]){start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
   else start=Math.max(0,video.bytes-Number(match[2]));
   if(start>end)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${video.bytes}`}});
  }
  const length=end-start+1;
  const object=await bucket.get(video.object_id,range?{range:{offset:start,length}}:undefined);
  if(!object)return error('Video nicht gefunden.',404);
  const headers:Record<string,string>={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':String(length)};
  if(range)headers['Content-Range']=`bytes ${start}-${end}/${video.bytes}`;
  return new Response(object.body,{status:range?206:200,headers});
 }
 const room=await auth(request);
 if(!room)return error('Ungültiger Raumlink.',401);
 if(!await env.DB.prepare('SELECT 1 FROM films WHERE id=? AND room_id=?').bind(id,room.id).first())return error('Film nicht gefunden.',404);
 if(request.method==='GET'){
  const video=await lookup.bind(id).first<Video>();
  if(!video)return Response.json({url:null});
  const expires=Date.now()+60*60*1000;
  url.searchParams.set('expires',String(expires));
  url.searchParams.set('signature',await sign(video,expires));
  return Response.json({url:url.toString()});
 }
 if(request.method!=='POST')return error('Methode nicht erlaubt.',405);
 const size=Number(request.headers.get('Content-Length'));
 if(!request.body||request.headers.get('Content-Type')!=='video/mp4')return error('Bitte eine MP4-Datei auswählen.',415);
 if(!Number.isSafeInteger(size)||size<12||size>MAX_VIDEO_BYTES)return error('Die MP4-Datei darf höchstens 90 MB gross sein.',413);
 const objectId=crypto.randomUUID();
 // A single D1 statement reserves space even when uploads start concurrently.
 const reserved=await env.DB.prepare('INSERT OR IGNORE INTO film_videos (film_id,object_id,bytes) SELECT ?,?,? WHERE (SELECT COALESCE(SUM(bytes),0) FROM film_videos)+?<=?').bind(id,objectId,size,size,MAX_LIBRARY_BYTES).run();
 if(!reserved.meta.changes)return error('Für diesen Film gibt es bereits ein Video oder der Videospeicher ist voll.',409);
 try{
  const fixed=new FixedLengthStream(size);
  await Promise.all([
   request.body.pipeTo(fixed.writable),
   bucket.put(objectId,fixed.readable,{httpMetadata:{contentType:'video/mp4'}}),
  ]);
  await env.DB.prepare('UPDATE film_videos SET ready=1 WHERE object_id=?').bind(objectId).run();
 }catch{
  await bucket.delete(objectId);
  await env.DB.prepare('DELETE FROM film_videos WHERE object_id=?').bind(objectId).run();
  return error('Upload fehlgeschlagen. Bitte erneut versuchen.',503);
 }
 return Response.json({uploaded:true},{status:201});
}
