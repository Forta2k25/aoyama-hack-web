# Web AIハック（非公開デバッグbranch）

対象は `Forta2k25/aoyama-hack-web` の `codex/web-ai-hack` のみ。
基点main: `ae7971e5bfcfc164dc5aa47e2a08cbbaea04321c`。
アプリリポジトリ・アプリのローカルコピー・共有Firebase設定・Functionsは変更しない。

## すぐにUIを確認

```sh
npm ci
npm run dev:ai
```

表示されたlocalhostの `/ai-debug` を開く。ログイン不要。架空の授業・架空の返信で、
資料の追加、端末保存、途中本文、最終本文、チャット、再読み込み後の復元を確認できる。
**この画面の返信は外部AIの結果ではない。** Firebase・Vision・Groqを呼ばない。
デバッグ画面はFirebase/authをimportする通常サイトとは別のbootstrapで起動する。
デバッグの資料・会話はブラウザIndexedDBに保存される。不要になればブラウザの
localhostサイトデータから消去する。実アカウントのデータとはキーを分離している。

## 通常の時間割から

同じ開発サーバーの `/mypage` へ、アプリでGoogle連携済みの同じアカウントでログインする。
授業を選ぶと、デスクトップでは左パネル、モバイルでは授業ダイアログに
「シラバス / AIハック」が現れる。友だちの時間割ではAIタブを出さない。

- 写真・PDF・m4a/mp3/wav、資料メモに対応。原本をIndexedDBに保存してから送信する。
- 録音は `MediaRecorder` の `audio/mp4` 対応ブラウザのみ。マイク許可は利用者が選択する。
  webmをm4aと偽って送らない。未対応ブラウザは音声ファイル選択を案内する。
- 資料は所有者・年度別授業に分離。再送は同じclientRequestId/remote sourceを使う。
- 解析完了資料だけをチャットへ渡す。参照は最大8件。途中結果は「検索対象外」と表示する。
- 選択されたrouteの最終Evidence chunksだけを表示する。native/OCR/probeの本文を
  AI結果へ連結しない。旧資料もAPIが返した保存済み本文を読むだけで再処理しない。
- チャットは `aiChat.stream()`。deltaを表示後、最終 `text` を採用する。
  失敗時の自動再送・別モデルfallback・読み取り本文をAI返信に見せかけるfallbackはない。
- ページ番号・音声時刻・実metadataのpipeline/route/provider/model/usage/推定cost/latencyを表示する。
- 授業を閉じる・切り替える・ログアウトすると通信表示と録音を中断する。
  外部で既に受理されたCallableの処理自体をブラウザ側から取消できるとは保証しない。
  次回は同じ送信IDで復旧する。録音中の未保存データは画面を閉じると破棄する。
- 保存済み会話はWebブラウザ内。iOSとの会話履歴同期は追加していない。
  資料は既存サーバーAPIが返す本人資料を取り込む。署名付きURL/tokenは保存しない。

## 既存バックエンドとの境界

`src/firebase.ts` の既存Web Firebase client configを維持。Auth・授業catalogは既存の
`forta-aogaku` を参照し、AIはTokyoの既存Callableを使用する。

|操作|既存Function|
|---|---|
|資料作成・送信完了|aiCreateSource / aiCompleteSource|
|再送・状態・一覧|aiRetrySource / aiGetSource / aiListSources|
|途中/最終本文|aiGetEvidence（preview=trueは途中本文のみ）|
|削除|aiDeleteSource|
|返信・資料紹介|aiChat（streaming）|

AI本体・OCR/ASR・RAG・課金・quota・共有・許可リストは既存サーバーの責務。
Webは新しいprovider keyやserver credentialを必要としない。
ブラウザからnamed Firestore `aogaku-ai` を直接read/writeせず、Storage SDKによる
AI領域の直接アクセスも追加しない。アップロードはサーバー発行の短期署名付きPUTだけ。
URLは正確なbucket/ai-inputs/aogaku-ai/現在UIDのprefixに限定し、認証ヘッダーを転送しない。

### 授業識別

年度は承認されたsyllabus URLの単一 `YR` → 実際に読み込んだ時間割documentの年度 → unresolved。
5桁 `firestoreDocID` と年度が揃えば `year:classDocId`、なければ永続localCourseUUID。
現在年、仮code、授業名はIDに使わない。同じ5桁IDでも別年度の資料は混ざらない。
資料には作成時点のcontext/snapshotを保持し、後年のcatalog更新で書き換えない。
localUUIDからcanonical offeringへの自動付け替え・共有は追加しない。

## 実通信の前提（今回は変更しない）

1. 当該Firebase Auth UIDが**既存backendのpilot allowlist**にあること。
   Web側の表示flagを有効にしても、serverの許可・Auth/owner/quotaを迂回しない。
2. `aiChat` が同じ本番project/regionへ、アプリ担当者の管理下でdeploy済みであること。
   未導入ならエラーを表示する。このWeb作業のためにFunctionsをdeployしない。
3. ログイン先のlocalhost/preview domainがFirebase Authの承認済みドメインに含まれること。
4. 署名付きXML Storage PUTには、利用するWeb originと必要なPUT/headerを許可する
   bucket CORSが必要。iOSで送信できてもブラウザではCORS拒否になり得る。
   CORSの既存設定は読取・変更していない。失敗時は原本をローカルに残し再送を案内する。
   `no-cors`で回避したり、公開bucketへ変更したり、サーバーキーをWebへ置いたりしない。
5. CallableのCORS/App Check/IAMがブラウザからの既存Firebase clientを許可していること。

これらは共有Firebaseに関わるため、このbranchから自動変更しない。
実通信はアプリ担当者と調整し、許可済みアカウントで架空資料から順に確認する。
UIのデモPASSを、外部provider実通信PASSと報告してはならない。

## 公開・deployのガード

- mainを編集しない。merge/PR作成・手動deployを行わない。
- Vercel成功statusがmainに存在するため、branch pushが自動deployする可能性を考慮した。
  `vercel.json` の `git.deploymentEnabled["codex/web-ai-hack"]=false` で対象branchだけ抑止する。
  他branchや既存redirect/rewriteは変更しない。
- AI表示はVite development/ai-preview modeのみ。`VERCEL_ENV=production` または
  Netlify `CONTEXT=production` なら、preview modeでもビルド時にOFF。
- `aoyamahack.com` / `www.aoyamahack.com` / 既存Vercel本番hostでは、preview bundleでもOFF。
  URL query/localStorageだけで本番のAIを開放するswitchはない。
- public repositoryのfeature branchなので、ソース自体はGitHub上で公開される。
  branchはサイト公開や認可の代わりにはならない。UID/key/token/原本はcommitしない。

将来ホストされた内部previewが必要なら、Vercel側のDeployment Protection・Preview限定
環境設定・承認済みAuth domainを確認してから別途有効化する。
本番公開は、このbranchを勝手にmergeするのではなく別の承認で扱う。

参考（公式）:
- https://vercel.com/docs/project-configuration/git-configuration
- https://firebase.google.com/docs/functions/callable
- https://cloud.google.com/storage/docs/cross-origin

## 検証

```sh
npm test
npm run build
npm run build:ai-preview
VERCEL_ENV=production npm run build:ai-preview
```

単体テストは年度/UID分離、永続化、再送、削除競合、previewのchat除外、最終本文採用、
署名付き送信先制限、HTML注入防止、本番host/flag、usage不明値を確認する。
UIデバッグでは資料メモ、画像、PDF、音声ファイル、チャット、途中/最終表示、tab切替、
再読込復元、モバイル幅を確認する。実機の録音や外部API実通信は別の検証項目。

### 内部実通信の確認手順

1. 許可された同一UIDで `/mypage` にログイン。対象授業のYR/5桁IDを確認。
2. 架空メモ、画像、PDF、音声を新規追加。ローカル保存→upload→readyを追跡。
3. PDFの途中本文→ready後の最終本文を確認。途中資料を参照checkboxで選べないことを確認。
4. 選択済み資料について質問し、ストリームと最終返信、実provider/model/usageを確認。
5. 別授業・別年度へ切替え、資料・会話が混ざらないことを確認。
6. 通信中断・再送・再読込、資料削除、ログアウト時の停止を確認。
7. 非pilot/匿名で拒否されることを、共有設定を変えずに確認。

### 今回のローカル検証結果

- Node tests: 19/19 PASS（desktop/mobileの既存授業パネル統合も含む）。
- TypeScript/Vite通常build、ai-preview build、production指定ai-preview build: PASS。
- Firebase/auth/API既存ファイル一致、Vercel既存redirect/rewrite維持、対象branch deploy抑止: PASS。
- 実ブラウザ: メモ、PDF、画像、WAVの追加、会話ストリーム/完了、本文/locator、
  タブ切替、再読込復元、390px/1100px幅での横はみ出しなしを確認。
- production buildをlocalhostで開き、`/ai-debug` がAI画面を起動しないことを確認。
- **本番/Devの外部API E2E・マイク実録音は未実施**。アプリ側との共同作業や
  Firebase設定変更を避け、上記「実通信の前提」を満たした後に検証する。

開発環境はNode 24で検証。module mockを含むテストには実験flagを付けている。
元mainの固定依存にnpm auditの既存指摘があり、この機能のための一括upgradeは行っていない。
一般公開前に別途依存関係の更新・audit確認を行う。
