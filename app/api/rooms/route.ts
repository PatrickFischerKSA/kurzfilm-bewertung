import {database} from '@/lib/database';
import {validField} from '@/lib/model';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
async function hash(s:string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join(''); }
async function auth(request:Request) {
 const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 const [id,secret]=token.split('.');
 if(!/^[0-9a-f-]{36}$/.test(id||'')||!/^[0-9a-f]{64}$/.test(secret||''))return null;
 return await database().prepare('SELECT id, name FROM rooms WHERE id=? AND secret_hash=?').bind(id,await hash(secret)).first<{id:string;name:string}>();
}
async function safe(request:Request,handler:()=>Promise<Response>) {
 try {
  if(request.method!=='GET'&&request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Zugriff nicht erlaubt.'},403);
  if(Number(request.headers.get('Content-Length')||0)>24000)return json({error:'Eingabe zu gross.'},413);
  return await handler();
 }catch(error){ console.error('Room request failed',error instanceof Error?error.message:'Unknown');return json({error:'Speichern oder Laden derzeit nicht möglich. Bitte erneut versuchen.'},503); }
}
export async function GET(request:Request) { return safe(request,async()=>{
 const room=await auth(request);if(!room)return json({error:'Dieser Raumlink ist ungültig oder nicht mehr verfügbar.'},401);
 const db=database();
 const [films,fields]=await db.batch([db.prepare('SELECT id, created_at FROM films WHERE room_id=? ORDER BY created_at, id').bind(room.id),db.prepare('SELECT film_id, key, value, version, updated_at FROM fields WHERE room_id=?').bind(room.id)]);
 return json({name:room.name,films:films.results,fields:(fields.results as Record<string,unknown>[]).map(f=>({...f,value:JSON.parse(f.value as string)}))});
 }); }
export async function POST(request:Request) {return safe(request,async()=>{
 const raw=await request.text();if(raw.length>24000)return json({error:'Eingabe zu gross.'},413);
 let p;try{p=JSON.parse(raw);}catch{return json({error:'Ungültige Eingabe.'},400);}
 const db=database();const now=new Date().toISOString();
 if(p.action==='create') {
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>100)return json({error:'Bitte einen Raumnamen angeben (max. 100 Zeichen).'},400);
  const id=crypto.randomUUID();const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  await db.prepare('INSERT INTO rooms (id,secret_hash,name,created_at) VALUES (?,?,?,?)').bind(id,await hash(secret),p.name.trim(),now).run();
  return json({token:`${id}.${secret}`},201);
 }
 const room=await auth(request);if(!room)return json({error:'Ungültiger Raumlink.'},401);
 if(p.action==='film') {
  if(!/^[0-9a-f-]{36}$/.test(p.id)||!validField(p.id,'title',p.title))return json({error:'Bitte einen Filmtitel angeben (max. 200 Zeichen).'},400);
  const exists=await db.prepare('SELECT room_id FROM films WHERE id=?').bind(p.id).first<{room_id:string}>();
  if(exists&&exists.room_id!==room.id)return json({error:'Ungültige Film-ID.'},400);
  await db.batch([db.prepare('INSERT OR IGNORE INTO films (id,room_id,created_at) VALUES (?,?,?)').bind(p.id,room.id,now),db.prepare('INSERT OR IGNORE INTO fields (room_id,film_id,key,value,version,updated_at) VALUES (?,?,?,?,1,?)').bind(room.id,p.id,'title',JSON.stringify(p.title.trim()),now)]);
  return json({id:p.id});
 }
 if(p.action==='field') {
  if(typeof p.film!=='string'||typeof p.key!=='string'||!validField(p.film,p.key,p.value)||!Number.isInteger(p.version)||p.version<0)return json({error:'Ungültiger Wert.'},400);
  if(p.film!=='room'&&!await db.prepare('SELECT id FROM films WHERE id=? AND room_id=?').bind(p.film,room.id).first())return json({error:'Film nicht gefunden.'},404);
  const result=p.version===0
   ? await db.prepare('INSERT OR IGNORE INTO fields (room_id,film_id,key,value,version,updated_at) VALUES (?,?,?,?,1,?)').bind(room.id,p.film,p.key,JSON.stringify(p.value),now).run()
   : await db.prepare('UPDATE fields SET value=?, version=version+1, updated_at=? WHERE room_id=? AND film_id=? AND key=? AND version=?').bind(JSON.stringify(p.value),now,room.id,p.film,p.key,p.version).run();
  const changed=result.meta.changes;
  const f=await db.prepare('SELECT film_id,key,value,version,updated_at FROM fields WHERE room_id=? AND film_id=? AND key=?').bind(room.id,p.film,p.key).first<{value:string}>();
  return json({field:f?{...f,value:JSON.parse(f.value)}:null},changed?200:409);
 }
 return json({error:'Unbekannte Aktion.'},400);
 });}
