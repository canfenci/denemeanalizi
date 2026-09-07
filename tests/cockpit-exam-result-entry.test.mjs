import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const studentsJsContent = fs.readFileSync(path.join(ROOT, 'students.js'), 'utf8');
const examsJsContent = fs.readFileSync(path.join(ROOT, 'exams.js'), 'utf8');

// ============================================================================
// PART 1: STATIC & ARCHITECTURAL CHECKS (Scenarios M, N, O, H, I, J, K)
// ============================================================================

test('Scenario M: store.js has zero git modifications', () => {
    const diff = execSync('git diff HEAD -- store.js', { encoding: 'utf8' }).trim();
    assert.equal(diff, '', 'store.js must have 0 diff against HEAD');
});

test('Scenario N: student.denemeler shape and persistence paths remain standard', () => {
    // Check that saveDenemeAta and updateStudentArrayRecord retain the standard denemeler shape
    assert.match(examsJsContent, /toplamDogru:\s*0/);
    assert.match(examsJsContent, /toplamYanlis:\s*0/);
    assert.match(examsJsContent, /toplamBos:\s*sorular\.length/);
    assert.match(examsJsContent, /toplamNet:\s*0/);
    assert.match(examsJsContent, /toplamSoru:\s*sorular\.length/);
    assert.match(examsJsContent, /updateStudentArrayRecord\(studentId,\s*'denemeler',\s*exam\.id,\s*updatedExam\)/);
});

test('Scenario O: Offline conflict guard is strictly preserved', () => {
    assert.match(examsJsContent, /const bulkRes = await bulkAddStudentExam\(selectedStudents, newExam\);/);
    assert.match(examsJsContent, /if \(hasOfflineBlocked\) \{/);
    assert.match(examsJsContent, /if \(res && !res\.ok && res\.blockedOffline\) \{/);
});

test('Scenario H & I: editExam delegates properly to editGenelExam and editBransExam', () => {
    assert.match(examsJsContent, /if\s*\(exam\.tip === ["']genel["']\)\s*\{\s*editGenelExam\(studentId,\s*examId,\s*exam\);\s*\}\s*else\s*\{\s*editBransExam\(studentId,\s*examId,\s*exam\);\s*\}/);
});

test('Scenario J & K: saveGenelExamEdit and saveBransExamEdit call renderStudentPanel', () => {
    assert.match(examsJsContent, /if\s*\(window\.renderStudentPanel\)\s*window\.renderStudentPanel\(studentId\);/);
    const saveGenelCalls = (examsJsContent.match(/renderStudentPanel\(studentId\)/g) || []).length;
    assert.ok(saveGenelCalls >= 2, 'Both saveBransExamEdit and saveGenelExamEdit must call renderStudentPanel');
});

// ============================================================================
// PART 2: PURE HELPER UNIT TESTS (Scenarios A & B)
// ============================================================================

// Browser & Storage polyfill for ESM imports
globalThis.window = globalThis;
globalThis.window.addEventListener = () => {};
globalThis.window.removeEventListener = () => {};
try {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
} catch {
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
                classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
                remove() { elementStore.delete(id); }
            });
        }
        return elementStore.get(id);
    },
    querySelectorAll: () => []
};
globalThis.document = mockDocument;
globalThis.window.document = mockDocument;

const { store, STORAGE_KEY, localDataKey } = await import('../store.js');
const { isExamResultPending } = await import('../exams.js');
const { renderStudentCockpit } = await import('../students.js');

test('Scenario A: Newly assigned empty exams are detected as resultPending === true', () => {
    // 1. Newly assigned 90-question general exam
    const pendingGenel = {
        id: 'ex_genel_1',
        denemeAdi: 'Mart Denemesi',
        tip: 'genel',
        tarih: '2026-09-01',
        toplamSoru: 90,
        toplamDogru: 0,
        toplamYanlis: 0,
        toplamBos: 90,
        toplamNet: 0,
        sorular: Array.from({ length: 90 }, (_, i) => ({ soruNo: i + 1, durum: 'bos' })),
        dersSonuclari: {
            turkce: { dogru: 0, yanlis: 0, bos: 20 },
            matematik: { dogru: 0, yanlis: 0, bos: 20 }
        }
    };
    assert.equal(isExamResultPending(pendingGenel), true, 'Assigned general exam should be pending');

    // 2. Newly assigned 20-question branch exam
    const pendingBrans = {
        id: 'ex_brans_1',
        denemeAdi: 'Basınç Konu Denemesi',
        tip: 'branş',
        ders: 'Fen Bilimleri',
        konu: 'Katı Basıncı',
        tarih: '2026-09-02',
        toplamSoru: 20,
        toplamDogru: 0,
        toplamYanlis: 0,
        toplamBos: 20,
        toplamNet: 0,
        sorular: Array.from({ length: 20 }, (_, i) => ({ soruNo: i + 1, durum: 'bos' }))
    };
    assert.equal(isExamResultPending(pendingBrans), true, 'Assigned branch exam should be pending');
});

test('Scenario B: Real exams with entered answers (even if totalNet === 0) are NOT pending', () => {
    // 1. Real 0 net exam with 5 correct, 15 wrong (5 - 5 = 0 net)
    const zeroNetExam = {
        id: 'ex_zero_net',
        denemeAdi: 'Zor Deneme',
        tip: 'genel',
        toplamSoru: 20,
        toplamDogru: 5,
        toplamYanlis: 15,
        toplamBos: 0,
        toplamNet: 0,
        sorular: [
            ...Array.from({ length: 5 }, (_, i) => ({ soruNo: i + 1, durum: 'dogru' })),
            ...Array.from({ length: 15 }, (_, i) => ({ soruNo: i + 6, durum: 'yanlis' }))
        ],
        dersSonuclari: {
            matematik: { dogru: 5, yanlis: 15, bos: 0 }
        }
    };
    assert.equal(isExamResultPending(zeroNetExam), false, 'Real exam with 0 net must NOT be pending');

    // 2. Exam with only wrong answers (e.g. 0D, 1Y, 19B)
    const oneWrongExam = {
        id: 'ex_wrong',
        toplamSoru: 20,
        toplamDogru: 0,
        toplamYanlis: 1,
        toplamBos: 19,
        toplamNet: -0.33,
        sorular: [{ soruNo: 1, durum: 'yanlis' }, ...Array.from({ length: 19 }, (_, i) => ({ soruNo: i + 2, durum: 'bos' }))]
    };
    assert.equal(isExamResultPending(oneWrongExam), false, 'Exam with 1 wrong answer must NOT be pending');

    // 3. Normal completed exam (45D, 30Y, 15B)
    const completedExam = {
        id: 'ex_completed',
        toplamSoru: 90,
        toplamDogru: 45,
        toplamYanlis: 30,
        toplamBos: 15,
        toplamNet: 35
    };
    assert.equal(isExamResultPending(completedExam), false, 'Completed exam must NOT be pending');

    // 4. Invalid or null exams
    assert.equal(isExamResultPending(null), false);
    assert.equal(isExamResultPending({}), false);
});

// ============================================================================
// PART 3: COCKPIT RENDERING & UI ACCESS TESTS (Scenarios C, D, E, F, G, L)
// ============================================================================

test('Scenario L: Empty state displays clean message and "Deneme Ekle" CTA when student has no exams', () => {
    const studentEmpty = {
        id: 'std_empty',
        adSoyad: 'Denemesiz Öğrenci',
        sinif: '8',
        denemeler: [],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentEmpty]));
    store.globalStudents = [studentEmpty];

    renderStudentCockpit('std_empty');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Henüz deneme eklenmemiş.'), 'Empty state text must be present');
    assert.ok(html.includes("openCockpitExam('std_empty')"), 'Empty state must have openCockpitExam CTA');
    assert.ok(html.includes('cf-empty-state'), 'Must use CanFenci cf-empty-state tokens');
});

test('Scenario C & D: Pending assigned exam shows "Sonuç Bekliyor" badge and "Sonuç Gir" button calling editExam', () => {
    const studentWithPending = {
        id: 'std_pending',
        adSoyad: 'Aylin Yıldız',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_pend_99',
                denemeAdi: 'Eylül Denemesi',
                tip: 'genel',
                tarih: '2026-09-05',
                toplamSoru: 90,
                toplamDogru: 0,
                toplamYanlis: 0,
                toplamBos: 90,
                toplamNet: 0,
                sorular: Array.from({ length: 90 }, (_, i) => ({ soruNo: i + 1, durum: 'bos' }))
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentWithPending]));
    store.globalStudents = [studentWithPending];

    renderStudentCockpit('std_pending');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Check header counter
    assert.ok(html.includes('1 sonuç bekliyor'), 'Header must indicate 1 pending exam');

    // Check card details
    assert.ok(html.includes('Eylül Denemesi'), 'Card must show exam name');
    assert.ok(html.includes('Genel Deneme'), 'Card must show exam type badge');
    assert.ok(html.includes('Sonuç Bekliyor'), 'Card must show Sonuç Bekliyor badge');
    assert.ok(html.includes('90 soru'), 'Card must show total question count');

    // Check action button
    assert.ok(html.includes("editExam('std_pending', 'ex_pend_99')"), 'Must call editExam on click');
    assert.ok(html.includes('Sonuç Gir'), 'Action button must read "Sonuç Gir"');
});

test('Scenario E, F, G: Completed exam shows D/Y/B/Net, "Sonucu Gör" (viewExam) and "Düzenle" (editExam)', () => {
    const studentWithCompleted = {
        id: 'std_done',
        adSoyad: 'Cem Kaya',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_done_101',
                denemeAdi: 'Kazanım Değerlendirme',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                konu: 'Mevsimler',
                kaynak: 'Soru Bankası',
                tarih: '2026-08-25',
                toplamSoru: 20,
                toplamDogru: 16,
                toplamYanlis: 3,
                toplamBos: 1,
                toplamNet: 15.0,
                sorular: []
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentWithCompleted]));
    store.globalStudents = [studentWithCompleted];

    renderStudentCockpit('std_done');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Must NOT have pending badge
    assert.doesNotMatch(html, /Sonuç Bekliyor/, 'Completed exam must not show Sonuç Bekliyor badge');

    // Must show stats
    assert.ok(html.includes('16D'), 'Must show correct count');
    assert.ok(html.includes('3Y'), 'Must show wrong count');
    assert.ok(html.includes('1B'), 'Must show blank count');
    assert.ok(html.includes('15 Net') || html.includes('15.00 Net'), 'Must show total net');

    // Must show metadata
    assert.ok(html.includes('Fen Bilimleri'), 'Must show subject');
    assert.ok(html.includes('Mevsimler'), 'Must show topic');
    assert.ok(html.includes('Soru Bankası'), 'Must show resource');

    // Actions
    assert.ok(html.includes("viewExam('std_done', 'ex_done_101')"), 'Must have viewExam button');
    assert.ok(html.includes('Sonucu Gör'), 'Must have Sonucu Gör button text');
    assert.ok(html.includes("editExam('std_done', 'ex_done_101')"), 'Must have editExam button');
    assert.ok(html.includes('Düzenle'), 'Must have Düzenle button text');
});

test('Scenario 24 (Visual Smoke Fixture): Multiple mixed exams order correctly by date descending', () => {
    const studentMixed = {
        id: 'std_mixed',
        adSoyad: 'Zeynep Ak',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_old_done',
                denemeAdi: 'Ağustos Genel Denemesi',
                tip: 'genel',
                tarih: '2026-08-15',
                toplamSoru: 90,
                toplamDogru: 60,
                toplamYanlis: 20,
                toplamBos: 10,
                toplamNet: 53.33
            },
            {
                id: 'ex_new_pending',
                denemeAdi: 'Eylül Başlangıç Denemesi',
                tip: 'genel',
                tarih: '2026-09-06',
                toplamSoru: 90,
                toplamDogru: 0,
                toplamYanlis: 0,
                toplamBos: 90,
                toplamNet: 0,
                sorular: Array.from({ length: 90 }, (_, i) => ({ durum: 'bos' }))
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentMixed]));
    store.globalStudents = [studentMixed];

    renderStudentCockpit('std_mixed');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Both exams should be rendered
    assert.ok(html.includes('Eylül Başlangıç Denemesi'));
    assert.ok(html.includes('Ağustos Genel Denemesi'));

    // The newer exam (2026-09-06) should appear before the older exam (2026-08-15) in the DOM
    const idxNew = html.indexOf('Eylül Başlangıç Denemesi');
    const idxOld = html.indexOf('Ağustos Genel Denemesi');
    assert.ok(idxNew < idxOld, 'Newer exam must be listed above older exam');

    // 1 pending exam badge in header
    assert.ok(html.includes('1 sonuç bekliyor'));
});

test('BUGFIX-UX-03.1: Cockpit exams section strictly does NOT contain deleteExam CTA while preserving Sonuç Gir, Sonucu Gör and Düzenle', () => {
    const student = {
        id: 'std_actions_test',
        adSoyad: 'Ali Veli',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_pending',
                denemeAdi: 'Deneme 1',
                tip: 'branş',
                tarih: '2026-09-07',
                toplamSoru: 20,
                toplamDogru: 0,
                toplamYanlis: 0,
                toplamBos: 20,
                toplamNet: 0
            },
            {
                id: 'ex_completed',
                denemeAdi: 'Deneme 2',
                tip: 'genel',
                tarih: '2026-09-01',
                toplamSoru: 90,
                toplamDogru: 50,
                toplamYanlis: 20,
                toplamBos: 20,
                toplamNet: 43.33
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_actions_test');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Extract the cockpit-exams-section
    const sectionMatch = html.match(/<section[^>]*id="cockpit-exams-section"[^>]*>([\s\S]*?)<\/section>/);
    assert.ok(sectionMatch, 'cockpit-exams-section must exist');
    const examsSection = sectionMatch[1];

    // Verify deleteExam CTA is NOT present in this section
    assert.doesNotMatch(examsSection, /deleteExam/, 'Cockpit exams section must NOT contain deleteExam action');

    // Verify required actions are preserved
    assert.match(examsSection, /editExam\('std_actions_test',\s*'ex_pending'\)/, 'Pending exam must have editExam');
    assert.ok(examsSection.includes('Sonuç Gir'), 'Pending exam must have "Sonuç Gir" button');

    assert.match(examsSection, /viewExam\('std_actions_test',\s*'ex_completed'\)/, 'Completed exam must have viewExam');
    assert.ok(examsSection.includes('Sonucu Gör'), 'Completed exam must have "Sonucu Gör" button');

    assert.match(examsSection, /editExam\('std_actions_test',\s*'ex_completed'\)/, 'Completed exam must have editExam');
    assert.ok(examsSection.includes('Düzenle'), 'Completed exam must have "Düzenle" button');

    // Verify deleteExam still exists in examsJsContent (untouched)
    assert.match(examsJsContent, /export async function deleteExam\(studentId,\s*examId\)/, 'deleteExam function in exams.js must be preserved');
});
