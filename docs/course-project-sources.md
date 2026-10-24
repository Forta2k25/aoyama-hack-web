# 授業共通資料庫 / course-project-v1

## 利用方法

授業を一つのプロジェクトとして扱い、各授業回でアップロードした資料を共通資料庫へ表示する。チャット履歴は従来どおりユーザー・年度別授業・授業回で分離する。他の回の会話を検索資料として混ぜない。

- `今回の資料（通常）`: 今回の授業回の選択した添付だけを参照する。従来の最大8資料の契約を維持する。
- `この授業の全資料`: 同じユーザー・年度別授業に属する解析済み資料を横断して参照する。
- `授業回の範囲を指定`: 授業日程から開始回・終了回を選び、その間の開催日の資料を参照する。
- `試験対策（授業全体）` / `期末レポートを計画`: 全資料モードへ切り替えて下書きを作る。自動送信しない。

右上の「資料」は共通資料庫を開く。過去回の資料は授業日・授業回を付けて表示し、本文を閲覧できる。今回追加した資料のアップロード状況は引き続き入力欄に表示する。指定範囲外なら明示する。

## 保存と境界

Firebaseの既存sourceを共通資料として再利用する。コピー・再アップロード・再解析・一括移行は行わない。`aiListSources` の `dayID` で復元し、opaqueな `lectureId` から日付を推測しない。Webの一覧リクエストは `ownOnly: true` とする。解析中の資料は通常RAGに加えず、ready / partial_readyの最終chunksのみを使う。

Webのメッセージ本文・参照元は既存のIndexedDBへ保存する。チャット履歴そのものをFirestoreへ同期する変更ではない。参照元にはsourceId・授業日・ページ/時刻を保存し、回答の「参照資料」で確認できる。秘密情報・署名付きURL・provider raw responseは保存しない。

## Optional API contract

横断参照だけ、従来のsourceIds選択に代えて以下を送る。

```json
{"referenceScope":{"protocol":"course-project-v1","mode":"lectures","dayIDs":[20751,20758]}}
```

全資料なら `mode: "course"` としdayIDsを省略する。dayIDsは日付のepoch-day整数で、授業回番号ではない。contextは既存の年度別授業識別をそのまま送る。

`aiListSources.inputCapabilities.courseProject.protocol` が一致する場合だけ横断参照を有効にする。古いbackendでは通常の今回資料モードが使える。横断参照の返答は、最終 `references` のprotocol・resolved courseOfferingId・scope・dayIDsを照合した後に表示する。更新途中の古いaiChatが資料なしで回答しても、その本文を成功として表示しない。通常チャットのstreamingは維持する。

## 読み取り範囲の限界

共通資料庫は全候補を列挙するが、モデルへ渡すのは既存12,000文字の予算内の関連箇所。各資料に公平な予算を割り当て、質問に関連するchunksを最大3箇所、キーワード一致がなければ先頭・中央・末尾から抽出する。ページlocatorを維持する。全ページ全文を読んだとは表示しない。

解析待ち・失敗・読取中に変更された資料・本文のない資料の件数、部分完了や抜粋を表示する。読み取りにはsource最大120、走査最大2,000、各source最大1,000chunks、全候補本文2,000,000文字の上限がある。本文予算が足りない場合も含め、範囲を絞るエラーとし、先頭8件へsilent fallbackしない。既存quota・pricingは変更しない。

## 反映手順（未実行）

本番反映には別途承認が必要。共有Functionsの `aiChat` と `aiListSources` のみが対象。fresh audit後、aiChatのoptional契約を先に更新・照合し、aiListSourcesのcapability広告を最後に更新する。全post-check後にWeb Previewを更新する。他Functions・Rules・indexes・IAM・Secret・allowlist・queue・Scheduler・sharingは変更不要。

ロールバック時はWebの横断参照を止め、aiListSourcesのcapabilityを戻してからaiChatを戻す。既存source/chunksを変更していないので資料移行のrollbackは不要。

## ローカル検証

- `npm test`: 通常のWeb回帰、12資料・第1〜7回・会話分離・旧backend拒否・UI/保存まで検証。
- `AI_PROJECT_BACKEND_MODULE=/path/to/functions/lib/ai/courseProject.js npm test`: shared selector → prompt → mock Gemini reply → IndexedDB/UIの接続も実行する。
- `npm run build:student-preview`, `npm run build:ai-preview`, `npm run check:ai-boundaries`
- `/ai-project-debug`: 12件の架空資料を使うローカル画面。Firebase/外部AIへ送信しない。AI機能を有効にしたPreview modeでのみ使用する。

今回のテストはローカル・mockによるもので、本番実通信のPASSを示さない。反映後は同一pilotの複数授業回で資料追加→通常の今回参照→全体/範囲参照→参照資料の照合→再読込を確認し、他ユーザー・他授業・他年度・非pilot拒否も検証する。

## Web Preview保存 (2026-10-23)

Webソースのみを既存 `codex/web-ai-hack` に保存し、保護付き共有Previewを更新する。共有Functionsは別途deploy承認が必要。backendが `course-project-v1` を返すまでは本物の資料での横断参照を無効にし、今回資料の通常チャットを維持する。`/ai-project-debug` では架空12資料の全体/範囲参照UIを確認できる。Webの更新を本番backend反映・実通信E2E完了と解釈しない。
