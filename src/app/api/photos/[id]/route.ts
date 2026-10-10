import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { localMode,localDataDir } from '@/lib/storage';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!localMode()||!/^[-a-f0-9]{36}$/.test(id))return new Response(null,{status:404});
  try{return new Response(await readFile(path.join(localDataDir(),'photos',`${id}.jpg`)),{headers:{'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff'}});}
  catch{return new Response(null,{status:404});}
}
