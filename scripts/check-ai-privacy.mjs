import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'})
const files=git('diff','--cached','--name-only').trim().split('\n').filter(Boolean)
assert(files.length,'Stage the reviewed files first')
const patterns={providerKey:/\bgsk_[A-Za-z0-9_-]{20,}/,privateKey:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,idToken:/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,refreshToken:/\b1\/\/[A-Za-z0-9_-]{20,}/,signedURL:/https?:\/\/[^\s"'`]+(?:X-Goog-Signature|X-Goog-Credential|GoogleAccessId)=/,firebaseKey:/\bAIza[A-Za-z0-9_-]{25,}/,privateUID:/(?<![A-Za-z0-9_-])[A-Za-z0-9]{28}(?![A-Za-z0-9_-])/}
const findings=[]
for(const f of files){
 assert(!/(^|\/)(node_modules|dist|build|test-results|__pycache__)(\/|$)|\.env|\.local\.|credentials|private-registry|\.(png|jpg|jpeg|wav|m4a|pdf|zip|log|pyc)$/.test(f),'Private/generated/binary file staged: '+f)
 const body=git('show',':'+f)
 for(const [kind,re]of Object.entries(patterns))if(!(kind==='privateUID'&&f==='package-lock.json')&&re.test(body))findings.push({file:f,kind})
}
assert.deepEqual(findings,[],'Potential credentials/private UID: '+JSON.stringify(findings))
console.log(`PASS staged privacy scan: ${files.length} files; no credentials/private UID/fixture binaries/generated output`)
