# Web AI: numerical review and Markdown/math display (local, 2026-10-21)

Status: Web rendering changes prepared for commit/push to codex/web-ai-hack. No deployment or iOS checkout changes. Shared Functions numerical verification remains local in a separate repository and is not included in this Web commit.

## Diagnosis

`CourseChat.message()` previously assigned the assistant body to `textContent`, intentionally avoiding HTML injection but also showing Markdown/LaTeX literally. There was no existing Markdown/math renderer. The app is vanilla TypeScript/Vite, not React.

The shared aiChat's original hidden work memo asked the model to check arithmetic; it did not execute a calculator or verify integer optimality. The previous deterministic numerical review changes are local and have not been deployed. A continued wrong answer on the hosted Web therefore does not demonstrate that those local checks executed. No production request trace or deployed revision was inspected for this change; the exact historical n=11 request cannot be reconstructed from a screenshot.

## Implementation

- Assistant answers: Marked 18.1.1, KaTeX 0.19.0, DOMPurify 3.4.17; development types: @types/katex 0.16.8.
- Standard headings, emphasis, lists, code, links, inline `$...$` and display `$$...$$`.
- Raw HTML is escaped, Markdown output is sanitized to a DOM fragment, and generated KaTeX is separately sanitized. No unsanitized model HTML insertion. External images are rendered as alt text; unsafe link schemes are rejected. KaTeX uses trust=false, bounded size/expansion and no cross-message macro state.
- Invalid/incomplete math stays literal, without erasing the rest of the answer; the complete response is rendered again on completion. Unchanged bodies preserve DOM nodes.
- User text, persisted history and copy/share payloads remain raw text/Markdown. No backend endpoint, provider credential, Auth gate or data contract change in this repository.
- Styles are scoped to assistant answers inside `.web-ai`; no normal timetable layout changes.

Official implementation guidance: [Marked extensions](https://marked.js.org/using_pro), [KaTeX security](https://katex.org/docs/security).

## Validation

- Web: 72/72 tests pass, including requested A–F examples, every streaming prefix, interruption, invalid math, XSS, links, literal code, CourseChat/controller streaming/final replacement, history reload and exact copy.
- TypeScript/Vite builds pass; `check:ai-boundaries` passes.
- New rendering dependencies have no npm audit advisory in the 2026-10-21 check. The existing lockfile dependency graph has 28 advisories (2 moderate / 24 high / 2 critical), involving existing Firebase/Vite/Vercel and transitive dependencies; broad dependency upgrades are outside this change.
- Isolated shared Functions: 143 tests, 142 pass / 0 fail / 1 optional existing PDF fixture skip; Node22 TypeScript build passes.
- Backend mock regressions start with 6, 15 and 11, check the original expression using the bounded calculator, recompute to 9 and verify 9/8. In particular 11 and 10 both satisfy, so 11 is rejected as a minimum. These are controlled provider mocks, not measurements of real model accuracy.
- Local browser: the actual CourseChat/controller receives the question, a local server executes the modified shared aiChat + calculator with a mock provider, and the final Markdown/math answer displays n=9, error(8)=0.16516 and error(9)=0.09661. No Firebase or real provider traffic. The harness lives in ignored build directories, not the shipping application.

## Limits / next review

The model still translates the problem into calculator expressions and drafts explanations. The calculator deterministically checks the supplied expressions/domain; this is not formal verification of all mathematics or proof that the model covered every claim. If review fails or remains inconsistent, the final numeric claim is withheld rather than published confidently. Real provider integration and hosted Web behavior remain unverified until a separately authorized deployment/test. Shared aiChat source may affect both clients once deployed; iOS-specific sources/settings/rendering were not edited.
