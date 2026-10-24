// Offline checks only. Never invokes Firebase, hosting, or another repository.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const base='ae7971e5bfcfc164dc5aa47e2a08cbbaea04321c'
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'})
assert.equal(git('remote','get-url','origin').trim(),'https://github.com/Forta2k25/aoyama-hack-web.git')
for(const file of ['src/firebase.ts','src/auth.ts','api/syllabus.ts'])assert.equal(readFileSync(file,'utf8'),git('show',`${base}:${file}`),`${file}: existing Firebase/auth/API must be preserved`)
const vercel=JSON.parse(readFileSync('vercel.json','utf8')),before=JSON.parse(git('show',`${base}:vercel.json`))
assert.equal(typeof vercel.git.deploymentEnabled['codex/web-ai-hack'],'boolean') // 2026-10-24: オーナーの指示で、pushでの自動公開(true)にした
assert.deepEqual(vercel.redirects,before.redirects);assert.deepEqual(vercel.rewrites,before.rewrites)
const source=readFileSync('src/ai/backend.ts','utf8')
assert(!/from ['"]firebase\/(firestore|storage)['"]/.test(source),'AI must use callable APIs, not direct named DB/Storage SDK')
assert(!/api\.groq\.com|secretmanager\.googleapis\.com/.test(source),'No browser provider key/Secret access')
assert(source.includes("'asia-northeast1'"));assert(source.includes("'aiChat'"))
const vite=readFileSync('vite.config.ts','utf8');assert(vite.includes("process.env.VERCEL_ENV!=='production'"));assert(vite.includes("process.env.CONTEXT!=='production'"))
console.log('PASS Web repository only; Firebase/auth untouched; branch auto-deploy setting explicit; production feature guard present; callable-only AI')
