import test from 'node:test';
import assert from 'node:assert/strict';

import {
    store,
    STORAGE_KEY,
    localDataKey,
    OFFLINE_BLOCKED_ARRAY_MESSAGE,
    isRiskyOfflineMutationBlocked,
    assertSafeOfflineMutation,
    addStudentExam,
    updateStudentExam,
    deleteStudentExam,
    addGuidanceRecordAtomic,
    updateGuidanceRecordAtomic,
    deleteGuidanceRecordAtomic,
    addGrowthLogAtomic,
    deleteGrowthLogAtomic,
    updateGrowthWeeklyTarget,
    markGrowthErrorSolved,
    addStudyTaskAtomic,
    deleteStudyTaskAtomic,
    replaceStudyPlan
} from '../store.js';

function applyDotUpdate(target, key, value) {
    if (key.includes('.')) {
        const parts = key.split('.');
        let cur = target;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
                cur[parts[i]] = {};
            }
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
    } else {
        target[key] = value;
    }
}

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
    const docVersions = new Map();

    for (const [docId, data] of Object.entries(initialDocs)) {
        firestoreDb.set(docId, JSON.parse(JSON.stringify(data)));
        docVersions.set(docId, 1);
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
                        docUpdates.push({ collName, docId, patch: JSON.parse(JSON.stringify(patch)) });
                        const existing = firestoreDb.get(docId) || {};
                        for (const [k, v] of Object.entries(patch)) {
                            applyDotUpdate(existing, k, JSON.parse(JSON.stringify(v)));
                        }
                        firestoreDb.set(docId, existing);
                        docVersions.set(docId, (docVersions.get(docId) || 0) + 1);
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
                            readVersions.set(docId, docVersions.get(docId) || 0);
                            const data = firestoreDb.get(docId);
                            return {
                                exists: Boolean(data),
                                data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
                            };
                        },
                        update: (docRef, patch) => {
                            pendingUpdates.push({ docId: docRef.id, patch });
                        }
                    };

                    await updateFunction(tx);

                    let conflict = false;
                    for (const [docId, ver] of readVersions.entries()) {
                        if (docVersions.get(docId) !== ver) {
                            conflict = true;
                            break;
                        }
                    }

                    if (!conflict) {
                        for (const { docId, patch } of pendingUpdates) {
                            docUpdates.push({ collName: 'students', docId, patch: JSON.parse(JSON.stringify(patch)) });
                            const existing = firestoreDb.get(docId) || {};
                            for (const [k, v] of Object.entries(patch)) {
                                applyDotUpdate(existing, k, JSON.parse(JSON.stringify(v)));
                            }
                            firestoreDb.set(docId, existing);
                            docVersions.set(docId, (docVersions.get(docId) || 0) + 1);
                        }
                        return;
                    }
                }
                throw new Error('Transaction contention');
            }
        }
    };

    const mockLocalStorage = {
        getItem: (k) => localStorageStore.get(k) || null,
        setItem: (k, v) => localStorageStore.set(k, String(v)),
        removeItem: (k) => localStorageStore.delete(k),
        clear: () => localStorageStore.clear()
    };

    const origWindow = globalThis.window;
    const origNav = globalThis.navigator;
    const origLocal = globalThis.localStorage;

    globalThis.window = mockWindow;
    globalThis.localStorage = mockLocalStorage;
    try {
        Object.defineProperty(globalThis.navigator, 'onLine', {
            value: onLine,
            configurable: true,
            writable: true
        });
    } catch {
        // Fallback
    }

    store.useFirestore = useFirestore;
    store.isGuestMode = isGuestMode;
    store.globalStudents = Object.values(initialDocs).map(d => JSON.parse(JSON.stringify(d)));

    return {
        firestoreDb,
        docUpdates,
        syncStatusCalls,
        firebaseErrors,
        localStorageStore,
        teardown: () => {
            globalThis.window = origWindow;
            globalThis.localStorage = origLocal;
            try {
                Object.defineProperty(globalThis.navigator, 'onLine', {
                    value: true,
                    configurable: true,
                    writable: true
                });
            } catch {
                // Fallback
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Scenario A: authenticated offline exam add blocked
// ---------------------------------------------------------------------------
test('Scenario A: authenticated offline exam add blocked', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: false,
        initialDocs: {
            s1: { id: 's1', denemeler: [] }
        }
    });

    try {
        const res = await addStudentExam('s1', { id: 'ex_1', denemeAdi: 'Offline Deneme' });

        assert.equal(res.ok, false);
        assert.equal(res.blockedOffline, true);
        assert.equal(res.message, OFFLINE_BLOCKED_ARRAY_MESSAGE);
        assert.equal(env.docUpdates.length, 0, 'No doc update should be dispatched when blocked');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario B: authenticated offline guidance add blocked
// ---------------------------------------------------------------------------
test('Scenario B: authenticated offline guidance add blocked', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: false,
        initialDocs: {
            s1: { id: 's1', guidanceRecords: [] }
        }
    });

    try {
        const res = await addGuidanceRecordAtomic('s1', { id: 'gr_1', type: 'academic', issue: 'Test', action: 'Plan' });

        assert.equal(res.ok, false);
        assert.equal(res.blockedOffline, true);
        assert.equal(res.message, OFFLINE_BLOCKED_ARRAY_MESSAGE);
        assert.equal(env.docUpdates.length, 0, 'No doc update should be dispatched when blocked');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario C: authenticated offline guidance complete blocked
// ---------------------------------------------------------------------------
test('Scenario C: authenticated offline guidance complete blocked', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: false,
        initialDocs: {
            s1: { id: 's1', guidanceRecords: [{ id: 'gr_1', issue: 'Takip', action: 'Plan' }] }
        }
    });

    try {
        const res = await updateGuidanceRecordAtomic('s1', 'gr_1', { result: 'positive', status: 'closed' });

        assert.equal(res.ok, false);
        assert.equal(res.blockedOffline, true);
        assert.equal(res.message, OFFLINE_BLOCKED_ARRAY_MESSAGE);
        assert.equal(env.docUpdates.length, 0, 'No doc update should be dispatched when blocked');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario D: authenticated offline growth log add blocked
// ---------------------------------------------------------------------------
test('Scenario D: authenticated offline growth log add blocked', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: false,
        initialDocs: {
            s1: { id: 's1', growthPlan: { logs: [] } }
        }
    });

    try {
        const res = await addGrowthLogAtomic('s1', { date: '2026-09-06', count: 50 });

        assert.equal(res.ok, false);
        assert.equal(res.blockedOffline, true);
        assert.equal(res.message, OFFLINE_BLOCKED_ARRAY_MESSAGE);
        assert.equal(env.docUpdates.length, 0, 'No doc update should be dispatched when blocked');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario E: authenticated offline study task same-day add blocked
// ---------------------------------------------------------------------------
test('Scenario E: authenticated offline study task same-day add blocked', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: false,
        initialDocs: {
            s1: { id: 's1', studyPlan: { Pazartesi: ['Görev A'] } }
        }
    });

    try {
        const res = await addStudyTaskAtomic('s1', 'Pazartesi', 'Görev B');

        assert.equal(res.ok, false);
        assert.equal(res.blockedOffline, true);
        assert.equal(res.message, OFFLINE_BLOCKED_ARRAY_MESSAGE);
        assert.equal(env.docUpdates.length, 0, 'No doc update should be dispatched when blocked');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario F: blocked mutation does not change store.globalStudents
// ---------------------------------------------------------------------------
test('Scenario F: blocked mutation does not change store.globalStudents', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: false,
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Zeynep Kaya',
                denemeler: [{ id: 'ex_orig', denemeAdi: 'Orijinal Deneme' }],
                guidanceRecords: [{ id: 'gr_orig', issue: 'Orijinal Gözlem' }],
                growthPlan: { weeklyTarget: 500, logs: [{ id: 'lg_orig', date: '2026-09-01', count: 20 }] },
                studyPlan: { Pazartesi: ['Orijinal Görev'] }
            }
        }
    });

    try {
        // Attempt blocked mutations
        await addStudentExam('s1', { id: 'ex_new', denemeAdi: 'Yeni Deneme' });
        await deleteStudentExam('s1', 'ex_orig');
        await addGuidanceRecordAtomic('s1', { id: 'gr_new', issue: 'Yeni' });
        await deleteGuidanceRecordAtomic('s1', 'gr_orig');
        await addGrowthLogAtomic('s1', { date: '2026-09-06', count: 99 });
        await deleteGrowthLogAtomic('s1', { logId: 'lg_orig' });
        await addStudyTaskAtomic('s1', 'Pazartesi', 'Yeni Görev');
        await deleteStudyTaskAtomic('s1', 'Pazartesi', { taskText: 'Orijinal Görev' });

        // In-memory store must remain strictly unchanged
        const student = store.globalStudents.find(s => s.id === 's1');
        assert.equal(student.denemeler.length, 1);
        assert.equal(student.denemeler[0].id, 'ex_orig');
        assert.equal(student.guidanceRecords.length, 1);
        assert.equal(student.guidanceRecords[0].id, 'gr_orig');
        assert.equal(student.growthPlan.logs.length, 1);
        assert.equal(student.growthPlan.logs[0].id, 'lg_orig');
        assert.equal(student.studyPlan.Pazartesi.length, 1);
        assert.equal(student.studyPlan.Pazartesi[0], 'Orijinal Görev');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario G: blocked mutation shows no success state
// ---------------------------------------------------------------------------
test('Scenario G: blocked mutation shows no success state', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: false,
        initialDocs: {
            s1: { id: 's1', denemeler: [] }
        }
    });

    try {
        await addStudentExam('s1', { id: 'ex_blocked', denemeAdi: 'Bloke Deneme' });

        // No fake success messages
        const fakeSuccess = env.syncStatusCalls.some(c => !c.isErr && (
            c.msg.includes('Buluta kaydedildi') ||
            c.msg.includes('başarıyla') ||
            c.msg.includes('senkronize edildi')
        ));
        assert.equal(fakeSuccess, false, 'No fake success allowed on blocked mutation');

        // Warning/error message must be displayed
        const blockedMsg = env.syncStatusCalls.find(c => c.isErr && c.msg === OFFLINE_BLOCKED_ARRAY_MESSAGE);
        assert.ok(blockedMsg, 'User must be informed with friendly offline blocked message');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario H: authenticated offline weeklyTarget still queues
// ---------------------------------------------------------------------------
test('Scenario H: authenticated offline weeklyTarget still queues', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: false,
        initialDocs: {
            s1: { id: 's1', growthPlan: { weeklyTarget: 500, logs: [] } }
        }
    });

    try {
        const res = await updateGrowthWeeklyTarget('s1', 750);

        assert.equal(res.ok, true);
        assert.equal(res.queued, true);
        assert.equal(env.docUpdates.length, 1);
        assert.equal(env.docUpdates[0].patch['growthPlan.weeklyTarget'], 750);

        // Queued sync status shown
        assert.ok(env.syncStatusCalls.some(c => c.msg.includes('Çevrimdışı') || c.msg.includes('bekliyor')));
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario I: authenticated offline errorResets key still queues
// ---------------------------------------------------------------------------
test('Scenario I: authenticated offline errorResets key still queues', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: false,
        initialDocs: {
            s1: { id: 's1', errorResets: {} }
        }
    });

    try {
        const res = await markGrowthErrorSolved('s1', 'fen_hata_1');

        assert.equal(res.ok, true);
        assert.equal(res.queued, true);
        assert.equal(env.docUpdates.length, 1);
        assert.ok(env.docUpdates[0].patch['errorResets.fen_hata_1']);
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario J: guest offline exam add still works locally
// ---------------------------------------------------------------------------
test('Scenario J: guest offline exam add still works locally', async () => {
    const env = setupMockEnvironment({
        useFirestore: false,
        isFirebaseActive: false,
        isGuestMode: true,
        onLine: false,
        initialDocs: {
            s1: { id: 's1', denemeler: [] }
        }
    });

    try {
        const res = await addStudentExam('s1', { id: 'ex_guest', denemeAdi: 'Misafir Deneme' });

        assert.equal(res.ok, true);
        assert.equal(res.mode, 'local');
        assert.equal(res.blockedOffline, undefined);

        // Written to canonical guest localStorage
        const stored = JSON.parse(env.localStorageStore.get(localDataKey(STORAGE_KEY)));
        assert.equal(stored[0].denemeler.length, 1);
        assert.equal(stored[0].denemeler[0].id, 'ex_guest');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario K: guest offline guidance add still works locally
// ---------------------------------------------------------------------------
test('Scenario K: guest offline guidance add still works locally', async () => {
    const env = setupMockEnvironment({
        useFirestore: false,
        isFirebaseActive: false,
        isGuestMode: true,
        onLine: false,
        initialDocs: {
            s1: { id: 's1', guidanceRecords: [] }
        }
    });

    try {
        const res = await addGuidanceRecordAtomic('s1', { id: 'gr_guest', issue: 'Misafir Gözlem', action: 'Aksiyon' });

        assert.equal(res.ok, true);
        assert.equal(res.mode, 'local');
        assert.equal(res.blockedOffline, undefined);

        const stored = JSON.parse(env.localStorageStore.get(localDataKey(STORAGE_KEY)));
        assert.equal(stored[0].guidanceRecords.length, 1);
        assert.equal(stored[0].guidanceRecords[0].id, 'gr_guest');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario L: online exam transaction unchanged
// ---------------------------------------------------------------------------
test('Scenario L: online exam transaction unchanged', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: true,
        initialDocs: {
            s1: { id: 's1', denemeler: [] }
        }
    });

    try {
        const res = await addStudentExam('s1', { id: 'ex_online', denemeAdi: 'Online Deneme' });

        assert.equal(res.ok, true);
        assert.equal(res.mode, 'firestore');
        assert.equal(res.writeCount, 1);
        assert.equal(env.docUpdates.length, 1);
        assert.equal(env.docUpdates[0].patch.denemeler[0].id, 'ex_online');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario M: online guidance transaction unchanged
// ---------------------------------------------------------------------------
test('Scenario M: online guidance transaction unchanged', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: true,
        initialDocs: {
            s1: { id: 's1', guidanceRecords: [] }
        }
    });

    try {
        const res = await addGuidanceRecordAtomic('s1', { id: 'gr_online', issue: 'Online Takip', action: 'Müdahale' });

        assert.equal(res.ok, true);
        assert.equal(res.mode, 'firestore');
        assert.equal(res.writeCount, 1);
        assert.equal(env.docUpdates.length, 1);
        assert.equal(env.docUpdates[0].patch.guidanceRecords[0].id, 'gr_online');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario N: online growth transaction unchanged
// ---------------------------------------------------------------------------
test('Scenario N: online growth transaction unchanged', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: true,
        initialDocs: {
            s1: { id: 's1', growthPlan: { logs: [] } }
        }
    });

    try {
        const res = await addGrowthLogAtomic('s1', { date: '2026-09-06', count: 120 });

        assert.equal(res.ok, true);
        assert.equal(res.mode, 'firestore');
        assert.equal(env.docUpdates.length, 1);
        assert.equal(env.docUpdates[0].patch['growthPlan.logs'].length, 1);
        assert.equal(env.docUpdates[0].patch['growthPlan.logs'][0].count, 120);
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario O: online study-plan transaction unchanged
// ---------------------------------------------------------------------------
test('Scenario O: online study-plan transaction unchanged', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: true,
        initialDocs: {
            s1: { id: 's1', studyPlan: { Pazartesi: [] } }
        }
    });

    try {
        const res = await addStudyTaskAtomic('s1', 'Pazartesi', 'Online Soru Çözümü');

        assert.equal(res.ok, true);
        assert.equal(res.mode, 'firestore');
        assert.equal(env.docUpdates.length, 1);
        assert.deepEqual(env.docUpdates[0].patch['studyPlan.Pazartesi'], ['Online Soru Çözümü']);
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario P: navigator.onLine=true but transaction reject shows failure, not success
// ---------------------------------------------------------------------------
test('Scenario P: navigator.onLine=true but transaction reject shows failure, not success', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: true,
        initialDocs: {
            s1: { id: 's1', denemeler: [] }
        }
    });

    // Simulate network disconnect during transaction
    window.db.runTransaction = async () => {
        throw new Error('Unavailable: Network connection lost');
    };

    try {
        const res = await addStudentExam('s1', { id: 'ex_unreachable', denemeAdi: 'Kayıp Deneme' });

        assert.equal(res.ok, false);
        assert.equal(res.mode, 'firestore');
        assert.ok(res.error);

        // No false success in syncStatus
        const fakeSuccess = env.syncStatusCalls.some(c => !c.isErr && (
            c.msg.includes('Buluta kaydedildi') ||
            c.msg.includes('başarıyla')
        ));
        assert.equal(fakeSuccess, false, 'Transaction failure must never report false success');

        // Error message shown
        const errorCall = env.syncStatusCalls.find(c => c.isErr);
        assert.ok(errorCall, 'Failure status displayed to user');
    } finally {
        env.teardown();
    }
});
