import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialBoard,applyAction,elapsed,totals,publicBoard,clockText,minuteText,actionSchema,type Action,type Board} from '../src/lib/match';
const start=1_800_000_000_000;
const act=(board:Board,action:Action,now=start)=>applyAction(board,'match-1300',action,randomUUID(),now);

test('the clock advances from server timestamps without any open browser',()=>{
  const board=act(initialBoard(),{type:'start'});
  assert.equal(elapsed(board.matches[0],start+73_000),73_000);
  assert.equal(clockText(elapsed(board.matches[0],start+73_000)),'01:13');
  assert.equal(board.matches[0].elapsedMs,0);
});
test('pause and resume preserve elapsed time, including time away',()=>{
  let b=act(initialBoard(),{type:'start'});
  b=act(b,{type:'pause'},start+10_000);
  assert.equal(elapsed(b.matches[0],start+200_000),10_000);
  b=act(b,{type:'start'},start+200_000);
  assert.equal(elapsed(b.matches[0],start+205_000),15_000);
});
test('second half starts at the configured base without carrying first-half added time',()=>{
  let b=initialBoard();b.matches[0].halfMinutes=30;
  b=act(b,{type:'start'});
  b=act(b,{type:'halftime'},start+32*60_000);
  assert.equal(elapsed(b.matches[0],start+40*60_000),32*60_000);
  b=act(b,{type:'second_half'},start+42*60_000);
  assert.equal(elapsed(b.matches[0],start+43*60_000),31*60_000);
});
test('added time remains running after the regulation boundary',()=>{
  const b=act(initialBoard(),{type:'start'});
  assert.equal(minuteText(b.matches[0],start+46*60_000),'45+2′');
  assert.equal(elapsed(b.matches[0],start+47*60_000),47*60_000);
});
test('duplicate command ids cannot award a goal twice',()=>{
  const b=act(initialBoard(),{type:'start'});const id=randomUUID();
  const next=applyAction(b,'match-1300',{type:'goal',side:'away'},id,start+1000);
  const retried=applyAction(next,'match-1300',{type:'goal',side:'away'},id,start+2000);
  assert.equal(totals(retried.matches[0],'away'),1);
  assert.equal(retried.version,next.version);
  assert.equal(retried,next);
});
test('undo reduces the derived score, retains its audit entry, and cannot run twice',()=>{
  let b=act(initialBoard(),{type:'start'});b=act(b,{type:'goal',side:'away'});
  const goal=b.matches[0].events.at(-1)!;
  b=act(b,{type:'undo',eventId:goal.id});
  assert.equal(totals(b.matches[0],'away'),0);
  assert.ok(b.matches[0].events.at(-1)?.cancelledAt);
  assert.throws(()=>act(b,{type:'undo',eventId:goal.id}));
});
test('yellow and red cards are recorded separately per team',()=>{
  let b=act(initialBoard(),{type:'start'});
  b=act(b,{type:'card',side:'home',color:'yellow',player:'10'});
  b=act(b,{type:'card',side:'away',color:'red'});
  assert.equal(totals(b.matches[0],'home','yellow'),1);
  assert.equal(totals(b.matches[0],'away','red'),1);
  assert.equal(totals(b.matches[0],'home','red'),0);
});
test('finished clocks stay frozen and invalid transitions cannot restart the match',()=>{
  let b=act(initialBoard(),{type:'start'});b=act(b,{type:'finish'},start+120_000);
  assert.equal(elapsed(b.matches[0],start+1_000_000),120_000);
  assert.throws(()=>act(b,{type:'start'}));
  assert.throws(()=>act(b,{type:'goal',side:'home'}));
  assert.throws(()=>act(initialBoard(),{type:'second_half'}));
});
test('clock correction preserves running or paused state',()=>{
  let b=act(initialBoard(),{type:'start'});
  b=act(b,{type:'clock',minutes:24,seconds:12},start+2_000);
  assert.equal(elapsed(b.matches[0],start+5_000),24*60_000+15_000);
  b=act(b,{type:'pause'},start+5_000);
  b=act(b,{type:'clock',minutes:25,seconds:0},start+7_000);
  assert.equal(elapsed(b.matches[0],start+10_000),25*60_000);
});
test('fixtures remain isolated and actions do not mutate the original state',()=>{
  const original=initialBoard();const started=act(original,{type:'start'});
  assert.equal(original.matches[0].phase,'scheduled');
  assert.equal(started.matches[1].phase,'scheduled');
  assert.equal(started.matches[1].events.length,0);
});
test('public data excludes command IDs, storage paths and cancelled captions',()=>{
  let b=applyAction(initialBoard(),'match-1300',{type:'photo',photoUrl:'https://example.test/photo.jpg',photoPath:'private/path',text:'caption'},randomUUID(),start);
  b=act(b,{type:'undo',eventId:b.matches[0].events[0].id});
  const publicData=JSON.stringify(publicBoard(b));
  assert.ok(!publicData.includes('commandIds'));
  assert.ok(!publicData.includes('private/path'));
  assert.ok(!publicData.includes('https://example.test'));
  assert.ok(!publicData.includes('caption'));
});
test('the server rejects invalid settings and arbitrary photo URLs from clients',()=>{
  assert.equal(actionSchema.safeParse({type:'photo',photoUrl:'javascript:alert(1)'}).success,false);
  assert.equal(actionSchema.safeParse({type:'clock',minutes:-1,seconds:0}).success,false);
  assert.equal(actionSchema.safeParse({type:'card',side:'visitor',color:'yellow'}).success,false);
  let b=act(initialBoard(),{type:'start'});
  const m=b.matches[0];assert.throws(()=>act(b,{type:'settings',home:m.home,away:m.away,venue:m.venue,competition:m.competition,kickoff:m.kickoff,halfMinutes:20}));
});
