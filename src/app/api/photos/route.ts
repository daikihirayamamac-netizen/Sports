import { NextResponse } from 'next/server';
import { put,del } from '@vercel/blob';
import sharp from 'sharp';
import { mkdir,writeFile,unlink } from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin,sameOrigin } from '@/lib/auth';
import { applyAction,MatchError,publicBoard } from '@/lib/match';
import { readBoard,compareAndSet,localMode,localDataDir,rateLimit } from '@/lib/storage';
import { failure,noCache } from '@/lib/api';
import { z } from 'zod';
export const runtime='nodejs';
export async function POST(request:Request){
  let cleanup:(()=>Promise<unknown>)|undefined;
  try{
    sameOrigin(request);await requireAdmin();
    if(!await rateLimit('photos',20,60))throw new MatchError('写真の投稿が多すぎます。少し待ってください。',429);
    const length=Number(request.headers.get('content-length')||0);
    if(length>4_000_000)throw new MatchError('写真が大きすぎます。3MB以下で選び直してください。',413);
    const data=await request.formData();
    const id=z.string().uuid().parse(data.get('id'));
    const matchId=z.enum(['match-1300','match-1420']).parse(data.get('matchId'));
    const version=z.coerce.number().int().min(0).parse(data.get('version'));
    const caption=z.string().trim().max(160).parse(data.get('caption')||'');
    const file=data.get('file');
    if(!(file instanceof File)||file.size>3_000_000||!file.size)throw new MatchError('3MB以下の画像を選んでください。');
    const board=await readBoard();
    if(board.commandIds.includes(id))return NextResponse.json({board:publicBoard(board),serverNow:Date.now()},{headers:noCache});
    if(board.version!==version)throw new MatchError('別の更新が入りました。もう一度投稿してください。',409);
    if(!localMode()&&!process.env.BLOB_READ_WRITE_TOKEN&&!process.env.BLOB_STORE_ID)throw new MatchError('写真の保存先が未接続です。Vercel Blobを接続してください。',503);
    let buffer:Buffer;
    try{buffer=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:40_000_000}).rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).jpeg({quality:82}).toBuffer();}
    catch{throw new MatchError('画像を読み込めませんでした。JPEG・PNG・WebP形式をお試しください。');}
    const photoPath=`sports/${matchId}/${id}.jpg`;let photoUrl:string;
    if(localMode()){
      const directory=path.join(localDataDir(),'photos');await mkdir(directory,{recursive:true});
      const diskPath=path.join(directory,`${id}.jpg`);await writeFile(diskPath,buffer);
      cleanup=()=>unlink(diskPath);photoUrl=`/api/photos/${id}`;
    }else{
      const blob=await put(photoPath,buffer,{access:'public',contentType:'image/jpeg',addRandomSuffix:true});
      photoUrl=blob.url;cleanup=()=>del(blob.url);
    }
    const next=applyAction(board,matchId,{type:'photo',photoUrl,photoPath,text:caption},id,Date.now());
    if(!await compareAndSet(board.version,next))throw new MatchError('更新が重なりました。写真をもう一度投稿してください。',409);
    cleanup=undefined;
    return NextResponse.json({board:publicBoard(next),serverNow:Date.now()},{headers:noCache});
  }catch(e){if(cleanup)await cleanup().catch(()=>{});return failure(e);}
}
