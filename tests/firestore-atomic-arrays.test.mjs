import test from 'node:test';
import assert from 'node:assert/strict';

import {
    store,
    STUDENT_ARRAY_FIELDS,
    applyArrayMutation,
    mutateStudentArrayRecord,
    addStudentArrayRecord,
    updateStudentArrayRecord,
    deleteStudentArrayRecord,
    addStudentExam,
    updateStudentExam,
    deleteStudentExam,
    addGuidanceRecordAtomic,
    updateGuidanceRecordAtomic,
    deleteGuidanceRecordAtomic,
    bulkAddStudentExam,
    STORAGE_KEY,
    localDataKey
} from '../store.js';

function setupMockEnvironment(options = {}) {
    const {
        useFirestore = true,
        isFirebaseActive = true,
        isGuestMode = false,
        onLine = true,
        userId = 'teacher_test_uid',
        initialDocs = {}
    } = options;

    const firestoreDb = new Map();
    for (const [docId, data] of Object.entries(initialDocs)) {
        firestoreDb.set(docId, JSON.parse(JSON.stringify(data)));
    }

    const syncStatusCalls = [];
    const firebaseErrors = [];
    const docUpdates = [];
    const localStorageStore = new Map();

    const mockWindow = {
        isFirebaseActive,
        auth: { currentUser: userId ? { uid: userId } : null },
        showSyncStatus: (msg, isErr) => {
            syncStatusCalls.push({ msg, isErr, timestamp: Date.now() });
        },
        handleFirebaseError: (err) => {
            firebaseErrors.push(err);
        },
        db: {
            collection: (collName) => ({
                doc: (docId) => ({
                    id: docId,
                    get: async () => {
                        const data = firestoreDb.get(docId);
                        return {
                            exists: Boolean(data),
                            data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
                        };
                    },
                    update: async (patch) => {
                        docUpdates.push({ collName, docId, patch });
                        const existing = firestoreDb.get(docId) || {};
                        const merged = { ...existing, ...patch };
                        firestoreDb.set(docId, JSON.parse(JSON.stringify(merged)));
                        return Promise.resolve();
                    }
                })
            }),
            runTransaction: async (updateFunction) => {
                let attempts = 0;
                while (attempts < 5) {
                    attempts++;
                    const readVersions = new Map();
                    const pendingUpdates = [];
                    const tx = {
                        get: async (docRef) => {
                            const docId = docRef.id;
                            const data = firestoreDb.get(docId);
                            readVersions.set(docId, data ? (data._version || 1) : 0);
                            return {
                                exists: Boolean(data),
                                data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
                            };
                        },
                        update: (docRef, patch) => {
                            pendingUpdates.push({ docId: docRef.id, patch });
                        }
                    };

                    const result = await updateFunction(tx);

                    let conflict = false;
                    for (const [docId, v] of readVersions.entries()) {
                        const current = firestoreDb.get(docId);
                        const currentVersion = current ? (current._version || 1) : 0;
                        if (currentVersion !== v) {
                            conflict = true;
                            break;
                        }
                    }

                    if (conflict) {
                        await new Promise(r => setTimeout(r, 10));
                        continue;
                    }

                    for (const { docId, patch } of pendingUpdates) {
                        docUpdates.push({ collName: 'students', docId, patch });
                        const existing = firestoreDb.get(docId) || {};
                        const newVersion = (existing._version || 1) + 1;
                        const merged = { ...existing, ...patch, _version: newVersion };
                        firestoreDb.set(docId, JSON.parse(JSON.stringify(merged)));
                    }

                    return result;
                }
                throw new Error('Transaction exceeded max retries due to contention');
            }
        }
    };

    const mockLocalStorage = {
        getItem: (key) => localStorageStore.get(key) || null,
        setItem: (key, val) => localStorageStore.set(key, String(val)),
        removeItem: (key) => localStorageStore.delete(key),
        clear: () => localStorageStore.clear()
    };

    globalThis.window = mockWindow;
    try {
        Object.defineProperty(globalThis.navigator, 'onLine', {
            value: onLine,
            configurable: true,
            writable: true
        });
    } catch {
        // Continue if navigator not configurable
    }
    globalThis.localStorage = mockLocalStorage;

    store.useFirestore = useFirestore;
    store.isGuestMode = isGuestMode;
    store.globalStudents = Object.values(initialDocs).map(d => JSON.parse(JSON.stringify(d)));

    return {
        firestoreDb,
        syncStatusCalls,
        firebaseErrors,
        docUpdates,
        localStorageStore,
        mockWindow
    };
}

test('TECH-04.3 Field Whitelist: only denemeler and guidanceRecords allowed', async () => {
    setupMockEnvironment();

    assert.deepEqual(STUDENT_ARRAY_FIELDS, ['denemeler', 'guidanceRecords']);

    await assert.rejects(
        () => mutateStudentArrayRecord({
            studentId: 's1',
            field: 'adSoyad',
            operation: 'ARRAY_ADD',
            record: { id: 'x1' }
        }),
        /is not a permitted array field/
    );

    await assert.rejects(
        () => mutateStudentArrayRecord({
            studentId: 's1',
            field: 'hedefNet',
            operation: 'ARRAY_UPDATE_BY_ID',
            recordId: 'x1'
        }),
        /is not a permitted array field/
    );
});

test('TECH-04.3 Scenario A: Exam add + guidance add on same student; both survive', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: { id: 's1', adSoyad: 'Ayşe', denemeler: [], guidanceRecords: [] }
        }
    });

    const exam1 = { id: 'ex_101', denemeAdi: 'LGS Deneme 1', toplamNet: 75 };
    const guidance1 = { id: 'rec_201', issue: 'Matematik kaygısı', action: 'Deneme analizi yapıldı', status: 'open' };

    const [resExam, resGuidance] = await Promise.all([
        addStudentExam('s1', exam1),
        addGuidanceRecordAtomic('s1', guidance1)
    ]);

    assert.equal(resExam.ok, true);
    assert.equal(resGuidance.ok, true);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.denemeler.length, 1, 'Exam must survive');
    assert.equal(doc.denemeler[0].id, 'ex_101');
    assert.equal(doc.guidanceRecords.length, 1, 'Guidance record must survive');
    assert.equal(doc.guidanceRecords[0].id, 'rec_201');
});

test('TECH-04.3 Scenario B: Two concurrent exam adds; both survive', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: { id: 's1', adSoyad: 'Kemal', denemeler: [{ id: 'ex_0', denemeAdi: 'Eski Deneme' }], guidanceRecords: [] }
        }
    });

    const examA = { id: 'ex_1', denemeAdi: 'Deneme A' };
    const examB = { id: 'ex_2', denemeAdi: 'Deneme B' };

    const [resA, resB] = await Promise.all([
        addStudentExam('s1', examA),
        addStudentExam('s1', examB)
    ]);

    assert.equal(resA.ok, true);
    assert.equal(resB.ok, true);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.denemeler.length, 3, 'Initial exam and both concurrent exams must all survive');
    const ids = doc.denemeler.map(e => e.id);
    assert.ok(ids.includes('ex_0'));
    assert.ok(ids.includes('ex_1'));
    assert.ok(ids.includes('ex_2'));
});

test('TECH-04.3 Scenario C: Two concurrent guidance adds; both survive', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: { id: 's1', adSoyad: 'Can', denemeler: [], guidanceRecords: [{ id: 'rec_0', issue: 'Başlangıç' }] }
        }
    });

    const g1 = { id: 'rec_1', issue: 'Konu 1' };
    const g2 = { id: 'rec_2', issue: 'Konu 2' };

    const [res1, res2] = await Promise.all([
        addGuidanceRecordAtomic('s1', g1),
        addGuidanceRecordAtomic('s1', g2)
    ]);

    assert.equal(res1.ok, true);
    assert.equal(res2.ok, true);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.guidanceRecords.length, 3, 'All guidance records must survive');
    const ids = doc.guidanceRecords.map(r => r.id);
    assert.ok(ids.includes('rec_0'));
    assert.ok(ids.includes('rec_1'));
    assert.ok(ids.includes('rec_2'));
});

test('TECH-04.3 Scenario D: Guidance update preserves remote-only record', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Elif',
                guidanceRecords: [
                    { id: 'rec_1', issue: 'Eski Sorun', action: 'Eski Aksiyon' },
                    { id: 'rec_remote', issue: 'Başka Sekmeden Eklenen', action: 'Aksiyon Remote' }
                ]
            }
        }
    });

    const updateRes = await updateGuidanceRecordAtomic('s1', 'rec_1', { action: 'Yeni Güncel Aksiyon' });
    assert.equal(updateRes.ok, true);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.guidanceRecords.length, 2);
    const updated = doc.guidanceRecords.find(r => r.id === 'rec_1');
    assert.equal(updated.action, 'Yeni Güncel Aksiyon');
    const remoteOnly = doc.guidanceRecords.find(r => r.id === 'rec_remote');
    assert.ok(remoteOnly, 'Remote record was preserved');
    assert.equal(remoteOnly.issue, 'Başka Sekmeden Eklenen');
});

test('TECH-04.3 Scenario E: Exam update preserves remote-only record', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Mert',
                denemeler: [
                    { id: 'ex_1', denemeAdi: 'Eski İsim', toplamNet: 60 },
                    { id: 'ex_remote', denemeAdi: 'Remote Eklenen Deneme', toplamNet: 80 }
                ]
            }
        }
    });

    const updateRes = await updateStudentExam('s1', 'ex_1', { denemeAdi: 'Yeni İsim', toplamNet: 65 });
    assert.equal(updateRes.ok, true);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.denemeler.length, 2);
    const updated = doc.denemeler.find(e => e.id === 'ex_1');
    assert.equal(updated.denemeAdi, 'Yeni İsim');
    assert.equal(updated.toplamNet, 65);
    const remoteExam = doc.denemeler.find(e => e.id === 'ex_remote');
    assert.ok(remoteExam, 'Remote-only exam survived');
});

test('TECH-04.3 Scenario F: Guidance delete preserves concurrently added record', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                guidanceRecords: [
                    { id: 'rec_1', issue: 'Silinecek' },
                    { id: 'rec_concurrent', issue: 'Eşzamanlı Eklenen' }
                ]
            }
        }
    });

    const delRes = await deleteGuidanceRecordAtomic('s1', 'rec_1');
    assert.equal(delRes.ok, true);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.guidanceRecords.length, 1);
    assert.equal(doc.guidanceRecords[0].id, 'rec_concurrent');
});

test('TECH-04.3 Scenario G: Exam delete preserves concurrently added record', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                denemeler: [
                    { id: 'ex_1', denemeAdi: 'Silinecek Deneme' },
                    { id: 'ex_concurrent', denemeAdi: 'Eşzamanlı Deneme' }
                ]
            }
        }
    });

    const delRes = await deleteStudentExam('s1', 'ex_1');
    assert.equal(delRes.ok, true);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.denemeler.length, 1);
    assert.equal(doc.denemeler[0].id, 'ex_concurrent');
});

test('TECH-04.3 Scenario H: Duplicate ID add does not create duplicate', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                denemeler: [{ id: 'ex_dup', denemeAdi: 'Orijinal Deneme' }]
            }
        }
    });

    const dupRes = await addStudentExam('s1', { id: 'ex_dup', denemeAdi: 'İkinci Kez Eklenen' });
    assert.equal(dupRes.ok, true);
    assert.equal(dupRes.noop, true);
    assert.equal(dupRes.duplicate, true);
    assert.equal(dupRes.writeCount, 0);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.denemeler.length, 1, 'No duplicate record created');
    assert.equal(doc.denemeler[0].denemeAdi, 'Orijinal Deneme');
});

test('TECH-04.3 Scenario I: Missing delete target safe no-op', async () => {
    const { firestoreDb, docUpdates } = setupMockEnvironment({
        initialDocs: {
            s1: { id: 's1', denemeler: [{ id: 'ex_1' }] }
        }
    });

    const res = await deleteStudentExam('s1', 'ex_non_existent');
    assert.equal(res.ok, true);
    assert.equal(res.noop, true);
    assert.equal(res.notFound, true);
    assert.equal(res.writeCount, 0);
    assert.equal(docUpdates.length, 0, 'No Firestore write executed for missing target');

    const doc = firestoreDb.get('s1');
    assert.equal(doc.denemeler.length, 1);
});

test('TECH-04.3 Scenario J: Missing update target follows explicit no-op policy', async () => {
    const { firestoreDb, docUpdates } = setupMockEnvironment({
        initialDocs: {
            s1: { id: 's1', guidanceRecords: [{ id: 'rec_1' }] }
        }
    });

    const res = await updateGuidanceRecordAtomic('s1', 'rec_ghost', { issue: 'Ghost record' });
    assert.equal(res.ok, true);
    assert.equal(res.noop, true);
    assert.equal(res.notFound, true);
    assert.equal(res.writeCount, 0);
    assert.equal(docUpdates.length, 0, 'No Firestore write executed');

    const doc = firestoreDb.get('s1');
    assert.equal(doc.guidanceRecords.length, 1, 'No ghost record inserted');
});

test('TECH-04.3 Scenario K: Stale local snapshot never replaces remote whole array online', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                denemeler: [
                    { id: 'ex_initial', denemeAdi: 'İlk Deneme' },
                    { id: 'ex_remote_tab', denemeAdi: 'Diğer Sekmeden Eklenen' }
                ]
            }
        }
    });

    // Simulate stale local state in current tab
    store.globalStudents = [{
        id: 's1',
        denemeler: [{ id: 'ex_initial', denemeAdi: 'İlk Deneme' }]
    }];

    const addRes = await addStudentExam('s1', { id: 'ex_new', denemeAdi: 'Yeni Deneme' });
    assert.equal(addRes.ok, true);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.denemeler.length, 3, 'Remote-only exam survived despite stale local memory');
    const ids = doc.denemeler.map(e => e.id);
    assert.ok(ids.includes('ex_initial'));
    assert.ok(ids.includes('ex_remote_tab'));
    assert.ok(ids.includes('ex_new'));
});

test('TECH-04.3 Scenario L: Transaction failure does not show success', async () => {
    const { syncStatusCalls, firebaseErrors } = setupMockEnvironment({
        initialDocs: { s1: { id: 's1', denemeler: [] } }
    });

    // Mock transaction rejection
    window.db.runTransaction = async () => {
        throw new Error('Transaction contention or network failure');
    };

    const res = await addStudentExam('s1', { id: 'ex_fail', denemeAdi: 'Hatalı' });
    assert.equal(res.ok, false);
    assert.ok(res.error);

    const successCalls = syncStatusCalls.filter(c => c.msg && c.msg.includes('Buluta kaydedildi'));
    assert.equal(successCalls.length, 0, 'No success message shown on failure');

    const errorCalls = syncStatusCalls.filter(c => c.isErr === true);
    assert.ok(errorCalls.length > 0, 'Error status message displayed');
    assert.equal(firebaseErrors.length, 1, 'Firebase error captured');
});

test('TECH-04.3 Scenario M: Multi-student exam partial failure reports accurate counts', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: { id: 's1', denemeler: [] },
            s3: { id: 's3', denemeler: [] }
            // s2 missing
        }
    });

    const exam = { id: 'ex_bulk', denemeAdi: 'Toplu Deneme', toplamNet: 50 };
    const bulkRes = await bulkAddStudentExam(['s1', 's2_missing', 's3'], exam);

    assert.equal(bulkRes.ok, false);
    assert.equal(bulkRes.totalCount, 3);
    assert.equal(bulkRes.successCount, 2);
    assert.equal(bulkRes.failedCount, 1);

    const s1Doc = firestoreDb.get('s1');
    const s3Doc = firestoreDb.get('s3');
    assert.equal(s1Doc.denemeler.length, 1);
    assert.equal(s3Doc.denemeler.length, 1);
});

test('TECH-04.3 Scenario N: Unrelated student fields unchanged', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Ali Veli',
                sinif: '8',
                okul: 'Atatürk OO',
                hedefNet: '85',
                dersUcreti: '750',
                veliTel: '05559998877',
                denemeler: [],
                guidanceRecords: []
            }
        }
    });

    await addStudentExam('s1', { id: 'ex_test', denemeAdi: 'Deneme Test' });

    const doc = firestoreDb.get('s1');
    assert.equal(doc.adSoyad, 'Ali Veli');
    assert.equal(doc.sinif, '8');
    assert.equal(doc.okul, 'Atatürk OO');
    assert.equal(doc.hedefNet, '85');
    assert.equal(doc.dersUcreti, '750');
    assert.equal(doc.veliTel, '05559998877');
});

test('TECH-04.3 / TECH-04.5 Offline Behavior: blocks risky array mutation to prevent LWW data loss', async () => {
    const { docUpdates, syncStatusCalls } = setupMockEnvironment({
        onLine: false,
        initialDocs: {
            s1: { id: 's1', denemeler: [] }
        }
    });

    const res = await addStudentExam('s1', { id: 'ex_off', denemeAdi: 'Offline Deneme' });

    assert.equal(res.ok, false);
    assert.equal(res.blockedOffline, true);
    assert.equal(docUpdates.length, 0);

    const blockedMsg = syncStatusCalls.find(c => c.isErr && c.msg.includes('çevrimdışıyken güvenli şekilde kaydedilemiyor'));
    assert.ok(blockedMsg, 'TECH-04.5 offline blocked message displayed');
});

test('TECH-04.3 Guest / Local Mode: persists to localStorage without Firestore', async () => {
    const { localStorageStore, docUpdates } = setupMockEnvironment({
        useFirestore: false,
        isGuestMode: true,
        initialDocs: {
            s1: { id: 's1', denemeler: [] }
        }
    });

    const res = await addStudentExam('s1', { id: 'ex_guest', denemeAdi: 'Misafir Deneme' });

    assert.equal(res.ok, true);
    assert.equal(res.mode, 'local');
    assert.equal(docUpdates.length, 0, 'No Firestore writes in guest mode');

    const raw = localStorageStore.get(localDataKey(STORAGE_KEY));
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.equal(parsed[0].denemeler.length, 1);
    assert.equal(parsed[0].denemeler[0].id, 'ex_guest');
});

test('TECH-04.3 Original Lost Update Fixed: Tab A exam-1 + Tab B stale guidance-1 both survive', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: { id: 's1', adSoyad: 'Test Student', denemeler: [], guidanceRecords: [] }
        }
    });

    // Tab A adds exam-1
    const resA = await addStudentExam('s1', { id: 'exam-1', denemeAdi: 'Exam 1' });
    assert.equal(resA.ok, true);

    // Tab B (which initially had stale state) adds guidance-1
    const resB = await addGuidanceRecordAtomic('s1', { id: 'guidance-1', issue: 'Issue 1' });
    assert.equal(resB.ok, true);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.denemeler.length, 1, 'Exam 1 must survive');
    assert.equal(doc.denemeler[0].id, 'exam-1');
    assert.equal(doc.guidanceRecords.length, 1, 'Guidance 1 must survive');
    assert.equal(doc.guidanceRecords[0].id, 'guidance-1');
});

test('TECH-04.3 Same-Field Conflict Fixed: Tab A adds g1, Tab B stale adds g2; both survive with g0', async () => {
    const { firestoreDb } = setupMockEnvironment({
        initialDocs: {
            s1: { id: 's1', guidanceRecords: [{ id: 'g0', issue: 'Initial 0' }] }
        }
    });

    const [resA, resB] = await Promise.all([
        addGuidanceRecordAtomic('s1', { id: 'g1', issue: 'Issue 1' }),
        addGuidanceRecordAtomic('s1', { id: 'g2', issue: 'Issue 2' })
    ]);

    assert.equal(resA.ok, true);
    assert.equal(resB.ok, true);

    const doc = firestoreDb.get('s1');
    assert.equal(doc.guidanceRecords.length, 3, 'g0, g1, and g2 must all survive');
    const ids = doc.guidanceRecords.map(r => r.id);
    assert.ok(ids.includes('g0'));
    assert.ok(ids.includes('g1'));
    assert.ok(ids.includes('g2'));
});

