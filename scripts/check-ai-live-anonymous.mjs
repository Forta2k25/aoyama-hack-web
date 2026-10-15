// Opt-in live security smoke test. No login, user IDs, files, writes, or provider calls.
// These malformed, unauthenticated requests must fail at the existing Auth boundary.
import assert from 'node:assert/strict'
const origin='http://localhost:5178'
const functions=['aiCreateSource','aiCompleteSource','aiGetSource','aiListSources','aiGetEvidence','aiRetrySource','aiUpdateSource','aiDeleteSource','aiRetrieveContext','aiChat']
for(const name of functions){
  const response=await fetch(`https://asia-northeast1-forta-aogaku.cloudfunctions.net/${name}`,{
    method:'POST',headers:{'Content-Type':'application/json',Origin:origin},
    body:JSON.stringify({data:{}}),signal:AbortSignal.timeout(60000),redirect:'error',
  })
  const body=await response.json()
  assert.equal(response.status,401,`${name}: anonymous request must be rejected`)
  assert.equal(body.error?.status,'UNAUTHENTICATED',`${name}: must reject before request processing`)
  assert.equal(response.headers.get('access-control-allow-origin'),origin,`${name}: localhost callable CORS`)
  console.log(`PASS ${name}: anonymous 401; localhost CORS`)
}
console.log('Authenticated E2E is separate: sign in to /mypage using an existing pilot account.')
