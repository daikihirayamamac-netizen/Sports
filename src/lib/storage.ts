import { Redis } from '@upstash/redis';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { initialBoard, MatchError, type Board } from './match';

export const localMode = () => process.env.LOCAL_DEMO==='1' && !process.env.VERCEL;
export const namespace = () => process.env.DATA_NAMESPACE || `sports-${process.env.VERCEL_ENV || 'development'}`;
export function redis() {
  const url=process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if(!url||!token) throw new MatchError('共有用の保存先が未接続です。VercelにUpstash Redisを接続してください。',503);
  return new Redis({url,token,automaticDeserialization:true});
}
const dataDir=()=>process.env.LOCAL_DATA_DIR || path.join(process.cwd(),'.local-data');
export const localDataDir=dataDir;
async function readLocal():Promise<Board> {
  try{return JSON.parse(await readFile(path.join(dataDir(),'board.json'),'utf8'));}
  catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return initialBoard();throw e;}
}
export async function readBoard():Promise<Board> {
  if(localMode())return readLocal();
  return await redis().get<Board>(`${namespace()}:board`) || initialBoard();
}
let queue:Promise<unknown>=Promise.resolve();
export async function compareAndSet(expected:number,next:Board):Promise<boolean> {
  if(localMode()){
    const operation=queue.then(async()=>{
      if((await readLocal()).version!==expected)return false;
      await mkdir(dataDir(),{recursive:true});
      const temp=path.join(dataDir(),'board.tmp');
      await writeFile(temp,JSON.stringify(next));
      await rename(temp,path.join(dataDir(),'board.json'));
      return true;
    });
    queue=operation.catch(()=>{});return operation;
  }
  const lua=`local raw=redis.call('GET',KEYS[1])
    local version=0
    if raw then version=cjson.decode(raw).version end
    if version~=tonumber(ARGV[1]) then return 0 end
    redis.call('SET',KEYS[1],ARGV[2])
    return 1`;
  return (await redis().eval(lua,[`${namespace()}:board`],[expected,JSON.stringify(next)]))===1;
}
const localLimits=new Map<string,{count:number;reset:number}>();
export async function rateLimit(key:string,limit:number,seconds:number) {
  if(localMode()){
    const now=Date.now();const item=localLimits.get(key);
    if(!item || item.reset<=now){localLimits.set(key,{count:1,reset:now+seconds*1000});return true;}
    item.count++;return item.count<=limit;
  }
  const count=await redis().eval(`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`,
    [`${namespace()}:rate:${key}`],[seconds]);
  return Number(count)<=limit;
}
