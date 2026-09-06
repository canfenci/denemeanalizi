import test from 'node:test';
import assert from 'node:assert/strict';

import {
    store,
    STUDY_PLAN_DAYS,
    isValidGrowthNestedField,
    updateGrowthWeeklyTarget,
    markGrowthErrorSolved,
    mutateGrowthLog,
    addGrowthLogAtomic,
    deleteGrowthLogAtomic,
    addStudyTaskAtomic,
    deleteStudyTaskAtomic,
    replaceStudyPlan,
    STORAGE_KEY,
    localDataKey
} from '../store.js';

import {
    deleteGrowthLog,
    deleteStudyTask
} from '../growth.js';

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

                    // Version check (optimistic locking)
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
                throw new Error('Transaction failed after max retries due to concurrent conflicts');
            }
        }
    };

    const originalWindow = globalThis.window;
    const originalLocalStorage = globalThis.localStorage;

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
    globalThis.localStorage = {
        getItem: (key) => localStorageStore.get(key) || null,
        setItem: (key, val) => localStorageStore.set(key, String(val)),
        removeItem: (key) => localStorageStore.delete(key),
        clear: () => localStorageStore.clear()
    };

    store.useFirestore = useFirestore;
    store.isGuestMode = isGuestMode;
    store.globalStudents = Object.values(initialDocs).map(d => JSON.parse(JSON.stringify(d)));
    localStorageStore.set(localDataKey(STORAGE_KEY), JSON.stringify(Object.values(initialDocs)));

    function teardown() {
        globalThis.window = originalWindow;
        try {
            Object.defineProperty(globalThis.navigator, 'onLine', {
                value: true,
                configurable: true,
                writable: true
            });
        } catch {
            // Ignore
        }
        globalThis.localStorage = originalLocalStorage;
        store.globalStudents = [];
    }

    return {
        firestoreDb,
        docUpdates,
        syncStatusCalls,
        firebaseErrors,
        localStorageStore,
        teardown
    };
}

// ---------------------------------------------------------------------------
// Scenario A: weeklyTarget writes only one nested field
// ---------------------------------------------------------------------------
test('Scenario A: weeklyTarget writes only one nested field', async () => {
    const env = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Ali Kaya',
                growthPlan: {
                    weeklyTarget: 500,
                    logs: [{ id: 'l1', date: '2026-08-10', count: 50 }]
                }
            }
        }
    });

    try {
        const res = await updateGrowthWeeklyTarget('s1', 750);
        assert.equal(res.ok, true);
        assert.equal(res.weeklyTarget, 750);

        assert.equal(env.docUpdates.length, 1);
        const update = env.docUpdates[0];
        assert.equal(update.docId, 's1');
        assert.deepEqual(update.patch, { 'growthPlan.weeklyTarget': 750 });

        // Remote document: weeklyTarget is 750 and logs array is preserved
        const remoteDoc = env.firestoreDb.get('s1');
        assert.equal(remoteDoc.growthPlan.weeklyTarget, 750);
        assert.equal(remoteDoc.growthPlan.logs.length, 1);
        assert.equal(remoteDoc.growthPlan.logs[0].id, 'l1');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario B: errorResets key update preserves siblings
// ---------------------------------------------------------------------------
test('Scenario B: errorResets key update preserves siblings', async () => {
    const env = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                errorResets: {
                    err_math_1: { status: 'solved', solvedAt: '2026-08-01' }
                }
            }
        }
    });

    try {
        const res = await markGrowthErrorSolved('s1', 'err_fen_2');
        assert.equal(res.ok, true);
        assert.equal(res.errorKey, 'err_fen_2');

        assert.equal(env.docUpdates.length, 1);
        assert.ok('errorResets.err_fen_2' in env.docUpdates[0].patch);

        const remoteDoc = env.firestoreDb.get('s1');
        assert.equal(remoteDoc.errorResets.err_math_1.status, 'solved');
        assert.equal(remoteDoc.errorResets.err_fen_2.status, 'solved');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario C: growth log add preserves concurrent weeklyTarget change
// ---------------------------------------------------------------------------
test('Scenario C: growth log add preserves concurrent weeklyTarget change', async () => {
    const env = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                growthPlan: {
                    weeklyTarget: 500,
                    logs: []
                }
            }
        }
    });

    try {
        // Tab B changes weeklyTarget concurrently
        await updateGrowthWeeklyTarget('s1', 1000);

        // Tab A adds growth log
        const res = await addGrowthLogAtomic('s1', { date: '2026-08-11', count: 80 });
        assert.equal(res.ok, true);

        const remoteDoc = env.firestoreDb.get('s1');
        assert.equal(remoteDoc.growthPlan.weeklyTarget, 1000, 'Concurrent weeklyTarget preserved');
        assert.equal(remoteDoc.growthPlan.logs.length, 1);
        assert.equal(remoteDoc.growthPlan.logs[0].count, 80);
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario D: two concurrent growth log adds both survive
// ---------------------------------------------------------------------------
test('Scenario D: two concurrent growth log adds both survive', async () => {
    const env = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                growthPlan: {
                    weeklyTarget: 500,
                    logs: []
                }
            }
        }
    });

    try {
        const p1 = addGrowthLogAtomic('s1', { id: 'log_a', date: '2026-08-10', count: 50 });
        const p2 = addGrowthLogAtomic('s1', { id: 'log_b', date: '2026-08-11', count: 60 });

        const [r1, r2] = await Promise.all([p1, p2]);
        assert.equal(r1.ok, true);
        assert.equal(r2.ok, true);

        const remoteDoc = env.firestoreDb.get('s1');
        assert.equal(remoteDoc.growthPlan.logs.length, 2, 'Both logs must survive');
        const ids = remoteDoc.growthPlan.logs.map(l => l.id);
        assert.ok(ids.includes('log_a'));
        assert.ok(ids.includes('log_b'));
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario E: growth log delete preserves concurrent remote add
// ---------------------------------------------------------------------------
test('Scenario E: growth log delete preserves concurrent remote add', async () => {
    const env = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                growthPlan: {
                    weeklyTarget: 500,
                    logs: [
                        { id: 'l1', date: '2026-08-01', count: 40 },
                        { id: 'l2', date: '2026-08-02', count: 50 }
                    ]
                }
            }
        }
    });

    try {
        // Tab B concurrently adds l3
        await addGrowthLogAtomic('s1', { id: 'l3', date: '2026-08-03', count: 60 });

        // Tab A deletes l1
        const res = await deleteGrowthLogAtomic('s1', { logId: 'l1' });
        assert.equal(res.ok, true);

        const remoteDoc = env.firestoreDb.get('s1');
        assert.equal(remoteDoc.growthPlan.logs.length, 2);
        const ids = remoteDoc.growthPlan.logs.map(l => l.id);
        assert.deepEqual(ids.sort(), ['l2', 'l3']);
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario F: studyPlan day A update preserves day B
// ---------------------------------------------------------------------------
test('Scenario F: studyPlan day A update preserves day B', async () => {
    const env = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                studyPlan: {
                    Pazartesi: ['Paragraf 20'],
                    Salı: ['Matematik 15']
                }
            }
        }
    });

    try {
        // Tab A adds to Pazartesi
        await addStudyTaskAtomic('s1', 'Pazartesi', 'Türkçe Deneme');

        // Tab B adds to Çarşamba
        await addStudyTaskAtomic('s1', 'Çarşamba', 'Fen Bilimleri 30');

        const remoteDoc = env.firestoreDb.get('s1');
        assert.deepEqual(remoteDoc.studyPlan.Pazartesi, ['Paragraf 20', 'Türkçe Deneme']);
        assert.deepEqual(remoteDoc.studyPlan.Salı, ['Matematik 15']);
        assert.deepEqual(remoteDoc.studyPlan.Çarşamba, ['Fen Bilimleri 30']);
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario G: same-day concurrent task adds follow chosen safe policy
// ---------------------------------------------------------------------------
test('Scenario G: same-day concurrent task adds follow chosen safe policy', async () => {
    const env = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                studyPlan: {
                    Pazartesi: ['Task 1']
                }
            }
        }
    });

    try {
        const p1 = addStudyTaskAtomic('s1', 'Pazartesi', 'Task 2');
        const p2 = addStudyTaskAtomic('s1', 'Pazartesi', 'Task 3');

        const [r1, r2] = await Promise.all([p1, p2]);
        assert.equal(r1.ok, true);
        assert.equal(r2.ok, true);

        const remoteDoc = env.firestoreDb.get('s1');
        assert.equal(remoteDoc.studyPlan.Pazartesi.length, 3, 'Both concurrent tasks must survive');
        assert.ok(remoteDoc.studyPlan.Pazartesi.includes('Task 2'));
        assert.ok(remoteDoc.studyPlan.Pazartesi.includes('Task 3'));
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario H: study task delete targets correct task, not stale index
// ---------------------------------------------------------------------------
test('Scenario H: study task delete targets correct task, not stale index', async () => {
    const env = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                studyPlan: {
                    Pazartesi: ['Task A', 'Task B', 'Task C']
                }
            }
        }
    });

    try {
        // Concurrent write: another task was prepended or index shifted
        const remoteDoc = env.firestoreDb.get('s1');
        remoteDoc.studyPlan.Pazartesi.unshift('Task X');

        // Delete 'Task B' specifying both text and stale index (1, but now it is at 2)
        const res = await deleteStudyTaskAtomic('s1', 'Pazartesi', { taskText: 'Task B', taskIdx: 1 });
        assert.equal(res.ok, true);

        const updatedDoc = env.firestoreDb.get('s1');
        assert.deepEqual(updatedDoc.studyPlan.Pazartesi, ['Task X', 'Task A', 'Task C']);
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario I: adaptive plan replace touches only studyPlan and studyPlanProfile
// ---------------------------------------------------------------------------
test('Scenario I: adaptive plan replace touches only studyPlan and studyPlanProfile', async () => {
    const env = setupMockEnvironment({
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Mehmet Demir',
                denemeler: [{ id: 'd1', baslik: 'LGS-1' }],
                growthPlan: { weeklyTarget: 600, logs: [{ id: 'l1' }] },
                studyPlan: {},
                studyPlanProfile: null
            }
        }
    });

    try {
        const newPlan = { Pazartesi: ['Matematik'], Salı: ['Türkçe'] };
        const newProfile = { badge: 'Bilim Ustası', stage: 'advanced' };

        const res = await replaceStudyPlan('s1', { studyPlan: newPlan, studyPlanProfile: newProfile });
        assert.equal(res.ok, true);

        assert.equal(env.docUpdates.length, 1);
        const patch = env.docUpdates[0].patch;
        assert.deepEqual(Object.keys(patch).sort(), ['studyPlan', 'studyPlanProfile']);

        const remoteDoc = env.firestoreDb.get('s1');
        assert.equal(remoteDoc.adSoyad, 'Mehmet Demir', 'Profile scalar preserved');
        assert.equal(remoteDoc.denemeler.length, 1, 'Exams preserved');
        assert.equal(remoteDoc.growthPlan.weeklyTarget, 600, 'Growth plan preserved');
        assert.deepEqual(remoteDoc.studyPlan, newPlan);
        assert.deepEqual(remoteDoc.studyPlanProfile, newProfile);
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario J: guest/local behavior preserved
// ---------------------------------------------------------------------------
test('Scenario J: guest/local behavior preserved', async () => {
    const env = setupMockEnvironment({
        isGuestMode: true,
        useFirestore: false,
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Misafir Öğrenci',
                growthPlan: { weeklyTarget: 300, logs: [] },
                studyPlan: { Pazartesi: [] }
            }
        }
    });

    try {
        const res = await updateGrowthWeeklyTarget('s1', 450);
        assert.equal(res.ok, true);
        assert.equal(res.mode, 'local');
        assert.equal(env.docUpdates.length, 0, 'No Firestore writes in guest mode');

        const localList = JSON.parse(env.localStorageStore.get(localDataKey(STORAGE_KEY)));
        assert.equal(localList[0].growthPlan.weeklyTarget, 450);

        // Local task add
        const taskRes = await addStudyTaskAtomic('s1', 'Pazartesi', 'Görev 1');
        assert.equal(taskRes.ok, true);
        assert.equal(taskRes.mode, 'local');
        const localListAfterTask = JSON.parse(env.localStorageStore.get(localDataKey(STORAGE_KEY)));
        assert.deepEqual(localListAfterTask[0].studyPlan.Pazartesi, ['Görev 1']);
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario K: offline queue semantics preserved
// ---------------------------------------------------------------------------
test('Scenario K: offline queue semantics preserved', async () => {
    const env = setupMockEnvironment({
        onLine: false,
        initialDocs: {
            s1: {
                id: 's1',
                growthPlan: { weeklyTarget: 500, logs: [] }
            }
        }
    });

    try {
        const res = await updateGrowthWeeklyTarget('s1', 800);
        assert.equal(res.ok, true);
        assert.equal(res.queued, true);

        // Queued sync message
        assert.ok(env.syncStatusCalls.some(c => c.msg.includes('Çevrimdışı') || c.msg.includes('senkronizasyon') || c.msg.includes('kuyruğa')));
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario L: transaction failure shows no false success
// ---------------------------------------------------------------------------
test('Scenario L: transaction failure shows no false success', async () => {
    const env = setupMockEnvironment({
        initialDocs: {
            s1: { id: 's1', growthPlan: { logs: [] } }
        }
    });

    // Sabotage runTransaction to fail
    window.db.runTransaction = async () => {
        throw new Error('Simulated network abort');
    };

    try {
        const res = await addGrowthLogAtomic('s1', { date: '2026-08-10', count: 100 });
        assert.equal(res.ok, false);
        assert.equal(res.mode, 'firestore');
        assert.ok(res.error);

        // Verify error message shown and no false success
        assert.ok(env.syncStatusCalls.some(c => c.isErr === true));
        assert.ok(!env.syncStatusCalls.some(c => c.msg.includes('✅')));
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario M: arbitrary nested path rejected
// ---------------------------------------------------------------------------
test('Scenario M: arbitrary nested path rejected', async () => {
    assert.equal(isValidGrowthNestedField('growthPlan.weeklyTarget'), true);
    assert.equal(isValidGrowthNestedField('growthPlan.logs'), true);
    assert.equal(isValidGrowthNestedField('studyPlan.Pazartesi'), true);
    assert.equal(isValidGrowthNestedField('studyPlan.Pazar'), true);
    assert.equal(isValidGrowthNestedField('errorResets.math_err_1'), true);

    // Rejections
    assert.equal(isValidGrowthNestedField('studyPlan.InvalidDay'), false);
    assert.equal(isValidGrowthNestedField('errorResets.key.with.dots'), false);
    assert.equal(isValidGrowthNestedField('password'), false);
    assert.equal(isValidGrowthNestedField('__proto__'), false);
    assert.equal(isValidGrowthNestedField('denemeler'), false);

    // Function validation rejection
    await assert.rejects(
        () => addStudyTaskAtomic('s1', 'BilinmeyenGun', 'Task'),
        /Invalid study plan day/
    );
    await assert.rejects(
        () => markGrowthErrorSolved('s1', 'invalid..key'),
        /Invalid error reset key/
    );
});

// ---------------------------------------------------------------------------
// Scenario N: 50 students / 1 growth mutation writes 1 doc only
// ---------------------------------------------------------------------------
test('Scenario N: 50 students / 1 growth mutation writes 1 doc only', async () => {
    const initialDocs = {};
    for (let i = 1; i <= 50; i++) {
        initialDocs[`stud_${i}`] = {
            id: `stud_${i}`,
            adSoyad: `Öğrenci ${i}`,
            growthPlan: { weeklyTarget: 500, logs: [] },
            studyPlan: {}
        };
    }

    const env = setupMockEnvironment({ initialDocs });

    try {
        // Mutate student 25 only
        await updateGrowthWeeklyTarget('stud_25', 900);
        await addStudyTaskAtomic('stud_25', 'Salı', 'Yeni Görev');
        await addGrowthLogAtomic('stud_25', { date: '2026-08-12', count: 120 });

        // Total updates must only target stud_25
        for (const update of env.docUpdates) {
            assert.equal(update.docId, 'stud_25', 'Must only write to target student');
        }

        // None of the other 49 students were written to
        for (let i = 1; i <= 50; i++) {
            if (i !== 25) {
                const s = env.firestoreDb.get(`stud_${i}`);
                assert.equal(s.growthPlan.weeklyTarget, 500);
                assert.equal(s.growthPlan.logs.length, 0);
            }
        }
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario O: Authenticated online growth mutations never dual-write user data to localStorage
// ---------------------------------------------------------------------------
test('Scenario O: Authenticated online growth mutations never dual-write user data to localStorage', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: true,
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Ali Kaya',
                growthPlan: { weeklyTarget: 500, logs: [{ id: 'l1', date: '2026-08-10', count: 50 }] },
                studyPlan: { Pazartesi: ['Eski Görev'] },
                errorResets: {}
            }
        }
    });

    try {
        let setItemCalls = 0;
        const origSet = globalThis.localStorage.setItem;
        globalThis.localStorage.setItem = (k, v) => {
            setItemCalls++;
            return origSet(k, v);
        };

        // 1. weeklyTarget update
        const resTarget = await updateGrowthWeeklyTarget('s1', 750);
        assert.equal(resTarget.ok, true);

        // 2. markGrowthErrorSolved
        const resErr = await markGrowthErrorSolved('s1', 'mat_soru_1');
        assert.equal(resErr.ok, true);

        // 3. growth log add
        const resLogAdd = await addGrowthLogAtomic('s1', { date: '2026-09-06', count: 40 });
        assert.equal(resLogAdd.ok, true);
        const addedLogId = resLogAdd.record.id;

        // 4. growth log delete
        const resLogDel = await deleteGrowthLogAtomic('s1', { logId: addedLogId });
        assert.equal(resLogDel.ok, true);

        // 5. study task add
        const resTaskAdd = await addStudyTaskAtomic('s1', 'Pazartesi', 'Online Görev');
        assert.equal(resTaskAdd.ok, true);

        // 6. study task delete
        const resTaskDel = await deleteStudyTaskAtomic('s1', 'Pazartesi', { taskText: 'Online Görev' });
        assert.equal(resTaskDel.ok, true);

        // 7. replaceStudyPlan
        const resPlan = await replaceStudyPlan('s1', { studyPlan: { Salı: ['Yeni Plan Görevi'] } });
        assert.equal(resPlan.ok, true);

        // VERDICT: Authenticated online mode must NEVER dual-write to localStorage
        assert.equal(setItemCalls, 0, 'Zero localStorage.setItem calls allowed in authenticated online cloud mode');
        assert.ok(env.docUpdates.length >= 7, 'Firestore updates must be dispatched');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario P: Authenticated offline queue does not dual-write cloud user data to guest localStorage
// ---------------------------------------------------------------------------
test('Scenario P: Authenticated offline queue does not dual-write cloud user data to guest localStorage', async () => {
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: false,
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Ali Kaya',
                growthPlan: { weeklyTarget: 500, logs: [{ id: 'l1', date: '2026-08-10', count: 50 }] },
                studyPlan: { Pazartesi: ['Mevcut Görev'] },
                errorResets: {}
            }
        }
    });

    try {
        let setItemCalls = 0;
        const origSet = globalThis.localStorage.setItem;
        globalThis.localStorage.setItem = (k, v) => {
            setItemCalls++;
            return origSet(k, v);
        };

        // All operations in offline mode
        const r1 = await updateGrowthWeeklyTarget('s1', 600);
        assert.equal(r1.queued, true);

        const r2 = await markGrowthErrorSolved('s1', 'geo_soru_2');
        assert.equal(r2.queued, true);

        const r3 = await addGrowthLogAtomic('s1', { date: '2026-09-06', count: 65 });
        assert.equal(r3.queued, true);

        const r4 = await deleteGrowthLogAtomic('s1', { logId: 'l1' });
        assert.equal(r4.queued, true);

        const r5 = await addStudyTaskAtomic('s1', 'Çarşamba', 'Offline Görev');
        assert.equal(r5.queued, true);

        const r6 = await deleteStudyTaskAtomic('s1', 'Çarşamba', { taskText: 'Offline Görev' });
        assert.equal(r6.queued, true);

        const r7 = await replaceStudyPlan('s1', { studyPlan: { Cuma: ['Hafta Sonu Öncesi'] } });
        assert.equal(r7.queued, true);

        // Firestore SDK queued writes without contaminating guest localStorage
        assert.equal(setItemCalls, 0, 'Offline cloud mode must not dual-write user data to localStorage');
        assert.ok(env.docUpdates.length >= 7, 'Offline writes queued into Firestore doc updates');
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario Q: Legacy duplicate date+count growth logs delete only intended record
// ---------------------------------------------------------------------------
test('Scenario Q: Legacy duplicate date+count growth logs delete only intended record', async () => {
    // 3-record fixture:
    // A: 2026-09-05, count=50 (legacy, no id)
    // B: 2026-09-05, count=50 (legacy, no id)
    // C: 2026-09-05, count=80 (legacy, no id)
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: true,
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Ayşe Demir',
                growthPlan: {
                    weeklyTarget: 500,
                    logs: [
                        { date: '2026-09-05', count: 50 },
                        { date: '2026-09-05', count: 50 },
                        { date: '2026-09-05', count: 80 }
                    ]
                }
            }
        }
    });

    try {
        // UI deletes record B (index 1 in logs array)
        // With occurrence tracking: occurrence=1
        const res = await deleteGrowthLogAtomic('s1', {
            index: 1,
            date: '2026-09-05',
            count: 50,
            occurrence: 1
        });
        assert.equal(res.ok, true);

        const remoteDoc = env.firestoreDb.get('s1');
        assert.equal(remoteDoc.growthPlan.logs.length, 2, 'Exactly one record must be deleted');
        
        // Final state:
        // A (date=09-05, count=50) must remain
        // B deleted
        // C (date=09-05, count=80) must remain
        assert.equal(remoteDoc.growthPlan.logs[0].date, '2026-09-05');
        assert.equal(remoteDoc.growthPlan.logs[0].count, 50);
        assert.equal(remoteDoc.growthPlan.logs[1].date, '2026-09-05');
        assert.equal(remoteDoc.growthPlan.logs[1].count, 80);

        // Also test deletion via UI deleteGrowthLog helper with index
        const env2 = setupMockEnvironment({
            useFirestore: true,
            isFirebaseActive: true,
            isGuestMode: false,
            onLine: true,
            initialDocs: {
                s2: {
                    id: 's2',
                    adSoyad: 'Mehmet Yılmaz',
                    growthPlan: {
                        weeklyTarget: 500,
                        logs: [
                            { date: '2026-09-05', count: 50 },
                            { date: '2026-09-05', count: 50 },
                            { date: '2026-09-05', count: 80 }
                        ]
                    }
                }
            }
        });

        // Calling UI helper deleteGrowthLog with index 1 (record B)
        await deleteGrowthLog('s2', 1);
        const remoteDoc2 = env2.firestoreDb.get('s2');
        assert.equal(remoteDoc2.growthPlan.logs.length, 2);
        assert.equal(remoteDoc2.growthPlan.logs[0].count, 50);
        assert.equal(remoteDoc2.growthPlan.logs[1].count, 80);
        env2.teardown();

        // Also verify new record with persistent ID never falls back to legacy matching
        const env3 = setupMockEnvironment({
            useFirestore: true,
            isFirebaseActive: true,
            isGuestMode: false,
            onLine: true,
            initialDocs: {
                s3: {
                    id: 's3',
                    adSoyad: 'Fatma Kaya',
                    growthPlan: {
                        weeklyTarget: 500,
                        logs: [
                            { id: 'real_id_1', date: '2026-09-05', count: 50 },
                            { id: 'real_id_2', date: '2026-09-05', count: 50 }
                        ]
                    }
                }
            }
        });
        // Deleting non-existent ID with matching date/count must NOT delete another record
        await deleteGrowthLogAtomic('s3', { logId: 'non_existent_id', date: '2026-09-05', count: 50 });
        const remoteDoc3 = env3.firestoreDb.get('s3');
        assert.equal(remoteDoc3.growthPlan.logs.length, 2, 'Must not delete any record when targetId is not found');
        env3.teardown();
    } finally {
        env.teardown();
    }
});

// ---------------------------------------------------------------------------
// Scenario R: Same-text study task delete follows explicit safe policy
// ---------------------------------------------------------------------------
test('Scenario R: Same-text study task delete follows explicit safe policy', async () => {
    // Duplicates allowed in weekly plan with stable identity (index + text fingerprint + occurrence)
    const env = setupMockEnvironment({
        useFirestore: true,
        isFirebaseActive: true,
        isGuestMode: false,
        onLine: true,
        initialDocs: {
            s1: {
                id: 's1',
                adSoyad: 'Can Test',
                studyPlan: {
                    Pazartesi: [
                        '20 soru çöz', // index 0, occurrence 0
                        'Konu tekrarı yap', // index 1
                        '20 soru çöz'  // index 2, occurrence 1
                    ]
                }
            }
        }
    });

    try {
        // Delete the second '20 soru çöz' task (index 2)
        const res = await deleteStudyTaskAtomic('s1', 'Pazartesi', {
            taskText: '20 soru çöz',
            taskIdx: 2,
            occurrence: 1
        });
        assert.equal(res.ok, true);

        const remoteDoc = env.firestoreDb.get('s1');
        assert.equal(remoteDoc.studyPlan.Pazartesi.length, 2);
        // Ordering must be preserved: first '20 soru çöz' followed by 'Konu tekrarı yap'
        assert.equal(remoteDoc.studyPlan.Pazartesi[0], '20 soru çöz');
        assert.equal(remoteDoc.studyPlan.Pazartesi[1], 'Konu tekrarı yap');

        // Also test UI helper deleteStudyTask with index 1
        await deleteStudyTask('s1', 'Pazartesi', 1);
        const remoteDocAfterSecondDel = env.firestoreDb.get('s1');
        assert.equal(remoteDocAfterSecondDel.studyPlan.Pazartesi.length, 1);
        assert.equal(remoteDocAfterSecondDel.studyPlan.Pazartesi[0], '20 soru çöz');
    } finally {
        env.teardown();
    }
});
