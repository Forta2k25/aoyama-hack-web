# Course syllabus context for Web chat

The Web previously fetched a syllabus for its display panel but did not include it in `aiChat` requests. The deployed shared backend already accepts a top-level `syllabus` string (maximum 3,500 UTF-16 code units), places it in the course-background block separately from uploaded evidence, and keeps the existing reply schema.

This Web-only change connects that existing contract. It does not retrain a model, create a shared knowledge base or modify the AI Functions/iOS repository.

- The display panel and AI share one course-bound fetch using the existing syllabus proxy. A late response cannot replace another selected course or its chat.
- Extracted text includes the actual course overview, objectives, numbered teaching plan, evaluation, conditions, methods and book names/authors when present. It contains no invented book contents. Long sections use deterministic excerpts within the existing backend limit; the selected lecture's exact numbered plan entry is prioritized. Missing lecture entries are not guessed by array position.
- Syllabus reference year and timetable enrollment year stay distinct. Numbered plans are scheduled content, not proof that a lesson actually took place on its planned date.
- The same syllabus context accompanies normal replies, material intros and supported continuation/recovery. Uploaded evidence, locators, source IDs and course/session identity stay unchanged. Public syllabus text may be retained in the existing local resume-request snapshot; no new global cache, Firestore material or Storage object is created.
- No official syllabus URL means no fetch and no syllabus field, including custom courses without a syllabus. Invalid/lookalike hosts are rejected. Empty/error pages or network failure show an unavailable notice and let chat continue without inventing context. A university fetch is bounded to 12 seconds. Reopening the course retries retrieval.
- A lecture opened before retrieval waits before enabling send. A completed reference shows “この授業のシラバスを回答の参照情報に含めています。” No timetable/layout stylesheet changes are needed.
- Demo mode does not make a new university request unless explicitly supplied a fixture reference. It does not claim live AI verification.

Validation covers the real parser/loader, early UI entry, selected lecture numbers with missing rows, course-switch races, unavailable/custom courses, timeout, the deployed context length, reply/intro/manual continuation and Callable reconnect forwarding. Existing Web regressions and the AI boundary guard remain applicable. These tests prove context delivery, not a general answer-accuracy improvement or resolution of the known multipart numerical-verification limitation.

No Firebase deploy, Rules/IAM/Secret/allowlist change, iOS edit, main merge or public-production website update is required. Publish only the existing protected Web Preview branch when authorized.
