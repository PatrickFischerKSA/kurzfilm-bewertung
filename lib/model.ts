import rubric from './rubric.json';
export type Subject = 'de' | 'ko';
export type Field = { film_id:string; key:string; value:string|number|null; version:number; updated_at:string };
export type Room = {name:string; films:{id:string;created_at:string}[]; fields:Field[]};
export const names = {de:'Deutsch',ko:'Kommunikation'};
export function valueOf(room:Room,film:string,key:string):Field['value'] { return room.fields.find(f=>f.film_id===film&&f.key===key)?.value ?? null; }
export function summary(get:(key:string)=>Field['value'],subject:Subject,rounding='0.1') {
 const missing=get('storyboard')==='missing';
 const scores=rubric[subject].map((_,i)=> i===5&&missing?0:get(`${subject}.score.${i}`));
 const count=scores.filter(v=>typeof v==='number').length;
 const total=scores.reduce<number>((n,v,i)=>n+(typeof v==='number'?v:0)*rubric[subject][i].weight,0);
 const raw=1+5*total/32;
 const step=Number(rounding);
 return {scores,count,total,raw,grade:count===6?(step?Math.round((raw+Number.EPSILON)/step)*step:raw):null};
}
export function validField(film:string,key:string,value:unknown) {
 if(film==='room') {
  if(key==='rounding')return ['0','0.1','0.5'].includes(String(value));
  if(key==='credits')return ['included','excluded','undecided'].includes(String(value));
  return /^teacher\.(de|ko)$/.test(key)&&typeof value==='string'&&value.length<=100;
 }
 if(/^(de|ko)\.score\.[0-5]$/.test(key))return value===null||(Number.isInteger(value)&&Number(value)>=0&&Number(value)<=4);
 if(key==='storyboard')return ['pending','present','missing'].includes(String(value));
 if(key==='duration')return value===null||(Number.isInteger(value)&&Number(value)>=0&&Number(value)<=36000);
 if(key==='title')return typeof value==='string'&&value.trim().length>0&&value.length<=200;
 return /^(names|strength|next|(de|ko)\.note\.[0-5])$/.test(key)&&typeof value==='string'&&value.length<=4000;
}
