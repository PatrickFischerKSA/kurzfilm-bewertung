import {useEffect,useState} from 'react';
import {API_URL} from '@/lib/deployment';

export function StoryboardFile({film,token}:{film:string;token:string}) {
 const [filename,setFilename]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const endpoint=new URL('../storyboards',API_URL+'/');
 endpoint.searchParams.set('film',film);
 const url=endpoint.toString();

 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   try{
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
    if(!response.ok)throw Error('Storyboard konnte nicht geladen werden.');
    const data=await response.json() as {filename:string|null};
    setFilename(data.filename);
   }catch(e){if(!controller.signal.aborted)setError((e as Error).message)}
  }
  void load();
  const interval=setInterval(()=>void load(),5000);
  return ()=>{controller.abort();clearInterval(interval)};
 },[url,token]);

 async function transfer(file?:File){
  setBusy(true);
  setError('');
  try{
   const target=new URL(url);
   target.searchParams.set(file?'filename':'download',file?.name??'1');
   const response=await fetch(target,{method:file?'POST':'GET',headers:{Authorization:`Bearer ${token}`},body:file});
   if(!response.ok){
    const data=await response.json() as {error:string};
    throw Error(data.error);
   }
   if(file){setFilename(file.name);return}
   const objectUrl=URL.createObjectURL(await response.blob());
   const link=document.createElement('a');
   link.href=objectUrl;
   link.download=filename||'Storyboard';
   link.click();
   setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }

 return <section className="film-video storyboard-file" aria-label="Storyboard-Datei">
  {filename?<button className="secondary" disabled={busy} onClick={()=>void transfer()}>Storyboard herunterladen · {filename}</button>:
   <label>Storyboard hinzufügen (PDF, DOCX oder DOC, max. 20 MB)
    <input type="file" accept=".pdf,.docx,.doc" disabled={busy} onChange={event=>{
     const file=event.currentTarget.files?.[0];
     event.currentTarget.value='';
     if(file)void transfer(file);
    }}/>
   </label>}
  {busy&&<p role="status">{filename?'Storyboard wird geladen …':'Storyboard wird hochgeladen …'}</p>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
