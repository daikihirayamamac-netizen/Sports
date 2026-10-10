'use client';

import { useCallback,useEffect,useRef,useState,type FormEvent } from 'react';
import Link from 'next/link';
import { Activity,ArrowLeft,ArrowRight,Camera,Check,ChevronRight,Clock3,Flag,
  ImagePlus,Info,LoaderCircle,LockKeyhole,LogOut,MapPin,Maximize2,MessageSquare,Pause,Play,
  Plus,Radio,RotateCcw,Settings2,Share2,ShieldCheck,Signal,WifiOff,X,ZoomIn } from 'lucide-react';
import { clockText,elapsed,initialBoard,phaseLabels,totals,type Action,type Match,type MatchEvent,type PublicBoard,type Side } from '@/lib/match';
import { MobileMatchNav } from './mobile-match-nav';

type Modal='share'|'settings'|'clock'|'photo'|'card'|'note'|'help'|null;
type ApiBoard={board:PublicBoard;serverNow:number;demo?:boolean};
const eventLabels:Record<string,string>={goal:'GOAL!',yellow:'イエローカード',red:'レッドカード',note:'現地から',photo:'ピッチの一枚',period:'試合状況'};
const kickoffTime=(value:string)=>new Date(value).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tokyo'});
const matchDate=(value:string)=>new Date(value).toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'});

export function MatchBoard({admin}:{admin:boolean}){
  const [board,setBoard]=useState<PublicBoard>(()=>initialBoard());
  const [selected,setSelected]=useState('match-1300');
  const [ready,setReady]=useState(false);
  const [online,setOnline]=useState(true);
  const [synced,setSynced]=useState(0);
  const [demo,setDemo]=useState(false);
  const [now,setNow]=useState(Date.now());
  const serverClock=useRef({at:Date.now(),tick:0});
  const [error,setError]=useState('');
  const [networkError,setNetworkError]=useState('');
  const [toast,setToast]=useState('');
  const [busy,setBusy]=useState(false);
  const [authenticated,setAuthenticated]=useState(false);
  const [authReady,setAuthReady]=useState(!admin);
  const [tab,setTab]=useState('live');
  const [mobileSection,setMobileSection]=useState(admin?'controls':'live');
  const [modal,setModal]=useState<Modal>(null);
  const [qr,setQr]=useState('');
  const [side,setSide]=useState<Side>('home');
  const [lightbox,setLightbox]=useState<MatchEvent|null>(null);
  const [confirm,setConfirm]=useState<{title:string;text:string;action:Action}|null>(null);
  const mutation=useRef(false);
  const scoreRef=useRef<HTMLDivElement>(null);
  const feedRef=useRef<HTMLElement>(null);
  const controlsRef=useRef<HTMLElement>(null);
  const match=board.matches.find(m=>m.id===selected)||board.matches[0];
  const canEdit=admin&&authenticated;
  const elapsedMs=elapsed(match,now);
  const playing=match.phase==='first'||match.phase==='second';
  const photos=match.events.filter(e=>e.kind==='photo'&&!e.cancelledAt).reverse();

  const accept=useCallback((data:ApiBoard,rtt=0)=>{
    setBoard(previous=>data.board.version>=previous.version?data.board:previous);
    serverClock.current={at:data.serverNow+rtt/2,tick:performance.now()};
    setNow(data.serverNow+rtt/2);setReady(true);setOnline(true);setNetworkError('');setSynced(Date.now());
    if(data.demo!==undefined)setDemo(data.demo);
  },[]);
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    const started=performance.now();
    try{
      const response=await fetch('/api/board',{cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      accept(data,performance.now()-started);
      return true;
    }catch(e){
      if(signal?.aborted)return false;
      setOnline(false);setNetworkError(e instanceof Error&&e.name!=='TimeoutError'&&e.message!=='Failed to fetch'?e.message:'通信が途切れています。接続が戻ると自動で更新します。');return false;
    }
  },[accept]);
  useEffect(()=>{
    let disposed=false;let generation=0;let timer:ReturnType<typeof setTimeout>;let controller:AbortController;
    const poll=async()=>{
      if(disposed)return;const current=++generation;controller=new AbortController();
      await refresh(controller.signal);
      if(!disposed&&generation===current)timer=setTimeout(poll,document.hidden?15000:3000);
    };
    const resume=()=>{if(!document.hidden){clearTimeout(timer);controller?.abort();void poll();}};
    void poll();document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);
    const offline=()=>setOnline(false);window.addEventListener('offline',offline);
    return()=>{disposed=true;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);window.removeEventListener('offline',offline);};
  },[refresh]);
  useEffect(()=>{
    serverClock.current.tick=performance.now();
    const tick=setInterval(()=>setNow(serverClock.current.at+performance.now()-serverClock.current.tick),1000);
    return()=>clearInterval(tick);
  },[]);
  useEffect(()=>{if(!admin)return;fetch('/api/session',{cache:'no-store'}).then(r=>r.json()).then(d=>{setAuthenticated(d.authenticated);setDemo(d.demo);}).catch(()=>setError('操作画面に接続できませんでした。')).finally(()=>setAuthReady(true));},[admin]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{
    const id=new URL(window.location.href).searchParams.get('match');
    if(id==='match-1300'||id==='match-1420')setSelected(id);
  },[]);
  useEffect(()=>{
    if(modal!=='share')return;
    void import('qrcode').then(({default:QRCode})=>QRCode.toDataURL(`${location.origin}/?match=${selected}`,{width:280,margin:2,color:{dark:'#11251c',light:'#ffffff'}})).then(setQr).catch(()=>setError('QRコードを生成できませんでした。リンクをコピーしてください。'));
  },[modal,selected]);
  const selectTab=(value:string)=>{setTab(value);setMobileSection(value);};
  const switchMatch=(id:string)=>{setSelected(id);selectTab('live');const url=new URL(location.href);url.searchParams.set('match',id);history.replaceState(null,'',url);};
  const navigateMobile=(section:string)=>{
    setMobileSection(section);
    if(section!=='controls')setTab(section);
    requestAnimationFrame(()=>{
      const target=section==='controls'?controlsRef.current:feedRef.current;
      target?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    });
  };
  const send=async(action:Action)=>{
    if(mutation.current)return;mutation.current=true;setBusy(true);setError('');
    const command={id:crypto.randomUUID(),matchId:selected,version:board.version,action};
    try{
      // One command ID is reused if the response is lost, preventing double goals.
      let response:Response|undefined;
      for(let attempt=0;attempt<2;attempt++){
        try{response=await fetch('/api/board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(12000)});break;}
        catch(e){if(attempt===1)throw e;}
      }
      if(!response)throw new Error('保存を確認できませんでした。');
      const data=await response.json();
      if(!response.ok){if(response.status===401)setAuthenticated(false);if(response.status===409)await refresh();throw new Error(data.error);}
      accept(data);setToast(action.type==='undo'?'記録を取り消しました':'保存しました。みんなの画面にも反映されます。');setModal(null);setConfirm(null);
    }catch(e){setError(e instanceof Error&&e.message!=='Failed to fetch'?e.message:'保存を確認できませんでした。最新の記録を確認してから再操作してください。');await refresh();}
    finally{setBusy(false);mutation.current=false;}
  };
  const share=async()=>{
    const url=`${location.origin}/?match=${selected}`;
    if(navigator.share){try{await navigator.share({title:`${match.home} vs ${match.away} | TOUCHLINE`,url});return;}catch{/* show QR and copy */}}
    setModal('share');
  };
  const logout=async()=>{try{const response=await fetch('/api/session',{method:'DELETE'});if(response.ok)setAuthenticated(false);else setError('ログアウトできませんでした。');}catch{setError('通信を確認してください。');}};
  const latest=match.events.filter(e=>e.kind!=='period'&&!e.cancelledAt).at(-1);

  return <>
    <header className="topbar"><div className="topbar-inner">
      <Link href="/" className="brand" aria-label="TOUCHLINE 観戦画面"><span className="brand-mark">T</span><span>TOUCHLINE<span className="brand-caption">SCHOOL FOOTBALL, LIVE.</span></span></Link>
      <div className="header-right"><span className="season">MATCHDAY / 2026</span>{canEdit?<button className="icon-button dark" onClick={logout} aria-label="ログアウト"><LogOut size={18}/></button>:<Link href={admin?'/':'/admin'} className="header-link">{admin?<><ArrowLeft size={14}/>観戦画面</>:<><LockKeyhole size={14}/>操作画面</>}</Link>}</div>
    </div></header>
    {demo&&<div className="demo-bar">ローカル動作確認モード · この画面はまだ一般公開されていません</div>}
    <main className="page-shell">
      <section className="page-intro"><div><div className="eyebrow"><span className="tiny-square"/> THE MATCHDAY EXPERIENCE</div><h1>{canEdit?'ピッチから、届けよう。':'その一瞬を、みんなで。'}</h1><p>{canEdit?'あなたのタップが、みんなの速報になる。':'離れていても、同じ試合を。仲間のプレーをリアルタイムで応援しよう。'}</p></div><div className="date-stamp"><span>OCTOBER</span><strong>10<span>.10</span></strong><span>SATURDAY · LEAGUE MATCH</span></div></section>

      {admin&&!authenticated?<Login ready={authReady} onLogin={()=>{setAuthenticated(true);setToast('ログインしました');}}/>:<>
      <div className="matchday-toolbar"><div className="section-kicker"><Flag size={16}/> MATCH CENTER <span>本日の試合</span></div><button className="text-button" onClick={()=>setModal('help')}><Info size={16}/>使い方</button></div>
      <nav className="fixture-list" aria-label="試合を選択">{board.matches.map((m,index)=><button key={m.id} onClick={()=>switchMatch(m.id)} className={`fixture ${m.id===selected?'selected':''}`} aria-pressed={m.id===selected}>
        <span className="fixture-number">0{index+1}</span><span className="fixture-content"><span className="fixture-time">{kickoffTime(m.kickoff)} <span>{m.phase==='scheduled'?'KICK OFF':phaseLabels[m.phase]}</span></span><span className="fixture-teams">{m.home} <b>vs</b> {m.away}</span></span><ChevronRight size={18}/>
      </button>)}</nav>

      {(!online||error)&&<div className={`notice ${!online?'warning':'error'}`} role="alert"><WifiOff size={18}/><span>{error||networkError||'オフラインです。最後に取得した情報を表示しています。'}</span><button onClick={()=>{setError('');void refresh();}}>再接続</button>{online&&<button aria-label="閉じる" onClick={()=>setError('')}><X size={16}/></button>}</div>}
      {!ready&&online&&<div className="loading-line"><LoaderCircle size={16} className="spin"/>試合情報に接続中…</div>}

      <div className="board-grid"><div className="main-column">
        <section className="scoreboard" ref={scoreRef} aria-label="スコアボード">
          <div className="pitch-decoration" aria-hidden="true"><div/><span/></div>
          <div className="score-top"><span className="league-label">{match.competition}</span><span className={`live-badge ${playing?'is-live':''}`}><i/>{!online?'OFFLINE':playing?'LIVE':match.phase==='finished'?'FULL TIME':'MATCHDAY'}</span></div>
          <div className={`match-status ${match.phase==='scheduled'?'before-kickoff':''}`}><span>{phaseLabels[match.phase]}</span><b>{match.phase==='scheduled'?kickoffTime(match.kickoff):clockText(elapsedMs)}{match.phase==='scheduled'&&<small className="kickoff-suffix">KICK OFF</small>}</b>{playing&&match.runningSince===null&&<small>時計停止中</small>}</div>
          <div className="score-row">
            <Team side="home" name={match.home}/>
            <div className="score" aria-label={`${match.home} ${totals(match,'home')} 対 ${totals(match,'away')} ${match.away}`}><span key={`h${totals(match,'home')}`}>{totals(match,'home')}</span><i>:</i><span key={`a${totals(match,'away')}`}>{totals(match,'away')}</span></div>
            <Team side="away" name={match.away}/>
          </div>
          <div className="score-meta"><span><MapPin size={14}/>{match.venue}</span><span>{matchDate(match.kickoff)}</span></div>
          <div className="score-bottom"><span><span className={`connection-dot ${!online?'offline':''}`}/>{ready?(online?'自動更新中 · 3秒ごと':'接続待ち · 時計は参考表示'):'接続中'}</span><button onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void scoreRef.current?.requestFullscreen().catch(()=>setToast('この端末は全画面表示に対応していません。'));}} aria-label="スコアを全画面表示"><Maximize2 size={15}/><span>全画面</span></button></div>
        </section>

        {canEdit&&<section className="control-panel" ref={controlsRef} id="match-controls">
          <div className="panel-heading"><h2><Radio size={17}/>ライブ操作</h2><span className="operator-badge"><ShieldCheck size={13}/>あなた専用</span></div>
          <div className="clock-controls">
            {match.phase==='scheduled'&&<button className="button primary wide" disabled={busy||!ready||!online} onClick={()=>void send({type:'start'})}><Play size={18} fill="currentColor"/>試合開始</button>}
            {playing&&<><button className="button primary" disabled={busy||!online} onClick={()=>void send({type:match.runningSince===null?'start':'pause'})}>{match.runningSince===null?<Play size={17}/>:<Pause size={17}/>}時計を{match.runningSince===null?'再開':'停止'}</button>
            {match.phase==='first'?<button className="button secondary" disabled={busy||!online} onClick={()=>setConfirm({title:'前半を終了しますか？',text:'時計を止めてハーフタイムに切り替えます。',action:{type:'halftime'}})}>前半終了</button>:<button className="button secondary" disabled={busy||!online} onClick={()=>setConfirm({title:'試合を終了しますか？',text:'時計を止めて最終スコアを表示します。試合終了後は再開できません。',action:{type:'finish'}})}>試合終了<Flag size={16}/></button>}</>}
            {match.phase==='halftime'&&<button className="button primary wide" disabled={busy||!online} onClick={()=>void send({type:'second_half'})}><Play size={18}/>後半開始（{match.halfMinutes}:00〜）</button>}
            {match.phase==='finished'&&<div className="finished-message"><Check size={18}/>おつかれさまでした。試合結果を共有しよう。</div>}
            <button className="button square secondary" aria-label="試合設定" onClick={()=>setModal('settings')} disabled={busy}><Settings2 size={18}/></button>
          </div>
          {match.phase==='scheduled'&&<p className="control-tip">開始前に設定でチーム名とハーフ時間を確認してください（現在 {match.halfMinutes}分）。</p>}
          <div className="goal-controls">{(['home','away'] as const).map(s=><div key={s} className={`goal-control ${s}`}><span>{match[s]}</span><button disabled={busy||!playing||!online} onClick={()=>void send({type:'goal',side:s})}><Plus size={25}/><span>ゴール<small>＋1点</small></span><BallIcon/></button></div>)}</div>
          <div className="quick-actions"><button disabled={busy||match.phase==='scheduled'||!online} onClick={()=>{setSide('home');setModal('card');}}><span className="card-symbol yellow"/>カード</button><button disabled={busy||!online} onClick={()=>setModal('photo')}><Camera size={17}/>写真</button><button disabled={busy||!online} onClick={()=>setModal('note')}><MessageSquare size={17}/>ひとこと</button><button disabled={busy||!playing||!online} onClick={()=>setModal('clock')}><Clock3 size={17}/>時計補正</button></div>
          {latest&&<button className="undo-button" disabled={busy||!online} onClick={()=>setConfirm({title:'直前の記録を取り消しますか？',text:`${latest.minute} ${eventLabels[latest.kind]}${latest.side?` · ${match[latest.side]}`:''}`,action:{type:'undo',eventId:latest.id}})}><RotateCcw size={13}/>直前の記録を取り消す</button>}
        </section>}

        <section className="feed-panel" ref={feedRef} id="match-feed"><div className="tabs" role="tablist" aria-label="試合の情報"><button role="tab" id="tab-live" aria-controls="panel-live" aria-selected={tab==='live'} onClick={()=>selectTab('live')} className={tab==='live'?'active':''}><Activity size={16}/>速報<span>{match.events.filter(e=>!e.cancelledAt).length}</span></button><button role="tab" id="tab-photos" aria-controls="panel-photos" aria-selected={tab==='photos'} onClick={()=>selectTab('photos')} className={tab==='photos'?'active':''}><Camera size={16}/>写真<span>{photos.length}</span></button><button role="tab" id="tab-info" aria-controls="panel-info" aria-selected={tab==='info'} onClick={()=>selectTab('info')} className={tab==='info'?'active':''}><Info size={16}/>試合情報</button></div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab==='live'&&<><div className="feed-heading"><span>試合の流れ</span><small>新しい記録が上に表示されます</small></div>{match.events.length?<ol className="timeline">{[...match.events].reverse().map(event=><li key={event.id} className={`${event.kind} ${event.cancelledAt?'cancelled':''}`}><div className="timeline-minute">{event.minute}</div><div className="timeline-dot"><EventIcon kind={event.kind}/></div><div className="event-content"><div className="event-title"><strong>{event.cancelledAt?'取り消し済み':eventLabels[event.kind]}</strong>{event.side&&!event.cancelledAt&&<span>{match[event.side]}</span>}{canEdit&&!event.cancelledAt&&event.kind!=='period'&&<button aria-label={`${event.minute}の${eventLabels[event.kind]}を取り消す`} disabled={busy||!online} onClick={()=>setConfirm({title:'この記録を取り消しますか？',text:`${event.minute} ${eventLabels[event.kind]}`,action:{type:'undo',eventId:event.id}})}><RotateCcw size={13}/></button>}</div>{event.player&&<p>選手：{event.player}</p>}{event.text&&<p>{event.text}</p>}{event.photoUrl&&<button className="timeline-photo" onClick={()=>setLightbox(event)}><img src={event.photoUrl} alt={event.text||'試合の写真'} loading="lazy"/><span><ZoomIn size={16}/></span></button>}</div></li>)}</ol>:<EmptyState icon="flag" title="キックオフの、その時まで。" text="試合が始まると、ゴールやカードの記録がここに届きます。"/>}</>}
          {tab==='photos'&&(photos.length?<div className="photo-grid">{photos.map(photo=><button key={photo.id} onClick={()=>setLightbox(photo)}><img src={photo.photoUrl} alt={photo.text||'試合の写真'} loading="lazy"/><span>{photo.minute} {photo.text}</span></button>)}</div>:<EmptyState icon="camera" title="今日の一枚を、ここに。" text="現地で撮影した写真が追加されると、みんなで見ることができます。"/>)}
          {tab==='info'&&<div className="match-details"><dl><div><dt>大会</dt><dd>{match.competition}</dd></div><div><dt>日時</dt><dd>{matchDate(match.kickoff)} {kickoffTime(match.kickoff)}</dd></div><div><dt>会場</dt><dd>{match.venue}</dd></div><div><dt>試合時間</dt><dd>{match.halfMinutes}分ハーフ{match.phase==='scheduled'?'（開始前に運営者が確認）':''}</dd></div><div><dt>試合時計</dt><dd>現地の操作による参考表示です。公式記録は審判の判定が優先されます。</dd></div></dl></div>}
          </div></section>
      </div>

      <aside className="side-column" data-mobile-tab={tab}><section className="share-card"><span className="eyebrow">ONE TEAM. EVERYWHERE.</span><div className="share-art" aria-hidden="true"><span className="orbit o1"/><span className="orbit o2"/><span className="share-ball"><BallIcon/></span><i className="spark one">＋</i><i className="spark two">＋</i></div><h2>応援は、<br/>どこからだって。</h2><p>友だちにリンクを送って、<br/>試合の瞬間を一緒に。</p><button className="button lime wide" onClick={()=>void share()}><Share2 size={17}/>この試合をシェア<ArrowRight size={17}/></button><button className="qr-link" onClick={()=>setModal('share')}>QRコードを表示</button></section>
        <section className="stats-card"><div className="aside-heading"><h2>マッチスタッツ</h2><span>STATS</span></div><div className="stats-team-row"><b>{match.home}</b><b>{match.away}</b></div>{(['goal','yellow','red'] as const).map(kind=><div className="stats-row" key={kind}><strong>{totals(match,'home',kind)}</strong><span>{kind==='goal'?<BallIcon/>:<span className={`card-symbol ${kind}`}/>}<span>{kind==='goal'?'ゴール':kind==='yellow'?'イエロー':'レッド'}</span></span><strong>{totals(match,'away',kind)}</strong></div>)}</section>
        <section className="schedule-card"><div className="aside-heading"><h2>今日のスケジュール</h2><Clock3 size={16}/></div><ol><li><time>11:45</time><span>現地集合</span></li><li><time>12:00</time><span>ウォーミングアップ</span></li><li className="featured"><time>{kickoffTime(board.matches[0].kickoff)}</time><span>{board.matches[0].home} vs {board.matches[0].away}<i>リーグ戦</i></span></li><li><time>14:20</time><span>見前南中 vs MIRUMAE</span></li><li><time>15:40</time><span>vs MIRUMAE 4th<i>審判割当</i></span></li><li><time>17:00</time><span>ミーティング・解散<i>予定</i></span></li></ol></section>
        <div className="side-note"><Signal size={15}/><span>画面を開いたままで自動更新。<br/>{synced?`最終受信 ${new Date(synced).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'試合情報を確認しています。'}</span></div>
      </aside></div>
      </>}
      <footer className="footer"><span className="footer-brand">TOUCHLINE<span>ピッチの熱を、どこにいても。</span></span><span>MADE FOR THE TEAM <span className="tiny-square"/></span></footer>
    </main>
    {(!admin||authenticated)&&<MobileMatchNav admin={canEdit} active={mobileSection} onNavigate={navigateMobile} onShare={()=>setModal('share')}/>}
    {toast&&<div className="toast" role="status"><Check size={18}/>{toast}</div>}
    {busy&&<div className="saving" role="status"><LoaderCircle size={15} className="spin"/>保存中…</div>}
    {modal&&<Dialog title={{share:'みんなで、この試合を。',settings:'試合の設定',clock:'試合時計を補正',photo:'ピッチの一枚を追加',card:'カードを記録',note:'現地からひとこと',help:'TOUCHLINE の使い方'}[modal]} onClose={()=>{if(!busy)setModal(null);}}>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {modal==='share'&&<div className="share-dialog"><p>観戦用リンクです。ログインなしで見られます。</p>{qr?<img className="qr-image" src={qr} alt="観戦用URLのQRコード"/>:<LoaderCircle className="spin"/>}<strong>{match.home} vs {match.away}</strong><input aria-label="観戦用URL" readOnly value={typeof location!=='undefined'?`${location.origin}/?match=${selected}`:''} onFocus={e=>e.currentTarget.select()}/><button className="button primary wide" onClick={()=>void navigator.clipboard.writeText(`${location.origin}/?match=${selected}`).then(()=>setToast('観戦用リンクをコピーしました')).catch(()=>setError('リンク欄を長押ししてコピーしてください。'))}><Share2 size={17}/>リンクをコピー</button></div>}
      {modal==='settings'&&<SettingsForm key={match.id} match={match} busy={busy} onSave={send}/>}
      {modal==='clock'&&<form onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void send({type:'clock',minutes:Number(d.get('minutes')),seconds:Number(d.get('seconds'))});}}><p className="form-description">審判の時計に合わせます。後半は前半分を含む通算時間で入力してください。</p><div className="form-row"><label>分<input name="minutes" type="number" min="0" max="180" defaultValue={Math.floor(elapsedMs/60000)} required/></label><label>秒<input name="seconds" type="number" min="0" max="59" defaultValue={Math.floor(elapsedMs/1000)%60} required/></label></div><button disabled={busy} className="button primary wide">時計を合わせる</button></form>}
      {modal==='card'&&<form onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void send({type:'card',side,color:d.get('color') as 'yellow'|'red',player:String(d.get('player')||'')});}}><label>チーム<select value={side} onChange={e=>setSide(e.target.value as Side)}><option value="home">{match.home}</option><option value="away">{match.away}</option></select></label><label>カード<select name="color"><option value="yellow">イエローカード</option><option value="red">レッドカード</option></select></label><label>背番号・選手名 <span>任意</span><input name="player" maxLength={40} placeholder="例：背番号 10"/></label><button disabled={busy} className="button primary wide">カードを記録</button></form>}
      {modal==='note'&&<form onSubmit={e=>{e.preventDefault();void send({type:'note',text:String(new FormData(e.currentTarget).get('text'))});}}><label>試合のようす<textarea name="text" maxLength={200} required rows={4} placeholder="例：惜しいシュート！ ゴール前でチャンスが続いています。"/></label><p className="form-description">200文字まで。観戦中のみんなに表示されます。</p><button disabled={busy} className="button primary wide">ひとことを届ける</button></form>}
      {modal==='photo'&&<PhotoForm matchId={selected} version={board.version} onDone={data=>{accept(data);setModal(null);setToast('写真を追加しました');}} onConflict={()=>void refresh()}/>}
      {modal==='help'&&<div className="help-content"><p>観戦する人はこのページを開くだけ。スコア・カード・写真が自動で届きます。</p><ol><li><b>運営者は「操作画面」でログイン</b><span>設定でチーム名と試合時間を確認します。</span></li><li><b>キックオフで「試合開始」</b><span>画面を閉じても時計は進みます。前半終了 → 後半開始 → 試合終了の順で操作します。</span></li><li><b>得点したチームの「ゴール ＋1点」</b><span>カード・写真・ひとことも追加できます。誤った記録は取り消せます。</span></li><li><b>観戦用リンクをシェア</b><span>管理パスワードはあなた専用です。友だちには観戦用リンクを送ります。</span></li></ol><p className="form-description">通常の試合中は時計を止めず、アディショナルタイムも計測します。回線が切れた場合、保存できたか記録を確認してから再操作してください。</p></div>}
    </Dialog>}
    {confirm&&<Dialog title={confirm.title} onClose={()=>{if(!busy)setConfirm(null);}}><p className="form-description">{confirm.text}</p>{error&&<p className="form-error">{error}</p>}<div className="form-row"><button className="button secondary" disabled={busy} onClick={()=>setConfirm(null)}>戻る</button><button className="button primary" disabled={busy} onClick={()=>void send(confirm.action)}>確定する</button></div></Dialog>}
    {lightbox&&<Dialog title={lightbox.text||'試合の写真'} onClose={()=>setLightbox(null)} wide><img className="lightbox-image" src={lightbox.photoUrl} alt={lightbox.text||'試合の写真'}/></Dialog>}
  </>;
}

function BallIcon(){return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><path d="m12 7 4.5 3.3-1.7 5.2H9.2l-1.7-5.2L12 7Zm0 0V3m4.5 7.3 4.2-1.1m-5.9 6.3 2.5 3.7m-8.1-3.7-2.5 3.7m.8-8.9L3.3 9.2"/></svg>;}
function Team({name,side}:{name:string;side:Side}){return <div className={`team ${side}`}><div className="team-crest"><span>{side==='home'?'H':'A'}</span><i>FC</i></div><h2>{name}</h2><small>{side==='home'?'HOME':'AWAY'}</small></div>;}
function EventIcon({kind}:{kind:string}){return kind==='goal'?<BallIcon/>:kind==='yellow'||kind==='red'?<span className={`card-symbol ${kind}`}/>:kind==='photo'?<Camera size={15}/>:kind==='note'?<MessageSquare size={15}/>:<Flag size={14}/>;}
function EmptyState({icon,title,text}:{icon:string;title:string;text:string}){return <div className="empty-state"><div className="empty-icon">{icon==='camera'?<Camera size={25}/>:<Flag size={25}/>}</div><h3>{title}</h3><p>{text}</p><span className="empty-field" aria-hidden="true"/></div>;}

function Login({ready,onLogin}:{ready:boolean;onLogin:()=>void}){
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);setError('');const password=String(new FormData(e.currentTarget).get('password'));
    try{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password}),signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok)throw new Error(d.error);onLogin();}catch(e){setError(e instanceof Error?e.message:'接続できませんでした。');}finally{setBusy(false);}};
  return <section className="login-panel"><div className="login-icon"><LockKeyhole size={28}/></div><span className="eyebrow">FOR THE MATCH OPERATOR</span><h2>今日の試合を、届けよう。</h2><p>操作用パスワードでログインしてください。</p><form onSubmit={submit}><label>操作用パスワード<input name="password" type="password" autoComplete="current-password" minLength={12} maxLength={200} required placeholder="パスワードを入力"/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary wide" disabled={busy||!ready}>{busy?<LoaderCircle className="spin" size={18}/>:<LockKeyhole size={16}/>}操作画面に入る</button></form><Link href="/">観戦画面にもどる<ArrowRight size={15}/></Link></section>;
}
function Dialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:React.ReactNode;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=ref.current;const focused=document.activeElement as HTMLElement|null;el?.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;el?.close();focused?.focus();};},[]);
  return <dialog ref={ref} className={`dialog ${wide?'dialog-wide':''}`} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-label={title}><div className="dialog-inner"><div className="dialog-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="閉じる"><X size={20}/></button></div>{children}</div></dialog>;
}
function SettingsForm({match,busy,onSave}:{match:Match;busy:boolean;onSave:(action:Action)=>Promise<void>}){
  const localIso=new Date(new Date(match.kickoff).getTime()+9*3600000).toISOString().slice(0,16);
  return <form onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void onSave({type:'settings',home:String(d.get('home')),away:String(d.get('away')),venue:String(d.get('venue')),competition:String(d.get('competition')),halfMinutes:Number(d.get('halfMinutes')||match.halfMinutes),kickoff:new Date(`${d.get('kickoff')}:00+09:00`).toISOString()});}}><div className="form-row"><label>ホーム<input name="home" defaultValue={match.home} maxLength={40} required/></label><label>アウェイ<input name="away" defaultValue={match.away} maxLength={40} required/></label></div><label>大会名<input name="competition" defaultValue={match.competition} maxLength={60} required/></label><label>会場<input name="venue" defaultValue={match.venue} maxLength={80} required/></label><div className="form-row"><label>開始予定（日本時間）<input type="datetime-local" name="kickoff" defaultValue={localIso} required/></label><label>片方のハーフ時間（分）<input type="number" name="halfMinutes" min="5" max="60" defaultValue={match.halfMinutes} disabled={match.phase!=='scheduled'} required/></label></div><p className="form-description">ハーフ時間は試合開始前に設定してください。実際の笛に合わせて「試合開始」を押すと、時計が動きます。</p><button disabled={busy} className="button primary wide">設定を保存</button></form>;
}
function PhotoForm({matchId,version,onDone,onConflict}:{matchId:string;version:number;onDone:(data:ApiBoard)=>void;onConflict:()=>void}){
  const [file,setFile]=useState<File|null>(null);const [preview,setPreview]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [caption,setCaption]=useState('');
  useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  const upload=async(e:FormEvent)=>{e.preventDefault();if(!file||busy)return;setBusy(true);setError('');try{
    const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const context=canvas.getContext('2d');if(!context)throw new Error('画像を処理できませんでした。');context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('画像を圧縮できませんでした。')),'image/jpeg',0.82));
    const data=new FormData();data.set('file',blob,'photo.jpg');data.set('id',crypto.randomUUID());data.set('version',String(version));data.set('matchId',matchId);data.set('caption',caption);
    const r=await fetch('/api/photos',{method:'POST',body:data,signal:AbortSignal.timeout(30000)});const result=await r.json();if(!r.ok){if(r.status===409)onConflict();throw new Error(result.error);}onDone(result);
  }catch(e){setError(e instanceof Error?e.message:'写真を保存できませんでした。');}finally{setBusy(false);}};
  return <form onSubmit={upload}><label className="upload-area">{preview?<img src={preview} alt="投稿する写真のプレビュー"/>:<><ImagePlus size={34}/><strong>写真を選択</strong><span>JPEG・PNG・WebP / 20MBまで</span></>}<input aria-label="写真ファイル" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f&&f.size>20_000_000){setError('20MB以下の写真を選んでください。');return;}setFile(f||null);setError('');}}/></label><label>ひとこと <span>任意</span><input value={caption} onChange={e=>setCaption(e.target.value)} maxLength={160} placeholder="例：ハーフタイムの一枚"/></label><p className="form-description">写真は観戦ページに公開されます。写っている人に確認した写真を選んでください。位置情報などは自動で除去します。</p>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary wide" disabled={!file||busy}>{busy?<LoaderCircle size={18} className="spin"/>:<Camera size={18}/>}写真を{busy?'送信中…':'公開する'}</button></form>;
}
