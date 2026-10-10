import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={
  title:'TOUCHLINE | みんなのサッカー速報',
  description:'ピッチの熱を、どこにいても。学校のサッカーをスコア・試合時計・写真で応援しよう。',
  robots:{index:false,follow:false},
  appleWebApp:{capable:true,title:'TOUCHLINE',statusBarStyle:'black-translucent'},
};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#11251c'};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="ja"><body>{children}</body></html>;
}
