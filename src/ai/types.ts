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
  lectureId?: string; pipelineVersion?: string; activeVersion?: string | null; previewVersion?: string | null
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
export interface ChatRequest { context: CourseContext; courseOfferingId?: string; sourceIds: string[]; turns: ChatTurn[]; mode: 'reply' | 'intro' }
export interface ChatReply { text: string; recognition?: Recognition }
export interface AIBackend {
  readonly demo: boolean
  create(data: { clientRequestId: string; type: SourceKind; title: string; mime: string; size: number; text?: string; durationSeconds?: number; context: CourseContext }, signal: AbortSignal): Promise<Receipt>
  complete(sourceId: string, uploadMs: number | undefined, signal: AbortSignal): Promise<RemoteSource>
  retry(sourceId: string, signal: AbortSignal): Promise<Receipt>
  get(sourceId: string, signal: AbortSignal): Promise<RemoteSource>
  list(context: CourseContext, signal: AbortSignal): Promise<RemoteSource[]>
  evidence(sourceId: string, preview: boolean, signal: AbortSignal): Promise<Evidence>
  delete(sourceId: string, signal: AbortSignal): Promise<void>
  upload(upload: Upload, file: Blob, signal: AbortSignal, progress: (percent: number) => void): Promise<void>
  chat(request: ChatRequest, signal: AbortSignal, delta: (text: string) => void): Promise<ChatReply>
}
export interface LocalMaterial {
  id: string; uid: string; courseKey: string; context: CourseContext; clientRequestId: string
  type: SourceKind; title: string; mime: string; size: number; text?: string; file?: Blob; durationSeconds?: number
  sessionKey?: string; remote?: RemoteSource; state: 'local' | 'uploading' | 'processing' | 'ready' | 'failed' | 'deleting'
  error?: string; wantsDeletion?: boolean; createdAt: number
}
export interface Message {
  id: string; uid: string; courseKey: string; role: 'user' | 'assistant'; text: string
  sessionKey?: string; sourceIds: string[]; state: 'sending' | 'done' | 'failed' | 'interrupted'; createdAt: number; recognition?: Recognition
}
