import { z } from 'zod';

export type Side = 'home' | 'away';
export type Phase = 'scheduled' | 'first' | 'halftime' | 'second' | 'finished';
export type EventKind = 'goal' | 'yellow' | 'red' | 'note' | 'photo' | 'period';
export interface MatchEvent {
  id: string; kind: EventKind; side?: Side; player?: string; text?: string;
  at: number; minute: string; photoUrl?: string; photoPath?: string; cancelledAt?: number;
}
export interface Match {
  id: string; home: string; away: string; venue: string; competition: string;
  kickoff: string; halfMinutes: number; phase: Phase; elapsedMs: number;
  runningSince: number | null; events: MatchEvent[];
}
export interface Board {
  version: number; updatedAt: number; matches: Match[]; commandIds: string[];
}
export interface PublicBoard { version: number; updatedAt: number; matches: Match[] }
export const phaseLabels: Record<Phase, string> = {
  scheduled: 'キックオフ前', first: '前半', halftime: 'ハーフタイム', second: '後半', finished: '試合終了'
};
export function initialBoard(): Board {
  const common = { venue: '見前南中学校グラウンド', competition: 'リーグ戦（未消化分）', halfMinutes: 45,
    phase: 'scheduled' as Phase, elapsedMs: 0, runningSince: null };
  return { version: 0, updatedAt: 0, commandIds: [], matches: [
    { ...common, id: 'match-1300', home: '自分たちのチーム', away: 'MIRUMAE 4th', kickoff: '2026-10-10T13:00:00+09:00', events: [] },
    { ...common, id: 'match-1420', home: '見前南中', away: 'MIRUMAE', kickoff: '2026-10-10T14:20:00+09:00', events: [] }
  ] };
}
export function elapsed(match: Match, now: number) {
  return Math.max(0, match.elapsedMs + (match.runningSince === null ? 0 : Math.max(0, now - match.runningSince)));
}
export function clockText(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export function minuteText(match: Match, now: number) {
  const minute = Math.floor(elapsed(match, now) / 60000);
  const boundary = match.halfMinutes * (['second', 'finished'].includes(match.phase) ? 2 : 1);
  return minute >= boundary && match.phase !== 'scheduled' ? `${boundary}+${minute - boundary + 1}′` : `${minute + 1}′`;
}
export function totals(match: Match, side: Side, kind: EventKind = 'goal') {
  return match.events.filter(e => e.kind === kind && e.side === side && !e.cancelledAt).length;
}
const text = z.string().trim().max(200);
const side = z.enum(['home', 'away']);
export const actionSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('start')}),
  z.object({type:z.literal('pause')}),
  z.object({type:z.literal('halftime')}),
  z.object({type:z.literal('second_half')}),
  z.object({type:z.literal('finish')}),
  z.object({type:z.literal('goal'),side,player:text.optional()}),
  z.object({type:z.literal('card'),side,color:z.enum(['yellow','red']),player:text.optional()}),
  z.object({type:z.literal('note'),text:text.min(1)}),
  z.object({type:z.literal('undo'),eventId:z.string().uuid()}),
  z.object({type:z.literal('clock'),minutes:z.number().int().min(0).max(180),seconds:z.number().int().min(0).max(59)}),
  z.object({type:z.literal('settings'),home:z.string().trim().min(1).max(40),away:z.string().trim().min(1).max(40),
    venue:z.string().trim().min(1).max(80),competition:z.string().trim().min(1).max(60),
    kickoff:z.string().datetime({offset:true}),halfMinutes:z.number().int().min(5).max(60)})
]);
export type Action = z.infer<typeof actionSchema>;
export type PhotoAction = {type:'photo';photoUrl:string;photoPath:string;text:string};
export const commandSchema = z.object({
  id:z.string().uuid(),version:z.number().int().min(0),matchId:z.enum(['match-1300','match-1420']),action:actionSchema
});
export class MatchError extends Error {
  constructor(message:string, public status=400) { super(message); }
}
export function applyAction(board:Board, matchId:string, action:Action|PhotoAction, commandId:string, now:number):Board {
  if (board.commandIds.includes(commandId)) return board;
  const next = structuredClone(board);
  const match = next.matches.find(m=>m.id===matchId);
  if (!match) throw new MatchError('試合が見つかりません。',404);
  const add = (event:Partial<MatchEvent> & {kind:EventKind}) => {
    if (match.events.length >= 1000) throw new MatchError('この試合の記録数の上限に達しました。');
    match.events.push({id:commandId,at:now,minute:minuteText(match,now),...event});
  };
  const stop=()=>{match.elapsedMs=elapsed(match,now);match.runningSince=null;};
  switch(action.type) {
    case 'start':
      if (match.runningSince!==null) throw new MatchError('時計はすでに動いています。',409);
      if (!['scheduled','first','second'].includes(match.phase)) throw new MatchError('この状態では時計を開始できません。');
      if(match.phase==='scheduled'){match.phase='first';add({kind:'period',text:'キックオフ！ 前半開始'});}
      else add({kind:'period',text:'試合時計を再開'});
      match.runningSince=now;break;
    case 'pause':
      if (match.runningSince===null) throw new MatchError('時計はすでに停止しています。');
      stop();add({kind:'period',text:'試合時計を一時停止'});break;
    case 'halftime':
      if(match.phase!=='first') throw new MatchError('前半の試合だけハーフタイムにできます。');
      stop();match.phase='halftime';add({kind:'period',text:'前半終了 · ハーフタイム'});break;
    case 'second_half':
      if(match.phase!=='halftime') throw new MatchError('先に前半を終了してください。');
      match.phase='second';match.elapsedMs=match.halfMinutes*60000;match.runningSince=now;
      add({kind:'period',text:'後半キックオフ！'});break;
    case 'finish':
      if(!['first','halftime','second'].includes(match.phase)) throw new MatchError('開始した試合だけ終了できます。');
      stop();match.phase='finished';add({kind:'period',text:'フルタイム · 試合終了'});break;
    case 'goal':
      if (!['first','second'].includes(match.phase)) throw new MatchError('得点は試合中に記録できます。');
      add({kind:'goal',side:action.side,player:action.player});break;
    case 'card':
      if(match.phase==='scheduled') throw new MatchError('試合を開始してからカードを記録してください。');
      add({kind:action.color,side:action.side,player:action.player});break;
    case 'note':add({kind:'note',text:action.text});break;
    case 'photo':
      if(match.events.filter(e=>e.kind==='photo'&&!e.cancelledAt).length>=30) throw new MatchError('写真は1試合30枚までです。');
      add({kind:'photo',text:action.text,photoUrl:action.photoUrl,photoPath:action.photoPath});break;
    case 'undo':{
      const event=match.events.find(e=>e.id===action.eventId);
      if(!event || event.kind==='period' || event.cancelledAt) throw new MatchError('この記録は取り消せません。');
      event.cancelledAt=now;break;
    }
    case 'clock':
      if(!['first','second'].includes(match.phase)) throw new MatchError('試合中のみ時計を補正できます。');
      match.elapsedMs=(action.minutes*60+action.seconds)*1000;
      if(match.runningSince!==null) match.runningSince=now;
      add({kind:'period',text:`時計を ${clockText(match.elapsedMs)} に補正`});break;
    case 'settings':
      if(action.halfMinutes!==match.halfMinutes && match.phase!=='scheduled') throw new MatchError('ハーフ時間は開始前に設定してください。');
      Object.assign(match,{home:action.home,away:action.away,venue:action.venue,competition:action.competition,
        kickoff:action.kickoff,halfMinutes:action.halfMinutes});break;
  }
  next.version++;next.updatedAt=now;next.commandIds=[...next.commandIds,commandId].slice(-500);
  return next;
}
export function publicBoard(board:Board):PublicBoard {
  return {version:board.version,updatedAt:board.updatedAt,matches:board.matches.map(m=>({...m,events:m.events.map(e=>{
    const result={...e};delete result.photoPath;
    if(result.cancelledAt){delete result.photoUrl;delete result.text;delete result.player;}
    return result;
  })}))};
}
