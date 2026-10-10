import { NextResponse } from 'next/server';
import { authenticated,clientKey,login,logout,passwordMatches,sameOrigin } from '@/lib/auth';
import { rateLimit,localMode } from '@/lib/storage';
import { MatchError } from '@/lib/match';
import { failure,noCache,jsonBody } from '@/lib/api';
import { z } from 'zod';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({authenticated:await authenticated(),demo:localMode()},{headers:noCache});}
export async function POST(request:Request){
  try{
    sameOrigin(request);
    if(!await rateLimit(`login:${clientKey(request)}`,10,900))throw new MatchError('試行回数が上限に達しました。15分後にお試しください。',429);
    const {password}=z.object({password:z.string().min(1).max(200)}).parse(await jsonBody(request,1000));
    if(!passwordMatches(password))throw new MatchError('パスワードが違います。',401);
    await login();return NextResponse.json({authenticated:true},{headers:noCache});
  }catch(e){return failure(e);}
}
export async function DELETE(request:Request){try{sameOrigin(request);await logout();return NextResponse.json({authenticated:false},{headers:noCache});}catch(e){return failure(e);}}
