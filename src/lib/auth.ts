import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { MatchError } from './match';
import { localMode } from './storage';

const COOKIE='sports_admin';
const lifetime=60*60*18;
function settings(){
  const password=process.env.ADMIN_PASSWORD;
  const secret=process.env.SESSION_SECRET;
  if(!password || password.length<12 || !secret || secret.length<32)throw new MatchError('操作画面のパスワード設定がまだ完了していません。',503);
  return {password,secret};
}
const digest=(value:string)=>createHash('sha256').update(value).digest();
export function passwordMatches(input:string){return timingSafeEqual(digest(input),digest(settings().password));}
function sign(value:string){const s=settings();return createHmac('sha256',s.secret+s.password).update(value).digest('base64url');}
export async function authenticated(){
  const cookie=(await cookies()).get(COOKIE)?.value;
  if(!cookie)return false;
  try{
    const [expires,nonce,signature,...rest]=cookie.split('.');
    if(rest.length||!expires||!nonce||!signature||Number(expires)<Date.now())return false;
    return timingSafeEqual(digest(signature),digest(sign(`${expires}.${nonce}`)));
  }catch{return false;}
}
export async function requireAdmin(){if(!await authenticated())throw new MatchError('操作するにはログインしてください。',401);}
export async function login(){
  const token=`${Date.now()+lifetime*1000}.${randomBytes(18).toString('base64url')}`;
  (await cookies()).set(COOKIE,`${token}.${sign(token)}`,{httpOnly:true,secure:!localMode(),sameSite:'strict',maxAge:lifetime,path:'/'});
}
export async function logout(){(await cookies()).delete(COOKIE);}
export function sameOrigin(request:Request){
  const value=request.headers.get('origin');
  let origin:URL;
  try{origin=new URL(value||'');}catch{throw new MatchError('ページを再読み込みしてから操作してください。',403);}
  // Next.js may reconstruct request.url with an internal host behind its proxy.
  // The browser-controlled Origin must match the incoming public Host instead.
  if(origin.host!==request.headers.get('host') || !['http:','https:'].includes(origin.protocol) || (process.env.VERCEL&&origin.protocol!=='https:'))
    throw new MatchError('ページを再読み込みしてから操作してください。',403);
}
export function clientKey(request:Request){
  const header=process.env.VERCEL ? 'x-vercel-forwarded-for' : 'x-forwarded-for';
  return createHash('sha256').update(request.headers.get(header)?.split(',')[0]?.trim() || 'local').digest('hex').slice(0,24);
}
