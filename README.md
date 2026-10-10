# Sports / TOUCHLINE

学校のサッカーを、スコア・試合時計・カード・写真で共有する日本語のライブ速報サイトです。Next.js 16 / React / Upstash Redis / Vercel Blob を使用します。

## 観戦・操作

- **観戦**：公開URLの `/`。ログイン不要で、約3秒ごとに最新の記録を取得します。
- **操作**：公開URLの `/admin`。`ADMIN_PASSWORD` に設定したパスワードでログインします。
- **最初に**：歯車の「試合設定」で自分たちのチーム名とハーフ時間を確認してください。資料に記載のなかったハーフ時間は、変更可能な仮設定の45分です。
- **開始**：「試合開始」で時計が動きます。画面を閉じても経過時間は維持されます。
- **得点**：得点したチームの「ゴール ＋1点」。カード、写真、ひとことも投稿できます。
- **押し間違い**：「直前の記録を取り消す」、または速報の各記録にある取り消しボタンで訂正できます。
- **前後半**：「前半終了」→「後半開始」→「試合終了」。後半は設定したハーフ時間から通算表示します。
- **時計**：通常のサッカーの中断では時計を止めません。アディショナルタイムも自動で継続します。時計補正も可能です。終了後は再開できないため、終了操作には確認画面があります。
- **共有**：「この試合をシェア」で観戦用リンク、またはQRコードを渡します。パスワードは運営者だけが使用してください。

初期設定は、2026年10月10日の見前南中学校グラウンド、13:00「自分たちのチーム vs MIRUMAE 4th」と14:20「見前南中 vs MIRUMAE」です。

## Vercelへの公開

1. [Vercelの新規プロジェクト画面](https://vercel.com/new) から `daikihirayamamac-netizen/Sports` をImportします。Frameworkは **Next.js**、Root Directoryはリポジトリ直下です。
2. Vercelの **Storage / Marketplace** で **Upstash Redis** を作成して、このプロジェクトに接続します。`UPSTASH_REDIS_REST_URL` と `UPSTASH_REDIS_REST_TOKEN` を使用します。連携が `KV_REST_API_URL` / `KV_REST_API_TOKEN` を設定する場合にも対応しています。SDKは現行の `@upstash/redis` です。
3. **Vercel Blob** の **public** ストアを作成し、同じプロジェクトに接続します。`BLOB_READ_WRITE_TOKEN`、またはOIDC接続の `BLOB_STORE_ID` が必要です。
4. **Settings → Environment Variables** に以下を設定します。秘密の値をGitHubやチャットに貼り付ける必要はありません。

   | 変数 | 設定内容 |
   | --- | --- |
   | `ADMIN_PASSWORD` | 運営者用の推測されにくい12文字以上のパスワード |
   | `SESSION_SECRET` | ランダムな32文字以上の署名鍵。推奨は32バイトの乱数をhex化した64文字 |
   | `DATA_NAMESPACE` | 本番は `sports-production`。省略時はVercelの環境ごとに分離 |

5. **Deploy / Redeploy** を実行します。公開したProduction URLを別のブラウザーで開き、Vercelのログイン要求が出ないことを確認してください。必要ならDeployment Protectionをこの観戦サイトの公開方針に合わせて設定します。
6. `/admin` でログインし、試合設定を保存できること、観戦用URLからその変更が見えることを確認します。

`SESSION_SECRET` はローカル端末で次のコマンドにより生成できます。生成結果はVercelの秘密の環境変数にのみ保存してください。

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

PreviewにはProductionと別のRedis / Blobと別の秘密の値を使ってください。`DATA_NAMESPACE` を本番・Preview共通で設定しないでください。Vercel連携後は `main` の更新で再デプロイされます。

## 開発・確認

```sh
npm ci
npm run typecheck
npm test
npm run build
```

本物の接続先を使う開発では、VercelにリンクしてからDevelopmentの環境変数を取り込みます。

```sh
vercel link --project sports --scope daikintoshs-projects
vercel env pull .env.local
npm run dev
```

外部の保存先なしで画面と操作を確認する場合は、明示的にローカル専用モードを起動できます。

```sh
npm run demo
```

`http://localhost:3000` に観戦画面、`/admin` に操作画面が表示されます。確認用パスワードは `touchline-local-demo` です。このパスワードは本番には使われません。ローカルデータはGit管理外の `.local-data/` に保存されます。**Vercel上ではこのモードは使用できません**。本番でRedisが未接続の場合は503エラーになり、ブラウザーだけへの保存に切り替わることはありません。

ブラウザー検証は、本番ビルド後にChromiumのある環境で実行します。

```sh
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

テストは一時保存先とポート3100を使用し、実際の試合データを変更しません。デスクトップ・スマホの画像と検証結果はGit管理外の `test-results/` に出力します。

## 動作と制約

- 時計はサーバー時刻と開始時刻から計算します。画面表示は毎秒、共有データは表示中約3秒ごと・非表示中約15秒ごとに取得します。WebSocket配信ではありません。
- 操作のIDによる重複防止とRedisのLuaによるバージョン比較で、二重得点と同時更新の上書きを防ぎます。競合時は最新データを読み込み、再操作を案内します。
- 通信障害時は最後に受け取った記録と接続状態を表示します。未送信の操作を自動で後から反映するキューはありません。
- 管理セッションはHttpOnly / SameSite cookieで保持。本番はSecure cookieです。書き込みAPIは認証とOrigin照合を行い、ログイン試行は15分に10回までです。パスワード変更で既存のセッションも無効になります。
- 写真は1試合30枚まで。端末で圧縮し、サーバーでもJPEGに変換してEXIFなどのメタデータを除去します。写真の投稿取り消しは速報から非表示にする処理です。保存済みBlob自体を完全に削除する場合はVercel Storageから削除してください。
- リンクを知る人が観戦できます。検索エンジンにはnoindexを指定していますが、学校の在籍者だけに制限する認証ではありません。
- 試合時計・記録は手動の参考速報です。公式判定や審判の時計を優先してください。

ローカル検証は、13件の基本テストと、別ブラウザーへの反映・認証・写真・競合・再起動後の保存・スマホ表示などの16項目を確認済みです。実際のVercel / Redis / Blob接続は、公開時に別途確認してください。
