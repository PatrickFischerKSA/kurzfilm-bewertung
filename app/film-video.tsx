import {useEffect,useState} from 'react';
import {API_URL} from '@/lib/deployment';
import {MAX_VIDEO_BYTES, VIDEO_PART_BYTES} from '@/lib/video-limits';

export function FilmVideo({film,token}:{film:string;token:string}) {
 const [source,setSource]=useState<string|null>(null);
 const [loaded,setLoaded]=useState(false);
 const [progress,setProgress]=useState(0);
 const [uploading,setUploading]=useState(false);
 const [error,setError]=useState('');
 const [revision,refresh]=useState(0);
 const endpoint=new URL('../videos',API_URL+'/');
 endpoint.searchParams.set('film',film);
 const url=endpoint.toString();

 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   try{
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
    const data=await response.json() as {url?:string|null;error?:string};
    if(!response.ok)throw Error(data.error);
    setSource(previous=>previous||data.url||null);
    setLoaded(true);
   }catch(e){if(!controller.signal.aborted)setError((e as Error).message)}
  }
  void load();
  const poll=setInterval(()=>{if(!source)void load()},5000);
  return ()=>{controller.abort();clearInterval(poll)};
 },[url,token,revision,source]);

 async function upload(file:File) {
  setError('');
  if(!/\.mp4$/i.test(file.name)||file.size>MAX_VIDEO_BYTES){
   setError('Bitte eine MP4-Datei mit höchstens 600 MB wählen.');
   return;
  }
  setUploading(true);
  setProgress(0);
  let session='';
  async function send(action:string,params:Record<string,string>={},body?:BodyInit){
   const target=new URL(url);
   target.searchParams.set('action',action);
   if(session)target.searchParams.set('session',session);
   for(const [key,value] of Object.entries(params))target.searchParams.set(key,value);
   for(let attempt=0;;attempt++){
    let response:Response;
    try{response=await fetch(target,{method:'POST',headers:{Authorization:`Bearer ${token}`},body})}
    catch(error){if(action!=='start'&&attempt<2)continue;throw error}
    if(response.status>=500&&action!=='start'&&attempt<2)continue;
    const data=await response.json() as {session?:string;partNumber?:number;etag?:string;error?:string};
    if(!response.ok)throw Error(data.error||'Upload fehlgeschlagen.');
    return data;
   }
  }
  try{
   session=(await send('start',{size:String(file.size)})).session||'';
   if(!session)throw Error('Upload konnte nicht gestartet werden.');
   const parts=[];
   for(let offset=0;offset<file.size;offset+=VIDEO_PART_BYTES){
    const end=Math.min(offset+VIDEO_PART_BYTES,file.size);
    parts.push(await send('part',{part:String(parts.length+1)},file.slice(offset,end)));
    setProgress(Math.floor(100*end/file.size));
   }
   await send('complete',{},JSON.stringify(parts));
   refresh(n=>n+1);
  }catch(e){
   if(session)await send('abort').catch(()=>{});
   setError((e as Error).message);
  }finally{setUploading(false)}

 }

 return <section aria-label="Filmvideo" className="film-video">
  {source ? <video aria-label="Film abspielen" controls playsInline preload="metadata" src={source} onError={()=>setError('Video kann nicht abgespielt werden. Bitte verwende MP4 mit H.264 und AAC.')}/> :
   loaded&&<label>Video hinzufügen (MP4, max. 600 MB)
    <input type="file" accept=".mp4,video/mp4" disabled={uploading} onChange={event=>{
     const file=event.currentTarget.files?.[0];
     event.currentTarget.value='';
     if(file)void upload(file);
    }}/>
   </label>}
  {uploading&&<p role="status">Video wird hochgeladen … {progress} %</p>}
  {error&&<p role="alert">{error}</p>}
  {source&&error&&<button type="button" onClick={()=>{setError('');setSource(null);refresh(n=>n+1)}}>Video erneut laden</button>}
 </section>;
}
