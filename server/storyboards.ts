import {auth} from './rooms';
import {MAX_LIBRARY_BYTES} from '@/lib/video-limits';

const maxBytes = 20_000_000;
const fail = (error: string, status: number) => Response.json({error}, {status});

export async function storyboards(request: Request, url: URL, env: Env & {VIDEOS?: R2Bucket}) {
 const bucket = env.VIDEOS;
 if (!bucket) return fail('Dateispeicher nicht verfügbar.', 503);
 const room = await auth(request);
 if (!room) return fail('Ungültiger Raumlink.', 401);
 const film = url.searchParams.get('film');
 const db = env.DB;
 if (!await db.prepare('SELECT id FROM films WHERE id=? AND room_id=?').bind(film, room.id).first())
  return fail('Film nicht gefunden.', 404);

 if (request.method === 'GET') {
  const file = await db.prepare('SELECT object_id, filename FROM film_storyboards WHERE film_id=? AND ready=1')
   .bind(film).first<{object_id: string; filename: string}>();
  if (!url.searchParams.has('download')) return Response.json({filename: file?.filename ?? null});
  if (!file) return fail('Storyboard nicht gefunden.', 404);
  const object = await bucket.get(file.object_id);
  if (!object) return fail('Storyboard nicht gefunden.', 404);
  return new Response(object.body, {headers: {
   'Content-Type': 'application/octet-stream',
   'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(file.filename),
  }});
 }
 if (request.method !== 'POST') return fail('Methode nicht erlaubt.', 405);
 const filename = url.searchParams.get('filename') ?? '';
 const extension = filename.match(/\.(pdf|docx|doc)$/i)?.[1].toLowerCase();
 if (!extension || filename.length > 200 || /[\/\\\x00-\x1f]/.test(filename))
  return fail('Bitte eine PDF-, DOCX- oder DOC-Datei auswählen.', 415);
 const size = Number(request.headers.get('Content-Length'));
 if (!request.body || !Number.isSafeInteger(size) || size < 8 || size > maxBytes)
  return fail('Das Storyboard darf höchstens 20 MB gross sein.', 413);
 const objectId = 'storyboards/' + crypto.randomUUID();
 const reservation = await db.prepare(
  'INSERT OR IGNORE INTO film_storyboards (film_id,object_id,bytes,filename) SELECT ?,?,?,? WHERE (SELECT COALESCE(SUM(bytes),0) FROM film_storyboards)+(SELECT COALESCE(SUM(bytes),0) FROM film_videos)+?<=?'
 ).bind(film, objectId, size, filename, size, MAX_LIBRARY_BYTES).run();
 if (!reservation.meta.changes) return fail('Ein Storyboard existiert bereits oder das Speicherlimit ist erreicht.', 409);
 try {
  const bytes = new Uint8Array(await request.arrayBuffer());
  const signature = Array.from(bytes.subarray(0, 8), byte => byte.toString(16).padStart(2, '0')).join('');
  const magic = {pdf:'255044462d', docx:'504b0304', doc:'d0cf11e0a1b11ae1'}[extension];
  if (bytes.length !== size || !magic || !signature.startsWith(magic)) {
   await db.prepare('DELETE FROM film_storyboards WHERE object_id=?').bind(objectId).run();
   return fail('Der Dateiinhalt passt nicht zum gewählten Format.', 415);
  }
  await bucket.put(objectId, bytes);
  await db.prepare('UPDATE film_storyboards SET ready=1 WHERE object_id=?').bind(objectId).run();
  return Response.json({filename}, {status:201});
 } catch {
  await bucket.delete(objectId);
  await db.prepare('DELETE FROM film_storyboards WHERE object_id=? AND ready=0').bind(objectId).run();
  return fail('Storyboard konnte nicht gespeichert werden.', 503);
 }
}
