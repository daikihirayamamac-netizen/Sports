'use client';

import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {Activity,Camera,Info,Radio,Share2} from 'lucide-react';

interface MobileMatchNavProps {
  admin:boolean;
  active:string;
  onNavigate:(section:string)=>void;
  onShare:()=>void;
}
const viewerItems=[
  {key:'live',label:'速報',accessible:'速報を見る',icon:Activity},
  {key:'photos',label:'写真',accessible:'写真を見る',icon:Camera},
  {key:'info',label:'試合情報',accessible:'試合情報を見る',icon:Info},
  {key:'share',label:'共有',accessible:'観戦リンクを共有',icon:Share2}
];
const operatorItems=[{key:'controls',label:'操作',accessible:'ライブ操作へ移動',icon:Radio},...viewerItems.filter(item=>item.key!=='info')];
interface Gesture {id:number;startX:number;startY:number;lastX:number;index:number;dragging:boolean}

export function MobileMatchNav({admin,active,onNavigate,onShare}:MobileMatchNavProps){
  const items=admin?operatorItems:viewerItems;
  const activeIndex=Math.max(0,items.findIndex(item=>item.key===active));
  const nav=useRef<HTMLElement>(null);
  const lens=useRef<HTMLSpanElement>(null);
  const buttons=useRef<(HTMLButtonElement|null)[]>([]);
  const currentIndex=useRef(activeIndex);
  currentIndex.current=activeIndex;
  const gesture=useRef<Gesture|null>(null);
  const holdTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const suppressClickUntil=useRef(0);
  const [previewIndex,setPreviewIndex]=useState<number|null>(null);
  const [dragging,setDragging]=useState(false);

  function place(index:number,clientX?:number,clientY?:number,velocity=0){
    const root=nav.current,glass=lens.current,button=buttons.current[index];
    if(!root||!glass||!button)return;
    const rect=root.getBoundingClientRect();
    const width=button.offsetWidth;
    const lifted=gesture.current?.dragging;
    const x=clientX===undefined?button.offsetLeft:Math.max(4,Math.min(root.clientWidth-width-4,clientX-rect.left-width/2));
    const y=clientY===undefined?0:Math.max(-7,Math.min(7,(clientY-rect.top-rect.height/2)*.2));
    glass.style.setProperty('--lens-x',`${x}px`);
    glass.style.setProperty('--lens-y',`${y}px`);
    glass.style.setProperty('--lens-width',`${width}px`);
    glass.style.setProperty('--lens-height',`${button.offsetHeight}px`);
    glass.style.setProperty('--lens-stretch',String(lifted?1.09+Math.min(Math.abs(velocity)*.004,.13):1));
    glass.style.setProperty('--lens-lift',lifted?'1.12':'1');
    glass.style.setProperty('--lens-light',`${30+Math.max(-20,Math.min(40,velocity*2))}%`);
  }
  function clearHold(){if(holdTimer.current){clearTimeout(holdTimer.current);holdTimer.current=null;}}
  function cancel(){
    clearHold();gesture.current=null;setDragging(false);setPreviewIndex(null);place(currentIndex.current);
  }
  useLayoutEffect(()=>{if(!gesture.current)place(activeIndex);},[activeIndex,admin]);
  useEffect(()=>{
    const root=nav.current;if(!root)return;
    const resize=new ResizeObserver(()=>{if(!gesture.current)place(currentIndex.current);});
    resize.observe(root);
    const hidden=()=>{if(document.hidden)cancel();};
    window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hidden);
    return()=>{clearHold();resize.disconnect();window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);};
  },[]);
  function choose(index:number){
    const item=items[index];
    if(item.key==='share'){place(currentIndex.current);onShare();}
    else {place(index);onNavigate(item.key);}
  }
  function start(event:ReactPointerEvent<HTMLButtonElement>,index:number){
    if(!event.isPrimary||event.button!==0)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current={id:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,index,dragging:false};
    setPreviewIndex(index);place(index);
    holdTimer.current=setTimeout(()=>{
      const moving=gesture.current;if(!moving)return;
      moving.dragging=true;setDragging(true);place(moving.index,moving.lastX,moving.startY);
    },220);
  }
  function move(event:ReactPointerEvent<HTMLElement>){
    const moving=gesture.current;if(!moving||moving.id!==event.pointerId)return;
    if(!moving.dragging&&Math.abs(event.clientX-moving.startX)>8){clearHold();moving.dragging=true;setDragging(true);}
    if(!moving.dragging)return;
    let closest=0,distance=Infinity;
    buttons.current.forEach((button,index)=>{
      if(!button)return;const box=button.getBoundingClientRect();const d=Math.abs(event.clientX-box.left-box.width/2);
      if(d<distance){distance=d;closest=index;}
    });
    if(closest!==moving.index){moving.index=closest;setPreviewIndex(closest);}
    place(closest,event.clientX,event.clientY,event.clientX-moving.lastX);moving.lastX=event.clientX;
  }
  function finish(event:ReactPointerEvent<HTMLElement>){
    const moving=gesture.current;if(!moving||moving.id!==event.pointerId)return;
    const box=nav.current!.getBoundingClientRect();
    const inside=event.clientX>=box.left-16&&event.clientX<=box.right+16&&event.clientY>=box.top-35&&event.clientY<=box.bottom+35;
    const index=moving.index;suppressClickUntil.current=Date.now()+600;cancel();
    if(inside)choose(index);
  }
  return <nav ref={nav} className={`mobile-match-nav liquid-dock${dragging?' is-dragging':''}`} aria-label="スマホ用ナビゲーション"
    onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel();}} onContextMenu={event=>event.preventDefault()}>
    <span ref={lens} className="liquid-lens" aria-hidden="true"/>
    {items.map(({key,label,accessible,icon:Icon},index)=><button key={key} ref={element=>{buttons.current[index]=element;}}
      className={(previewIndex??activeIndex)===index?'is-active':''} aria-label={accessible}
      aria-pressed={key==='share'?undefined:active===key} onPointerDown={event=>start(event,index)}
      onClick={event=>{if(event.detail===0||Date.now()>suppressClickUntil.current)choose(index);}}
      onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();buttons.current[(index+(event.key==='ArrowRight'?1:items.length-1))%items.length]?.focus();}}}>
      <Icon size={21} strokeWidth={(previewIndex??activeIndex)===index?2:1.65}/><span>{label}</span>
    </button>)}
  </nav>;
}
