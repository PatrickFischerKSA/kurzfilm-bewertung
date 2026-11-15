import {useEffect,useState} from 'react';
import {API_URL} from '@/lib/deployment';
import {MAX_VIDEO_BYTES} from '@/lib/video-limits';

export function FilmVideo({film,token}:{film:string;token:string}) {
 const [source,setSource]=useState<string|null>(null);
 const [loaded,setLoaded]=useState(false);
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
   setError('Bitte eine MP4-Datei mit höchstens 90 MB wählen.');
   return;
  }
  setUploading(true);
  try{
   const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'video/mp4'},body:file});
   const data=await response.json() as {url?:string|null;error?:string};
   if(!response.ok)throw Error(data.error);
   refresh(n=>n+1);
  }catch(e){setError((e as Error).message)}
  finally{setUploading(false)}
 }

 return <section aria-label="Filmvideo" className="film-video">
  {source ? <video aria-label="Film abspielen" controls playsInline preload="metadata" src={source} onError={()=>setError('Video kann nicht abgespielt werden. Bitte verwende MP4 mit H.264 und AAC.')}/> :
   loaded&&<label>Video hinzufügen (MP4, max. 90 MB)
    <input type="file" accept=".mp4,video/mp4" disabled={uploading} onChange={event=>{
     const file=event.currentTarget.files?.[0];
     event.currentTarget.value='';
     if(file)void upload(file);
    }}/>
   </label>}
  {uploading&&<p role="status">Video wird hochgeladen …</p>}
  {error&&<p role="alert">{error}</p>}
  {source&&error&&<button type="button" onClick={()=>{setError('');setSource(null);refresh(n=>n+1)}}>Video erneut laden</button>}
 </section>;
}
