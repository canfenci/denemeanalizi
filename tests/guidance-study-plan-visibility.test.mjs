import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const guidanceJs = fs.readFileSync(path.join(ROOT, 'guidance.js'), 'utf8');
const growthJs = fs.readFileSync(path.join(ROOT, 'growth.js'), 'utf8');
const storeJs = fs.readFileSync(path.join(ROOT, 'store.js'), 'utf8');

// Setup minimal globals for modules expecting browser environment
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
try {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
} catch {
    // fallback if navigator is not defined
    globalThis.navigator = { onLine: true };
}
globalThis.window.isFirebaseActive = false;
globalThis.window.auth = { currentUser: null };
const storageMap = new Map();
const mockStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear()
};
globalThis.localStorage = mockStorage;
globalThis.window.localStorage = mockStorage;

const sessionStorageMap = new Map();
const mockSessionStorage = {
    getItem: (k) => sessionStorageMap.get(k) || null,
    setItem: (k, v) => sessionStorageMap.set(k, String(v)),
    removeItem: (k) => sessionStorageMap.delete(k),
    clear: () => sessionStorageMap.clear()
};
globalThis.sessionStorage = mockSessionStorage;
globalThis.window.sessionStorage = mockSessionStorage;

const elementStore = new Map();
const mockDocument = {
    getElementById: (id) => {
        if (!elementStore.has(id)) {
            elementStore.set(id, {
                innerHTML: '',
                textContent: '',
                id,
                classList: { add() {}, remove() {}, contains() { return false; } },
                remove() { elementStore.delete(id); }
            });
        }
        return elementStore.get(id);
    },
    querySelectorAll: () => []
};
globalThis.document = mockDocument;
globalThis.window.document = mockDocument;

// Dynamic imports after globals are established
const { store, STORAGE_KEY, localDataKey, replaceStudyPlan } = await import('../store.js');
const { renderGuidanceStudentDetail } = await import('../guidance.js');
const { autoPopulateStudyPlan } = await import('../growth.js');

// ============================================================================
// STATIC CODE CONTRACT TESTS (Scenarios A, D, F, G, H, J, K, L, M, N)
// ============================================================================

test('Scenario A & F (Static): Empty state message, Create CTA, and Edit CTA are configured', () => {
    assert.match(guidanceJs, /Henüz çalışma planı oluşturulmamış\./);
    assert.match(guidanceJs, /showStudyPlanSetup\('\$\{studentId\}'\)/);
});

test('Scenario B & N (Static): Study plan profile fields are rendered with badge, subject, duration, stage, intensity', () => {
    assert.match(guidanceJs, /planProfile\??\.badge/);
    assert.match(guidanceJs, /planProfile\??\.subject/);
    assert.match(guidanceJs, /planProfile\??\.durationWeeks/);
    assert.match(guidanceJs, /planProfile\??\.dailyMinutes/);
    assert.match(guidanceJs, /studyStageNames\[planProfile\??\.stage/);
    assert.match(guidanceJs, /studyIntensityNames\[planProfile\??\.intensity\]/);
});

test('Scenario C, D & E (Static): Canonical day order Pazartesi-Pazar and empty day notice', () => {
    assert.match(guidanceJs, /const CANONICAL_DAYS = \['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'\];/);
    assert.match(guidanceJs, /Bu gün için görev planlanmamış\./);
    assert.match(guidanceJs, /Aktif plan profili mevcut ancak haftalık görev eklenmemiş\./);
});

test('Scenario G (Static): PDF export button uses exportStudyPlanToPdf', () => {
    assert.match(guidanceJs, /exportStudyPlanToPdf\('\$\{studentId\}'\)/);
});

test('Scenario H & I (Static): autoPopulateStudyPlan sets _guidanceStudentTab to study and calls renderGuidanceStudentDetail', () => {
    assert.match(growthJs, /window\._guidanceStudentTab = 'study';/);
    assert.match(growthJs, /window\.renderGuidanceStudentDetail\(studentId\);/);
});

test('Scenario J (Static): autoPopulateStudyPlan guards against save failure without closing modal or fake success', () => {
    assert.match(growthJs, /const res = await replaceStudyPlan\(studentId,/);
    assert.match(growthJs, /if \(!res \|\| !res\.ok\) \{/);
    assert.match(growthJs, /return res;/);
    // closeStudyPlanSetup is only called after success check
    const saveBlock = growthJs.slice(growthJs.indexOf('replaceStudyPlan(studentId,'), growthJs.indexOf('closeStudyPlanSetup();'));
    assert.ok(saveBlock.includes('if (!res || !res.ok)'));
});

test('Scenario K & L (Static): store.js persistence semantics and STUDY_PLAN_DAYS remain unmodified', () => {
    assert.match(storeJs, /export const STUDY_PLAN_DAYS = Object\.freeze\(/);
    assert.match(storeJs, /export async function replaceStudyPlan\(studentId,/);
    // Check that git diff on store.js against origin/main or HEAD has no breaking changes
    const diff = execSync('git diff HEAD -- store.js', { encoding: 'utf8' });
    assert.equal(diff.trim(), '', 'store.js must not have any uncommitted changes');
});

test('Scenario M (Static): assertSafeOfflineMutation is active for atomic tasks and replaceStudyPlan persists locally', () => {
    assert.match(storeJs, /export function assertSafeOfflineMutation\(\)/);
    assert.match(storeJs, /const guard = assertSafeOfflineMutation\(\);/);
    assert.match(storeJs, /localStorage\.setItem\(localDataKey\(STORAGE_KEY\), JSON\.stringify\(localList\)\);/);
});

// ============================================================================
// DYNAMIC RUNTIME / DOM RENDERING TESTS (Scenarios A through J)
// ============================================================================

function resetMockEnvironment() {
    storageMap.clear();
    elementStore.clear();
    window._guidanceStudentTab = undefined;
    window._guidanceFilters = undefined;
    store.currentPage = 'guidance';
    store.globalStudents = [];
}

test('Scenario A (Runtime): Student without study plan renders empty state in study tab', () => {
    resetMockEnvironment();
    const student = {
        id: 'std_no_plan',
        adSoyad: 'Mehmet Demir',
        sinif: '8',
        okul: 'Atatürk Ortaokulu',
        hedefLise: 'Fen Lisesi',
        studyPlan: {},
        studyPlanProfile: null,
        guidanceRecords: [],
        odevler: [],
        denemeler: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];
    window._guidanceStudentTab = 'study';

    renderGuidanceStudentDetail('std_no_plan');

    const html = document.getElementById('dynamic-content').innerHTML;
    assert.ok(html.includes('Henüz çalışma planı oluşturulmamış.'), 'Must display empty state message');
    assert.ok(html.includes("showStudyPlanSetup('std_no_plan')"), 'Must display setup CTA button');
    assert.ok(html.includes('Çalışma Planı Oluştur'), 'Must have button text');
});

test('Scenario B, C, D, E (Runtime): Student with active study plan renders profile card, canonical days, tasks and empty day notices', () => {
    resetMockEnvironment();
    const student = {
        id: 'std_with_plan',
        adSoyad: 'Ayşe Kaya',
        sinif: '8',
        studyPlanProfile: {
            mode: 'branch:Fen Bilimleri',
            subject: 'Fen Bilimleri',
            stage: 'intermediate',
            intensity: 'balanced',
            techniques: ['feynman', 'soru-analiz'],
            days: ['Pazartesi', 'Çarşamba', 'Cuma'],
            dailyMinutes: 45,
            durationWeeks: 4,
            badge: 'FEN GELİŞTİRME',
            score: 72,
            generatedAt: '2026-09-01T10:00:00.000Z'
        },
        studyPlan: {
            'Pazartesi': [
                'Mevsimler ve İklim · Konu Tekrarı (20 dk) · 20 Soru'
            ],
            'Salı': [], // Empty day
            'Çarşamba': [
                'DNA ve Genetik Kod · Soru Çözümü (30 dk)'
            ],
            'Perşembe': [], // Empty day
            'Cuma': [
                {
                    title: 'Basınç Analizi',
                    questionTarget: 25,
                    duration: 35,
                    completed: true
                }
            ],
            'Cumartesi': [], // Empty day
            'Pazar': [] // Empty day
        },
        guidanceRecords: [],
        odevler: [],
        denemeler: []
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];
    window._guidanceStudentTab = 'study';

    renderGuidanceStudentDetail('std_with_plan');

    const html = document.getElementById('dynamic-content').innerHTML;

    // Scenario B: Profile summary card checks
    assert.ok(html.includes('FEN GELİŞTİRME'), 'Profile badge rendered');
    assert.ok(html.includes('Fen Bilimleri'), 'Subject rendered');
    assert.ok(html.includes('4 haftalık program'), 'Duration rendered');
    assert.ok(html.includes('45 dk'), 'Daily minutes rendered');
    assert.ok(html.includes('Orta'), 'Stage name rendered');
    assert.ok(html.includes('Dengeli'), 'Intensity name rendered');

    // Scenario C: Tasks rendering
    assert.ok(html.includes('Mevsimler ve İklim'), 'String task title rendered');
    assert.ok(html.includes('Konu Tekrarı (20 dk)'), 'String task tag rendered');
    assert.ok(html.includes('Basınç Analizi'), 'Object task title rendered');
    assert.ok(html.includes('25 soru'), 'Object question count rendered');
    assert.ok(html.includes('Tamamlandı'), 'Object completion badge rendered');

    // Scenario D: Canonical 7 days sequence check
    const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    let lastPos = -1;
    for (const day of days) {
        const pos = html.indexOf(`>${day}</h4>`);
        assert.ok(pos > -1, `Day ${day} must be in HTML`);
        assert.ok(pos > lastPos, `Day ${day} must appear after previous day in canonical order`);
        lastPos = pos;
    }

    // Scenario E: Empty day notice
    assert.ok(html.includes('Bu gün için görev planlanmamış.'), 'Empty day text must be shown for empty days');
});

test('Scenario F & G (Runtime): Action buttons for Edit and PDF are present with correct IDs', () => {
    resetMockEnvironment();
    const student = {
        id: 'std_btn_test',
        adSoyad: 'Can Test',
        studyPlanProfile: {
            subject: 'Matematik',
            badge: 'MATEMATİK KAMP'
        },
        studyPlan: {
            'Pazartesi': ['Çarpanlar ve Katlar']
        }
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];
    window._guidanceStudentTab = 'study';

    renderGuidanceStudentDetail('std_btn_test');

    const html = document.getElementById('dynamic-content').innerHTML;
    assert.ok(html.includes("showStudyPlanSetup('std_btn_test')"), 'Edit button calls showStudyPlanSetup');
    assert.ok(html.includes("exportStudyPlanToPdf('std_btn_test')"), 'PDF button calls exportStudyPlanToPdf');
});

test('Scenario H & I (Runtime): autoPopulateStudyPlan maintains study tab and triggers renderGuidanceStudentDetail on success', async () => {
    resetMockEnvironment();
    const student = {
        id: 'std_save_flow',
        adSoyad: 'Zeynep Ak',
        sinif: '8',
        studyPlan: {},
        studyPlanProfile: null
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];
    store.currentPage = 'guidance';

    let renderDetailCalledWith = null;
    window.renderGuidanceStudentDetail = (id) => {
        renderDetailCalledWith = id;
    };

    let syncStatusMsg = null;
    window.showSyncStatus = (msg) => {
        syncStatusMsg = msg;
    };

    let modalRemoved = false;
    elementStore.set('studyPlanSetupModal', {
        id: 'studyPlanSetupModal',
        innerHTML: '',
        classList: { add() {}, remove() {}, contains() { return false; } },
        remove() {
            modalRemoved = true;
            elementStore.delete('studyPlanSetupModal');
        }
    });

    const res = await autoPopulateStudyPlan('std_save_flow', {
        mode: 'branch:Fen Bilimleri',
        stageChoice: 'beginner',
        intensityChoice: 'light',
        durationWeeks: 3,
        dailyMinutes: 30,
        techniques: ['pomodoro'],
        days: ['Pazartesi', 'Çarşamba']
    });

    assert.equal(res.ok, true, 'Save should return ok: true');
    assert.equal(window._guidanceStudentTab, 'study', 'window._guidanceStudentTab must be set to "study"');
    assert.equal(renderDetailCalledWith, 'std_save_flow', 'renderGuidanceStudentDetail must be called with studentId');
    assert.equal(modalRemoved, true, 'studyPlanSetupModal must be removed on success');
    const syncStatusEl = document.getElementById('syncStatus');
    assert.ok(syncStatusEl.textContent && syncStatusEl.textContent.includes('programı oluşturuldu'), 'Sync notification shown');
});

test('Scenario J (Runtime): autoPopulateStudyPlan on save failure does not close modal or display fake success', async () => {
    resetMockEnvironment();
    const student = {
        id: 'std_fail_flow',
        adSoyad: 'Ali Arıza',
        sinif: '8'
    };

    localStorage.setItem(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];
    store.currentPage = 'guidance';

    let modalRemoved = false;
    elementStore.set('studyPlanSetupModal', {
        id: 'studyPlanSetupModal',
        innerHTML: '',
        classList: { add() {}, remove() {}, contains() { return false; } },
        remove() {
            modalRemoved = true;
            elementStore.delete('studyPlanSetupModal');
        }
    });

    let alertCalledWith = null;
    window.alert = (msg) => {
        alertCalledWith = msg;
    };

    const missingRes = await autoPopulateStudyPlan('non_existent_id', {});
    assert.equal(missingRes.ok, false);
    assert.equal(modalRemoved, false, 'Modal should remain open on error');
});
