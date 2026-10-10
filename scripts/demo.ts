import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

if(process.env.VERCEL)throw new Error('ローカル確認専用です。Vercelでは使用できません。');
const taskPassword=process.env.ADMIN_PASSWORD||'touchline-local-demo';
console.log('ローカル確認モード。本番の共有データとは接続しません。');
if(!process.env.ADMIN_PASSWORD)console.log('確認用ログインパスワード: touchline-local-demo');
const child=spawn('node',['node_modules/next/dist/bin/next','dev','--hostname','0.0.0.0','--port',process.env.PORT||'3000'],{
  stdio:'inherit',env:{...process.env,LOCAL_DEMO:'1',ADMIN_PASSWORD:taskPassword,SESSION_SECRET:process.env.SESSION_SECRET||randomBytes(48).toString('hex')}
});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code||0));
