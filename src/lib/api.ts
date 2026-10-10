import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { MatchError } from './match';
export const noCache={'Cache-Control':'no-store, max-age=0'};
export function failure(error:unknown){
  if(error instanceof MatchError)return NextResponse.json({error:error.message},{status:error.status,headers:noCache});
  if(error instanceof ZodError || error instanceof SyntaxError)return NextResponse.json({error:'入力内容を確認してください。'},{status:400,headers:noCache});
  console.error('Sports request failed',error instanceof Error ? error.name : 'UnknownError');
  return NextResponse.json({error:'保存先に接続できませんでした。通信を確認して再試行してください。'},{status:503,headers:noCache});
}
export async function jsonBody(request:Request,max=12000){
  const reader=request.body?.getReader();
  if(!reader)throw new MatchError('入力がありません。');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>max){await reader.cancel();throw new MatchError('入力が大きすぎます。',413);}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
