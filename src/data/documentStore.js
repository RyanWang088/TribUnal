// Document text lives in IndexedDB rather than localStorage: a handful of
// judgments would blow localStorage's ~5MB budget, and a QuotaExceededError
// there would take case persistence down with it.
const DB_NAME = 'tribunal'
const DB_VERSION = 1
const STORE = 'documents'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('caseId', 'caseId')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run(mode, work) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const result = work(tx.objectStore(STORE))
        tx.oncomplete = () => {
          db.close()
          resolve(result?.result ?? result)
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error)
        }
      }),
  )
}

export function putDocument(doc) {
  return run('readwrite', (store) => store.put(doc))
}

export function deleteDocument(id) {
  return run('readwrite', (store) => store.delete(id))
}

export async function listDocuments(caseId) {
  const all = await run('readonly', (store) => store.index('caseId').getAll(caseId))
  return (all ?? []).sort((a, b) => (a.addedAt < b.addedAt ? -1 : 1))
}

export async function deleteCaseDocuments(caseId) {
  const docs = await listDocuments(caseId)
  await Promise.all(docs.map((d) => deleteDocument(d.id)))
}
