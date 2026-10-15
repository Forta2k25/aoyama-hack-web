import test from 'node:test'
import assert from 'node:assert/strict'
import metadata from '../scripts/lib/firestore-metadata.cjs'
const {stableDatabaseMetadata}=metadata
const before={name:'projects/test/databases/ai',uid:'database-id',updateTime:'2026-01-01',locationId:'asia-northeast1',deleteProtectionState:'DELETE_PROTECTION_ENABLED',type:'FIRESTORE_NATIVE',pointInTimeRecoveryEnablement:'POINT_IN_TIME_RECOVERY_DISABLED',versionRetentionPeriod:'3600s',etag:'one',earliestVersionTime:'yesterday'}
test('database guard tolerates only the computed read clock/checksum; preserves every configuration field',()=>{
 const after={...before,etag:'two',earliestVersionTime:'now'}
 assert.deepEqual(stableDatabaseMetadata(before),stableDatabaseMetadata(after))
 assert.equal(before.etag,'one')
 for(const field of Object.keys(before).filter(x=>!['etag','earliestVersionTime'].includes(x))){
  assert.notDeepEqual(stableDatabaseMetadata(before),stableDatabaseMetadata({...after,[field]:'changed'}),field)
 }
 assert.notDeepEqual(stableDatabaseMetadata(before),stableDatabaseMetadata({...after,newConfiguration:true}))
})
