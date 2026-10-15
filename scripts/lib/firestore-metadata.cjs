// For read-only configuration comparisons, never for update/delete preconditions.
// Firestore's earliestVersionTime moves with time and participates in the server etag.
// Preserve updateTime, database identity, location, protection, PITR and all other fields.
function stableDatabaseMetadata(database){
  return Object.fromEntries(Object.entries(database).filter(([key])=>key!=='etag'&&key!=='earliestVersionTime'))
}
module.exports={stableDatabaseMetadata}
