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

## Web pilot追加と本番実通信の確認結果（2026-10-15）

本人の明示承認後、既存2 UIDを残してWeb UID 1件を追加。以下11 Functionsの
AI_INPUT_ALLOWED_UIDSは同じ3件で、sharing=false、AI_FIRESTORE_DATABASE_ID=aogaku-ai。
UID実値・token・非公開config・operation記録はGit除外のbuild/配下だけに保持する。

- aiProcessSource / aiGetSource / aiListSources / aiGetEvidence / aiRetrieveContext
- aiRetrySource / aiUpdateSource / aiDeleteSource / aiCreateSource / aiCompleteSource / aiChat

最後のaiChatは作業中の別source更新を検出して停止し、最新source保持の追加承認後に
環境設定だけを更新。workerも別source更新を検出し、追加承認後の最新revisionを保持。
成功済み10件を再PATCHせず、aiChatだけ00003-cof → 00004-tigへ更新した。
ソースarchiveの不変確認にはGCS objectのmd5Hash/crc32c/size metadataを使い、
アプリのsource ZIP本体は取得していない。Web以外のrepositoryや作業コピーは変更していない。

最終read-only auditで11件すべてACTIVE、allowlist 3件、完了時metadata一致、
他Functions不変、queue RUNNING、Scheduler PAUSED、sharing OFFを確認。
Rules / indexes / Secret metadata/version / lifecycle / IAMの変更は行っていない。
本ターンのproduction mutationはaiChat 1件の承認済みenv-only PATCHと、本人用の架空資料
保存・provider処理だけ。前段で承認されたlocalhost:5178 PUT CORSは維持。

### 実ブラウザでの本番E2E

localhost:5178/mypageで本人の時間割から同じ授業の左パネルを開いて確認した。
既存シラバスとAIチャットの切替、資料・会話の再読込復元、本文表示にPASS。
授業側の5桁IDがない場合も推測せず、YR年度と永続local UUIDで本人専用として保存する。

| 架空入力 | 本番結果 |
| --- | --- |
| メモ | ready、本文取得、12 + 8 = 20という根拠付き実AI返信 |
| 3-label矢印PNG | image-auto-v1 / multimodal_ai、矢印2本の関係をEvidenceと返信で保持 |
| 1-page native PDF | pdf-auto-v1 / native_text、最終本文と[p.1]を保持 |
| 日本語m4a合成音声 | audio-groq-v2 / groq / whisper-large-v3-turbo、ノート冊数を正しく文字起こし |

画像とチャットは、承認して保持した最新backendの実metadataで
**gemini / gemini-3.5-flash-lite**を返した。以前のQwen表示へ上書きしていない。
画像: input 1,753 / output 160 / total 1,913 tokens、processing 4.68秒、推定$0.002426。
メモへの返信: 488 / 43 / 531 tokens、1.06秒、推定$0.000254。
画像への返信: 590 / 101 / 691 tokens、1.07秒、推定$0.000429。
日本語音声: 実測10.2秒、processing 1.84秒、推定$0.000112。
金額・料金基準日はbackendの返却値。実請求額の検証や料金設定変更はしていない。

WAVは作成前にUNSUPPORTED_TYPE、durationのない/小数秒m4aはINVALID_DURATIONで拒否された。
Webを本番受付契約に合わせ、m4aのみ選択可能とし、media metadataから実測した長さを
整数秒へ切り上げてdurationSecondsとして送る。ファイルサイズから時間を推測しない。
既存失敗m4aは同じclientRequestIdのまま再送して成功。音声をtoken課金扱いにしない。
英語の合成音声は文字起こしが不正確だった。日本語fixtureの成功と混同せず、
英語対応や長時間録音の品質は別の確認項目として残す。

本番の架空資料5件（メモ・PNG・PDF・英語m4a・日本語m4a）と会話2往復は本人用に残した。
非対応WAVの失敗行はローカルのみ。原本・署名URL・provider raw response・本番Evidence・
private registry・音声/画像/PDFバイナリはcommitしない。削除競合やaccount deletionは今回未実施。
マイク実録音、長いPDFの途中表示、別の認証済み非pilotによる拒否の再検証も今回未実施。
10 Callableの匿名401は実通信確認済み。既存の非pilot gateを開放していない。

ローカル最終検証: 24 tests PASS、TypeScript/Vite build、ai-preview build、
Web境界・本番host feature gate・staged privacy/既知UID scanを実行。
GitHubはcodex/web-ai-hackのみへ保存し、main・本番Web配信・PRは変更しない。

読取auditでは、FirestoreのearliestVersionTimeとetagが書込なしでも変化することを確認。
比較guardはこの2項目だけ除外し、updateTimeを含むその他の全設定を検証する。
別の一時的なsnapshot不一致は停止時snapshotが保存されておらず原因未確定だが、
その後の4回の全保護設定照合は一致。以後の不一致snapshot保存を追加した。
通信timeoutではmutationを再試行せず、operationの確認GETだけをretryして完了を確認した。

## 授業と授業回ごとの会話分離

時間割のidには##### / +++++ / *****などの仮codeが複数授業で再利用されていた。
以前のWebはidをlocal UUIDのseedに優先し、別授業の保存先が重なる不具合があった。

- canonical offeringは引き続きsyllabus YR優先のyear + 5桁firestoreDocID。
- 未確定授業は、本人UID + 年度/学期/コマを含む時間割レコードから永続UUIDを割り当てる。
  cells.dXpYとdXpYは同じレコードに正規化。code・授業名・教員名で統合しない。
- チャット、資料のローカル所属、選択済み資料、AIへ送る直近turnsを
  UID + courseKey + 授業日(dayID)で分離。APIのcontext.dayIDも選択した授業日に固定。
- 授業回番号は表示用。休講設定を変えて番号がずれても、日付に紐づく会話を他の回へ動かさない。
- 切替時には旧controller/stream/pollを停止し、遅延返信を次の授業・回に反映しない。
- remote listの別offering・別lecture・所属未確定データは、自動で現在回へ採用しない。
  local offeringの他端末データや不明なlecture IDも、推測で回に割り当てない。

IndexedDBはversion 2へ非破壊upgrade。旧messages/materials/identitiesを削除しない。
授業が混在した可能性のある旧履歴は「以前の履歴（授業回未確定）」にread-onlyで残す。
旧資料の本文は明示操作で取得可能だが、新しい回のAIへ自動で渡さない。
チャットと日程設定はこのブラウザで永続化する。端末間の会話同期は今回追加していない。

授業回一覧は2026年度学部学事暦を設定値として使用し、曜日ごとの通常授業を数える。
休祝日・休日授業実施日・冬期休業・キャンパス別休講/補講の差を扱う。
出典: https://www.aoyama.ac.jp/wp-content/uploads/2025/10/aa_2026calendar_gakubu.pdf
火曜後期の例は9/15 → 9/29 → 10/6 → 10/13（第4回）。
大学院・集中講義・週複数回・独自補講の自動推測はしない。
他年度/曜日未確定では初回授業日の明示設定を要求し、現在年や4/1で補完しない。
「授業日程を調整」で初回日・campus・休講日を保存できる。
シラバスの今週表示も、従来の4/1から15週固定ではなく曜日別学事暦へ変更。

検証: 授業A/Bの仮code衝突、同授業の別日、資料・sourceIds・turns分離、
遅延返信、戻る/再読込、旧DB upgrade・履歴保存、2026両キャンパス各曜日15回、
火曜の添付例一致をテスト。Functions/Rules/IAM/Secret/allowlistは変更しない。

最終確認: 35 tests PASS、通常build / ai-preview build / Web境界チェックPASS。
実ブラウザでも火曜の第4回(10/13)から専用チャットが開くことを確認。
パネル内クリックで要素を置換しても外側クリックと誤判定しないようcomposedPathを使用。
今回は本番backend設定・deploy・データ移行は行っていない。

### 時間割年度とシラバス参照年度の分離

一部の2026年度時間割に前年YRのシラバスURLが残り、日程計算までcontext.yearを参照して
「初回授業日を設定」の空画面になる不具合を修正した。日程は時間割document由来の
academicYearを優先し、未取得の場合だけシラバス由来context.yearを使う。現在年には補完しない。
授業識別・snapshotのYR優先順位、courseOfferingId、local UUID、会話保存keyは変更しない。
年度が異なる場合は画面に日程の根拠を明示する。

実ブラウザで該当する水曜授業が9/16 → 9/30 → 10/7 → 10/14（第4回）となることを確認。
シラバスYRが前年でも自動カードを表示し、選択日がAPI contextへ渡る一方、参照年度は
書き換えないことをUI/単体テストで確認。Functions/Rules/IAM/Secretへの変更はない。

### 授業回チャットの全画面表示

授業回カードを開くと、チャットをviewport全体のnative dialogで表示する。
時間割の左パネル幅に制限せず、会話領域を広げ、入力欄を下部に配置する。
上部には授業名・授業回・日付と「授業回一覧」ボタンを表示し、Escでも戻れる。
授業回一覧へ戻った後は、開いていたカードにfocusを復元する。

Dialogはbody直下へ配置し、モバイルで非表示になるdesktop sidebarや親modalの
レイアウト制約を受けない。表示中は背景scrollを止め、終了・dispose時に解除する。
授業/授業日/UIDの保存key、Callable契約、Firebase設定は変更しない。
39 tests PASS、PC幅と390px幅の実ブラウザで全画面・入力欄・戻る/Escを確認。

### 推定コストの円表示

チャット返信・資料の処理情報は、backendのestimatedCostUSDを共通formatterで円に換算して表示。
USDの保存値、provider料金計算、usage、音声の時間課金には変更を加えない。
表示用の参考USD/JPYレートはsrc/ai/cost.tsのcostDisplayに分離し、
2026-10-15の1 USD = 157.76円を使用（自動更新・実請求レートではない）。
参照: https://www.investing.com/currencies/usd-jpy-historical-data
画面には推定、換算レート、参考日、実請求額との差を明記する。
1円未満は小数4桁まで表示し、極小の正額を0円と断定しない。未取得・不正値は未取得のまま。

### 右上の資料一覧

チャット上部に資料一覧・本文を常設せず、header右端の「資料 (件数)」から
右側のmodal drawerを開く。スマートフォン幅では画面幅に合わせる。
資料の参照checkbox、状態/進捗、本文・途中結果、再送、削除はdrawer内に維持する。
「この資料について聞く」ではdrawerを閉じて会話へ戻す。閉じる/Escで資料buttonにfocusを戻す。
閉じても選択状態や会話は初期化せず、授業/授業日/UID単位の既存保存範囲を維持。
資料が0件なら空状態を表示し、処理中件数はbuttonのtooltipで確認できる。
本番API・Firebase・アプリの変更やdeployは行わない。
検証: 43 tests、通常/preview build、境界/秘密情報scan、PC・390px幅の実ブラウザ。

### 保護付きWeb previewの共有準備

このbranchのVercel buildCommandはbuild:ai-preview。Git自動deployは引き続き無効で、
手動のCreate Preview Deploymentでのみ反映する。本番環境ではViteの
VERCEL_ENV=production guardによりAIを無効化し、本番hostの拒否も維持。
Vercelの既存Standard Protectionを確認してからPreviewを作成する。
X-Robots-Tag: noindex, nofollow, noarchiveは検索除外の補助でありアクセス制御ではない。

保護されたPreviewのShareable Linkだけを相手に渡す。リンクを転送された人も入場できる。
リンク値はcredential同様にGitへ保存せず、通常URLだけでは保護されることを別セッションで確認する。
共有停止は当該deploymentのShareからOnly people with accessへ戻す。

Firebase Googleログインにはexact preview hostnameのAuthorized domains設定、
画像/PDF/音声のsigned PUTにはexact HTTPS originのbucket CORS設定が必要。
この2点は実URL確定後に既存設定を保持して差分を確認し、承認を得て追加する。
pilot allowlistは自動追加しない。URLの入場許可とAI利用認可は別。
ブラウザごとのローカル会話履歴は自動移行・同期せず、新originでは新しい保存領域になる。
本番Web domain・main・iOS repo・Rules・Functions・Secretは変更しない。
