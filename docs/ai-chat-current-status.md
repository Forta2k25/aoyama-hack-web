# Web AI chat status — 2026-10-22

The current Web implementation is on `codex/web-ai-hack`. Its existing protected Preview uses the production Firebase project `forta-aogaku` and the shared deployed `aiChat`; it is not the local demo backend. The Web supports Markdown/LaTeX, collapsible input, attachments and the advertised streaming-recovery contract.

Preview: https://aoyama-hack-web-git-codex-web-ai-hack-forta2k25s-projects.vercel.app/mypage

Vercel Preview access and Firebase sign-in/pilot admission are separate gates. Existing Vercel access is required to view the protected Preview, and AI calls remain restricted to existing pilot accounts. A branch URL alone does not bypass either gate. Do not put bypass credentials, Firebase tokens or allowlist values in this repository.

## Numerical verification: current limitation

The shared backend currently performs bounded executable numerical checks, integer-neighbour checks and correction before releasing a numerical answer. No backend implementation or credentials are copied into this Web repository.

The latest production pilot verification had mixed results:

- The geometric-series regression returned the correct interval `1/2 < c < 2` and minimum `n = 9`, with errors approximately `0.16516` for `n = 8` and `0.09661` for `n = 9`. Web mathematical rendering was checked.
- A concept-only explanation completed without numerical-verification metadata.
- The multipart dice/quadratic/normal-distribution problem **remains unresolved**. The production check returned `unverified / NUMERICAL_CHECKS_FAILED` and the inconclusive message. Original-image local successes are not a production success claim. Repeated requests can incur additional latency/cost and do not guarantee a complete solution.

A frontend publish cannot resolve a shared-backend numerical-verification failure. Historical saved replies are not rewritten. Use a fresh message when checking a backend update.

## Web publication boundary

This save updates only this Web branch. It does not push the separate Aogaku repository, modify the iOS checkout, merge main, change the production website, or deploy/reconfigure Firebase. The existing Preview already calls the updated shared backend; no new frontend runtime change is needed for that connection.

`vercel.json` keeps branch auto-deployment disabled and search-engine indexing disabled. Preserve existing deployment protection, Firebase admission, Rules, IAM, Secrets and sharing configuration.

## Final Web checks

On 2026-10-22: 82/82 Web tests PASS, TypeScript/Vite AI Preview build PASS, and `check:ai-boundaries` PASS. These checks validate Web behaviour and boundaries; they are not evidence that every mathematical answer is correct.
