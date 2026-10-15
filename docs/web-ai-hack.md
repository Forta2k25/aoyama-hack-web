# Web AIハック（非公開デバッグbranch）

対象は `Forta2k25/aoyama-hack-web` の `codex/web-ai-hack` のみ。
基点main: `ae7971e5bfcfc164dc5aa47e2a08cbbaea04321c`。
アプリリポジトリ・アプリのローカルコピー・共有Firebase設定・Functionsは変更しない。

## すぐにUIを確認

```sh
npm ci
npm run dev:ai
```

UIデモは `/ai-debug` を開く。ログイン不要。実通信を試す入口は **`http://localhost:5178/mypage#timetable`**（下記の固定port起動時）。
デモ上部の「本番の時間割・AIチャットへ」でも移動できる。架空の授業・架空の返信で、
資料の追加、端末保存、途中本文、最終本文、チャット、再読み込み後の復元を確認できる。
**この画面の返信は外部AIの結果ではない。** Firebase・Vision・Groqを呼ばない。
デバッグ画面はFirebase/authをimportする通常サイトとは別のbootstrapで起動する。
デバッグの資料・会話はブラウザIndexedDBに保存される。不要になればブラウザの
localhostサイトデータから消去する。実アカウントのデータとはキーを分離している。

## 通常の時間割から

```sh
npm run dev:ai -- --port 5178 --strictPort
```

`http://localhost:5178/mypage#timetable` を開く。`127.0.0.1` は同じMacを指すが、
Authの承認済みdomain・ブラウザ保存・CORSではlocalhostと別なので混用しない。

同じ開発サーバーの `/mypage` へ、アプリでGoogle連携済みの同じアカウントでログインする。
授業を選ぶと、デスクトップでは左パネル、モバイルでは授業ダイアログに
「シラバス / AIチャット」が現れる。友だちの時間割ではAIタブを出さない。

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
   2026-10-15にユーザーの明示承認後、`http://localhost:5178` のPUT限定CORSを追加済み。
   対応headerはContent-Type / Content-MD5 / x-goog-if-generation-match /
   x-goog-content-length-range、preflight cacheは300秒。失敗時は原本をローカルに残し再送を案内する。
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
# 明示実行時だけ、本番Callableの匿名拒否とlocalhost CORSを確認する
npm run check:ai-live-anonymous
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

## 本番接続のread-only確認（2026-10-15）

- Project ID/numberを照合。aiChat / aiCreateSource / aiGetEvidence / aiProcessSourceはACTIVE、
  Node22、named databaseはaogaku-ai。取得metadata上のpilotは2件、sharing=false。UID実値は記録しない。
- 資料系9 CallableとaiChatの計10件へlocalhost originの匿名POSTを実施。
  すべて401 UNAUTHENTICATED。CallableのCORSは当該originを返す。資料作成やprovider処理はしていない。
- Auth承認済みdomainにはlocalhostが存在。127.0.0.1は未登録。
- 初回確認ではStorage CORSは空。その後、明示承認に従いlocalhost:5178のPUTだけを
  1回の条件付きbucket metadata PATCHで追加。再GETとOPTIONS検証にPASS。
  localhost:5179 / 127.0.0.1:5178 / 外部originのPUT、およびlocalhost:5178のGETには
  CORS許可ヘッダーが返らない。OPTIONSの200だけでは許可とは判定していない。
- 追加後、bucket IAMはetagだけが変化。bindings / version / resourceは完全一致。
  CORSとmetadataのrevision項目以外のbucket設定（lifecycle等）も完全一致。
  Rules/IAM設定変更・Storage object作成や変更は行っていない。
- CORSはbucket単位でありai-inputs prefixだけには限定できない。署名付きURLの
  object/owner限定とWeb側の送信先validationを維持し、CORSを認証の代わりにしない。
  本番hostや他originは追加していない。
- 戻す場合は、最新metadataと既存CORSを照合し、承認後に今回の1件だけを除去する。
  他設定を上書きせず、最新metagenerationによる条件付きPATCHを使う。今回rollbackは未実施。
- pilotログイン後のメモ/チャット/ファイルE2Eは未確認。匿名拒否を実通信成功とは扱わない。
- 共有Functions/Rules/IAM/Secret、アプリのコード・作業コピーは変更していない。

本番Webサイトaoyamahack.comは変更しない。ここで「本番接続」はfeature branchの
ローカルWebが既存本番Firebaseへ接続する意味であり、Webの一般公開を意味しない。

## 本人アカウントの接続診断（内部previewのみ）

マイページの「本番接続を確認（読み取りのみ）」から、project、マスク済みFirebase UID、
Auth providerと本人の時間割document数・flat/cells mapの件数だけを確認できる。
本人UIDの全体表示は「本人UIDを確認」を明示的に押した場合のみ。初期表示・ログ・
Git・localStorageへUID実値やtokenを出力しない。Googleの同じメールアドレスだという
説明だけで、他Firebase UIDの時間割を代読・コピーしたり、pilot認可を迂回したりしない。

診断は既存Web Firebaseクライアントによる本人の(default) DBのreadだけ。
アカウント連携・許可リスト・Firestore/Storage Rulesの変更機能は持たない。
本番サイトのfeature gateがOFFなら、診断パネルも表示しない。

## Web pilot追加の途中状態

本人の明示承認後、既存2 UIDを残して本人のWeb UID 1件を追加するenv-only更新を実施。
更新済みはaiProcessSource / aiGetSource / aiListSources / aiGetEvidence / aiRetrieveContext /
aiRetrySource / aiUpdateSource / aiDeleteSource / aiCreateSource / aiCompleteSourceの10件。
それぞれsource archive checksum・runtime・SA・IAM・UID以外のenvを照合。

最後のaiChatは、作業中に別のsource更新（revision 00002から00003）を検出したため未変更。
最新sourceを維持したenv-only追記の確認待ち。更新済み10件を再PATCHしない。
この時点ではAI返信・4入力E2Eは完了していない。UID実値・非公開config・operation記録は
Git除外のbuild/配下だけに保持する。queueはRUNNING、SchedulerはPAUSED、sharing=false。

読取auditでは、FirestoreのearliestVersionTimeとetagが書込なしでも変化することを確認。
比較guardはこの2項目だけ除外し、updateTimeを含むその他の全設定を検証する。
別の一時的なsnapshot不一致は停止時snapshotが保存されておらず原因未確定だが、
その後の4回の全保護設定照合は一致。以後の不一致snapshot保存を追加した。
通信timeoutではmutationを再試行せず、operationの確認GETだけをretryして完了を確認した。
