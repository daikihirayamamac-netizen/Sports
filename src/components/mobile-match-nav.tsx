'use client';

import { Activity,Camera,Info,Radio,Share2 } from 'lucide-react';

interface MobileMatchNavProps {
  admin:boolean;
  active:string;
  onNavigate:(section:string)=>void;
  onShare:()=>void;
}

export function MobileMatchNav({admin,active,onNavigate,onShare}:MobileMatchNavProps){
  const items=admin
    ? [{key:'controls',label:'操作',accessible:'ライブ操作へ移動',icon:Radio},
       {key:'live',label:'速報',accessible:'速報を見る',icon:Activity},
       {key:'photos',label:'写真',accessible:'写真を見る',icon:Camera}]
    : [{key:'live',label:'速報',accessible:'速報を見る',icon:Activity},
       {key:'photos',label:'写真',accessible:'写真を見る',icon:Camera},
       {key:'info',label:'試合情報',accessible:'試合情報を見る',icon:Info}];
  return <nav className="mobile-match-nav" aria-label="スマホ用ナビゲーション">
    {items.map(({key,label,accessible,icon:Icon})=><button key={key} className={active===key?'is-active':''}
      aria-label={accessible} aria-pressed={active===key} onClick={()=>onNavigate(key)}>
      <Icon size={21} strokeWidth={active===key?2:1.65}/><span>{label}</span>
    </button>)}
    <button aria-label="観戦リンクを共有" onClick={onShare}><Share2 size={20} strokeWidth={1.65}/><span>共有</span></button>
  </nav>;
}
