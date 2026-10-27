export type SourceKind = 'image' | 'pdf' | 'note' | 'audio'
export type SourceStatus = 'awaiting_upload' | 'queued' | 'extracting' | 'indexing' | 'ready' | 'partial_ready' | 'failed' | 'deleting' | 'deleted'
export interface CourseContext {
  localCourseId: string; localCourseUUID: string; classDocId?: string; year?: number
  semester?: string; syllabusUrl?: string; courseName: string; teacherName: string; dayID: number
}
export interface Recognition {
  provider?: string; model?: string; method?: string; pipelineVersion?: string
  inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null
  pricingAsOf?: string; estimatedCostUSD?: number | null; audioDurationSeconds?: number | null; processingMs?: number
  routing?: { pages: { pageNumber?: number; route: string; provider: string; model?: string }[] }
}
export interface RemoteSource {
  sourceId: string; sourceType: SourceKind; title: string; status: SourceStatus; courseOfferingId: string
  dayID?: number; lectureId?: string; pipelineVersion?: string; activeVersion?: string | null; previewVersion?: string | null
  previewProgress?: { completed: number; total: number }; recognition?: Recognition | null
  latency?: Record<string, unknown> | null; error?: { code: string; retryable: boolean } | null
}
export interface EvidenceChunk {
  chunkId: string; text: string; method: string; unitIndex?: number
  locator: { pageNumber?: number; imageIndex?: number; startChar?: number; endChar?: number; startSeconds?: number; endSeconds?: number }
}
export interface Evidence {
  items: EvidenceChunk[]; status: SourceStatus; nextCursor?: string | null
  preview?: boolean; previewVersion?: string | null; activeVersion?: string | null
  progress?: { completed: number; total: number }; recognition?: Recognition | null
  pipelineVersion?: string; latency?: Record<string, unknown> | null
}
export interface Upload { url: string; headers?: Record<string, string> }
export interface Receipt extends RemoteSource { upload?: Upload }
export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export interface ChatProgress {status:'generating'|'continuing'|'retrying';supported?:boolean;retryCount?:number;continuationCount?:number}
export interface ProjectScope {protocol:'course-project-v1';mode:'course'|'lectures';dayIDs?:number[]}
export interface ProjectReferences {protocol:'course-project-v1';courseOfferingId:string;scope:ProjectScope;targetSources:number;readySources:number;processingSources:number;failedSources:number;partialSources:number;changedSources:number;noTextSources:number;excerpted:boolean;characters:number;sources:{sourceId:string;title:string;dayID?:number;lectureId?:string;partial:boolean;locators:Record<string,number>[];excerpted:boolean}[]}
export interface ChatRequest { referenceScope?:ProjectScope;syllabus?:string;streamProtocol?:string;requestId?:string;generationId?:string;resume?:{protocol:string;partial:string};context: CourseContext; courseOfferingId?: string; sourceIds: string[]; requiredSourceIds?:string[]; materialExpected?:boolean; turns: ChatTurn[]; mode: 'reply' | 'intro' }
export interface ChatReply { text: string; recognition?: Recognition; references?:ProjectReferences; includedRequiredSourceIds?:string[] }
export interface AIBackend {
  readonly demo: boolean
  readonly projectContextProtocol?:string
  readonly resolvedCourseOfferingId?:string
  /** 会話の保存先の授業ID。会話を一度取ったあとに入る(リアルタイムの購読に使う) */
  readonly messagesOfferingId?:string
  create(data: { clientRequestId: string; type: SourceKind; title: string; mime: string; size: number; text?: string; durationSeconds?: number; context: CourseContext }, signal: AbortSignal): Promise<Receipt>
  complete(sourceId: string, uploadMs: number | undefined, signal: AbortSignal): Promise<RemoteSource>
  retry(sourceId: string, signal: AbortSignal): Promise<Receipt>
  get(sourceId: string, signal: AbortSignal): Promise<RemoteSource>
  list(context: CourseContext, signal: AbortSignal): Promise<RemoteSource[]>
  evidence(sourceId: string, preview: boolean, signal: AbortSignal): Promise<Evidence>
  delete(sourceId: string, signal: AbortSignal): Promise<void>
  upload(upload: Upload, file: Blob, signal: AbortSignal, progress: (percent: number) => void): Promise<void>
  chat(request: ChatRequest, signal: AbortSignal, delta: (text: string) => void, progress?: (p:ChatProgress)=>void): Promise<ChatReply>
  /** 会話の履歴(文章だけ)を、アプリとWebで同期する。対応していない接続(デモなど)では省略できる */
  saveMessages?(context: CourseContext, rows: SyncedMessage[], signal: AbortSignal): Promise<void>
  /** after を渡すと、その時刻(ms)より新しい発言だけを返す */
  listMessages?(context: CourseContext, signal: AbortSignal, after?: number): Promise<RemoteMessage[]>
}
export interface SyncedMessage { id: string; role: 'user' | 'assistant'; kind: 'text' | 'image' | 'audio' | 'pdf' | 'note'; text: string; imageCount?: number; createdAt: number }
export interface RemoteMessage extends SyncedMessage { dayID: number; semester?: string; imageCount: number }
export interface LocalMaterial {
  id: string; uid: string; courseKey: string; context: CourseContext; clientRequestId: string
  type: SourceKind; title: string; mime: string; size: number; text?: string; file?: Blob; durationSeconds?: number
  sessionKey?: string; remote?: RemoteSource; state: 'local' | 'uploading' | 'processing' | 'ready' | 'failed' | 'deleting'
  error?: string; wantsDeletion?: boolean; createdAt: number
}
export interface Message {
  id: string; uid: string; courseKey: string; role: 'user' | 'assistant'; text: string
  sessionKey?: string; references?:ProjectReferences;progress?:ChatProgress;error?:string;canResume?:boolean;resumeRequest?:ChatRequest;sourceIds: string[]; state: 'sending' | 'done' | 'failed' | 'interrupted'; createdAt: number; recognition?: Recognition
  /** 別の端末で、写真・録音・PDF・資料メモを送ったことを表す発言(本文はなく、種類と枚数だけを持つ) */
  attachmentKind?: 'image' | 'audio' | 'pdf' | 'note'; imageCount?: number
  /** サーバーに保存済みか(同期ずみ)。未保存の発言だけを、次の同期で送る */
  synced?: boolean
}
