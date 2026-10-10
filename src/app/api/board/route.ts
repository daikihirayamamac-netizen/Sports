import { NextResponse } from 'next/server';
import { readBoard,compareAndSet,localMode,rateLimit } from '@/lib/storage';
import { applyAction,commandSchema,publicBoard,MatchError } from '@/lib/match';
import { requireAdmin,sameOrigin } from '@/lib/auth';
import { failure,noCache,jsonBody } from '@/lib/api';
export const dynamic='force-dynamic';
export async function GET(){
  try{return NextResponse.json({board:publicBoard(await readBoard()),serverNow:Date.now(),demo:localMode()}, {headers:noCache});}
  catch(e){return failure(e);}
}
export async function POST(request:Request){
  try{
    sameOrigin(request);await requireAdmin();
    if(!await rateLimit('updates',90,60))throw new MatchError('操作が多すぎます。少し待ってから再試行してください。',429);
    const command=commandSchema.parse(await jsonBody(request));
    const board=await readBoard();
    if(board.commandIds.includes(command.id))return NextResponse.json({board:publicBoard(board),serverNow:Date.now()},{headers:noCache});
    if(command.version!==board.version)throw new MatchError('別の更新が入りました。最新情報を読み込んだので、もう一度操作してください。',409);
    const next=applyAction(board,command.matchId,command.action,command.id,Date.now());
    if(!await compareAndSet(board.version,next))throw new MatchError('更新が重なりました。最新情報を確認して、もう一度操作してください。',409);
    return NextResponse.json({board:publicBoard(next),serverNow:Date.now()},{headers:noCache});
  }catch(e){return failure(e);}
}
