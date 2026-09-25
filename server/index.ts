import {GET,POST} from './rooms';
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  const origin=request.headers.get('Origin');
  const allowed=env.ALLOWED_ORIGINS.split(',').map(s=>s.trim());
  const cors:Record<string,string>={'Vary':'Origin','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
  if(origin&&!allowed.includes(origin))return Response.json({error:'Zugriff nicht erlaubt.'},{status:403,headers:cors});
  if(origin)cors['Access-Control-Allow-Origin']=origin;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'}});
  if(url.pathname==='/health')return Response.json({status:'ok',storage:'independent-d1'},{headers:cors});
  if(url.pathname!=='/api/rooms')return Response.json({error:'Nicht gefunden.'},{status:404,headers:cors});
  const response=request.method==='GET'?await GET(request):request.method==='POST'?await POST(request):Response.json({error:'Methode nicht erlaubt.'},{status:405});
  const result=new Response(response.body,response);for(const [key,value]of Object.entries(cors))result.headers.set(key,value);return result;
 }
} satisfies ExportedHandler<Env>;
