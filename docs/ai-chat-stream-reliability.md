# Chat stream reliability — local changes, 2026-10-21

This records the initial local validation before publication. That validation made no deploy, stage, commit, push or iOS-specific edit.

The subsequently requested Web release is limited to `codex/web-ai-hack` and the existing protected Preview. The Web client remains compatible with the old backend: automatic continuation requires a separately updated `aiChat` advertising `chat-resume-v1`; publishing Web alone does not enable it.

## Evidence and diagnosis

The production read-only audit obtained `aiChat` metadata (HTTP200), 158 Cloud Logging records since 2026-10-20T00:00Z (HTTP200, no further page), and the installed source using SourceCodeGet. The active revision was `aichat-00016-yik`, Node22, Function timeout120s, updateTime2026-10-20T05:31:42Z. Installed `lib/ai/chat.js` SHA256 was `4a3c5927c7bf49cc84574901c1ed0c61bd58e3f11c1ee6259e30ad332e1a63a4`.

That source uses maxOutputTokens1600, provider timeout60000ms, two8000-character guards, and rejects any finish reason other than STOP as CHAT_INVALID_RESULT. Replaying a forced MAX_TOKENS response against that exact installed module reproduced the reported failure after a readable prefix, with one provider request and no continuation. This is the confirmed code-level failure location: aiChat's provider stream completes, then its final validation throws. Firebase Callable can report that error within an HTTP200 SSE response.

The legacy production logs do not contain finishReason, chunk counts, output lengths or generation IDs. The sampled request records do not establish a120s timeout and contain no identifiable CHAT_INVALID_RESULT/MAX_TOKENS code. Therefore the exact historical user request cannot be uniquely attributed to token limit versus another interruption from those logs. No real question/provider payload was logged or used for a live reproduction.

Web uses vanilla TypeScript + Firebase Functions SDK0.13.4, not React. Its AbortController previously cancelled only on stop/dispose; the SDK streaming path forwards the signal but does not apply the httpsCallable timeout option. The SDK already buffers lines and decodes UTF-8 incrementally. The shared Gemini parser also buffered lines, but silently ignored malformed JSON. No evidence justified changing infrastructure timeout values. Firebase Functions already sends periodic `: ping` heartbeats; no duplicate heartbeat was added.

References: [Gemini FinishReason](https://ai.google.dev/api/generate-content#v1beta.Candidate.FinishReason), [Firebase Callable streaming](https://firebase.google.com/docs/functions/callable#stream_results).

## Local implementation

- Shared generation: distinguish MAX_TOKENS, retryable upstream failures, explicit safety/auth/validation failures and unconfirmed EOF. Keep maxOutputTokens1600 and provider timeout60s; Function120s is unchanged.
- At most2 continuations and2 transient retries, at most5 generation requests per invocation,90s overall generation budget,24,000 characters. Existing numerical review retains its105s aggregate deadline; it only verifies a completed generation.
- Transient network/429/500/502/503/504 recovery uses500ms then1500ms backoff. Auth400/401/403, safety, model mismatch and malformed complete SSE do not retry. Parent cancellation propagates through provider reads, backoff and numerical review.
- Continuations carry original question/sources/images plus the accumulated assistant draft and a continuation instruction. Exact suffix/prefix overlap is removed (including complete long-prefix replays); there is no fuzzy rewrite of earlier mathematics. The initial safe prose streams as before; subsequent segments are buffered until their overlap can be removed. Numerical drafts remain provisional until the existing calculator review passes.
- SSE parsing now retains complete events, CRLF and multiline data; final UTF-8 is flushed, incomplete EOF can recover, malformed complete JSON does not silently disappear. Work/suggestion hiding spans the generation and its continuations.
- Web transport recovers at most twice after an explicitly advertised `chat-resume-v1` capability. It never blindly repeats a billable request against the old production backend. Each recovery keeps the original request, source IDs, requestId/generationId and exact displayed partial. A3s grace only guards a missing final Callable event after stream EOF; normal final responses resolve immediately. The existing intended120s request limit is now connected to an actual AbortSignal; the total Web recovery deadline is240s. SDK data rejection handlers are attached immediately.
- A structured server exhausted-budget error is not automatically retried again by Web; manual continuation remains available where a resumable partial exists. Internal server recovery and client transport recovery have independent caps; a lost response can cause duplicate provider work until client disconnect is observed. There is no new durable server generation cache or exactly-once billing claim.
- Controller saves partial text on failure and appends a manual continuation into the same assistant message without duplicating the user turn. Rendering is batched at32ms during streaming to avoid rebuilding Markdown/KaTeX for every delta. User cancellation/navigation never auto-restarts.
- UI distinguishes generating, continuing, recovering, interrupted and non-retryable failure, and conditionally provides “続きから再開”. Drafts/materials remain unchanged. Incomplete text is not labelled a completed answer.
- Real usage is aggregated across provider segments. Missing usage or unknown cost across a disconnected Callable remains unknown; no synthetic zero/underestimated total is displayed. No pricing table/quota/Rules/IAM/Secrets/allowlist changes.
- New structured diagnostics contain requestId/generationId, provider, elapsed/first-response/first-token times, chunk/output counts, finishReason, HTTP status, retry/continuation counts and safe errorCode. No UID, question, generated answer, token/key or provider raw payload.
- Legacy native clients retain delta-only chunks and the existing final response schema/pipelineVersion. Web status/capability chunks require explicit opt-in. No iOS source/settings/renderer changes.

## Validation

- Web82/82 tests PASS, TypeScript/Vite build PASS, Web AI boundary guard PASS.
- Isolated shared Functions Node22 build PASS;155 tests:154 PASS /0 FAIL /1 SKIP (existing optional science PDF fixture absent). Includes prior numerical, domain, recognition, visual router/latency, recording and tutor-eval regressions.
- Short reply: one provider call, no retry sleep or extra pass for conceptual text.
- Long fixture: MAX_TOKENS→continuation→STOP through(h), no duplicate prefix, >8000 characters accepted within the bounded cap. Forced reset→retry→finish; bytewise SSE/UTF-8 Japanese, multiline/final events, malformed data, safety+late reset, auth failures, exhausted budgets and cancellation all tested.
- Numerical regression enumerates all216 dice triples:38 satisfy b²−4ac>0, p=19/108. Product counts4,8,6,6,4,8,0,2 for ac1…8. The actual shared chat orchestration corrects104/216 using the calculator, preserves(g)/(h), and verifies normal-tail probabilities by numerical integration. Prior n=6/15/11→9 tests still pass.
- Real browser: actual Firebase Web SDK→localhost Callable protocol fixture→modified shared aiChat, with a mocked provider that forces MAX_TOKENS and a connection reset. A single assistant bubble reaches(h), renders math, re-enables send, and does not show the old generic send-failed message. Separate Web tests cover disconnected final-event recovery and same-message manual continuation.
- The full original(a)–(h) problem text was not supplied; a–e are clearly marked synthetic carrier text, while supplied f–h are the numerical regression. No live provider accuracy/latency claim or production success claim is made.

The shared `aiChat` rollout needs separate authorization from Web publication. Until the backend advertises the new protocol, Web preserves partial UI but does not blindly retry billable requests against the old server.
