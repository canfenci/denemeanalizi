import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const studentsJsContent = fs.readFileSync(path.join(ROOT, 'students.js'), 'utf8');
const cockpitInsightsJsContent = fs.readFileSync(path.join(ROOT, 'student-cockpit-insights.js'), 'utf8');

// ============================================================================
// PART 1: DATA SAFETY & REPOSITORY INTEGRITY
// ============================================================================

test('Scenario A: Zero git modifications on protected core files', () => {
    const protectedFiles = [
        'store.js',
        'firebase-config.js',
        'firestore.rules',
        'auth.js',
        'index.html',
        'finance.js',
        'schedule.js',
        'homework.js',
        'exams.js'
    ];

    for (const file of protectedFiles) {
        const diff = execSync(`git diff HEAD -- ${file}`, { encoding: 'utf8' }).trim();
        assert.equal(diff, '', `${file} must have 0 diff against HEAD`);
    }
});

test('Scenario B: No destructive database operations in students.js', () => {
    assert.doesNotMatch(studentsJsContent, /localStorage\.clear\s*\(/);
    assert.doesNotMatch(studentsJsContent, /indexedDB\.deleteDatabase\s*\(/);
    assert.doesNotMatch(studentsJsContent, /clearPersistence\s*\(/);
});

// ============================================================================
// PART 2: STATIC CODE AUDIT — SIMPLIFICATION & COMPONENT POLISH
// ============================================================================

test('Scenario C: Quick Actions toolbar is compact and removes redundant text', () => {
    // Must not contain "seçili kalır."
    assert.doesNotMatch(studentsJsContent, /seçili kalır\./, 'Must remove redundant "X seçili kalır." text');
    // Must retain all 5 actions
    assert.match(studentsJsContent, /openCockpitHomework\(/, 'Must retain openCockpitHomework');
    assert.match(studentsJsContent, /openCockpitExam\(/, 'Must retain openCockpitExam');
    assert.match(studentsJsContent, /openCockpitLesson\([^,]+,\s*false\)/, 'Must retain openCockpitLesson false');
    assert.match(studentsJsContent, /openCockpitLesson\([^,]+,\s*true\)/, 'Must retain openCockpitLesson true');
    assert.match(studentsJsContent, /showStudyPlanSetup\(/, 'Must retain showStudyPlanSetup');
});

test('Scenario D: Duplicate "Öğrenci durum özeti" panel is completely removed from Overview', () => {
    assert.doesNotMatch(studentsJsContent, />Öğrenci durum özeti</, 'Öğrenci durum özeti panel must be removed');
});

test('Scenario E: Separate "1/5 Deneme Ort." top KPI is removed from 3-card metric grid', () => {
    assert.doesNotMatch(studentsJsContent, />\s*\$\{cockpit\.averageCount\s*\|\|\s*5\}\s*deneme ort\.\s*</, 'deneme ort. KPI card must be removed from primary KPIs');
});

test('Scenario F: Kritik İçgörüler uses compact 2x2 grid layout', () => {
    assert.match(studentsJsContent, /grid-cols-1\s+sm:grid-cols-2\s+gap-2\.5/, 'Kritik içgörüler must use 2x2 grid');
    assert.match(studentsJsContent, /En güçlü ders/, 'Must preserve En güçlü ders');
    assert.match(studentsJsContent, /Kritik eksik/, 'Must preserve Kritik eksik');
    assert.match(studentsJsContent, /En sık hata/, 'Must preserve En sık hata');
    assert.match(studentsJsContent, /Bu haftaki öncelik/, 'Must preserve Bu haftaki öncelik');
});

test('Scenario G: Trend section includes full-width panel and summary strip structure', () => {
    assert.match(studentsJsContent, /id="cockpit-trend-section"/, 'Trend section must have id cockpit-trend-section');
    assert.match(studentsJsContent, /Son 5 Deneme Eğilimi/, 'Title must be Son 5 Deneme Eğilimi');
    assert.match(studentsJsContent, /Yalnız genel ve karşılaştırılabilir denemeler/, 'Subtitle must be present');
});

// ============================================================================
// PART 3: CANONICAL TREND MATH & CLASSIFICATION LOGIC
// ============================================================================

test('Scenario H: classifyCockpitTrend threshold logic and properties', async () => {
    const { classifyCockpitTrend } = await import('../student-cockpit-insights.js');

    assert.equal(typeof classifyCockpitTrend, 'function');

    // Null/undefined/invalid safety
    assert.equal(classifyCockpitTrend(null), null);
    assert.equal(classifyCockpitTrend(undefined), null);
    assert.equal(classifyCockpitTrend(NaN), null);

    // Up trend: >= +1.00
    const up = classifyCockpitTrend(1.00);
    assert.equal(up.label, 'Yükseliş');
    assert.equal(up.direction, 'up');
    assert.equal(up.tone, 'positive');
    assert.equal(up.icon, 'fa-arrow-trend-up');
    assert.equal(up.prefix, '+');
    assert.match(up.badgeClass, /emerald/);

    const upLarge = classifyCockpitTrend(6.20);
    assert.equal(upLarge.label, 'Yükseliş');

    // Down trend: <= -1.00
    const down = classifyCockpitTrend(-1.00);
    assert.equal(down.label, 'Düşüş');
    assert.equal(down.direction, 'down');
    assert.equal(down.tone, 'critical');
    assert.equal(down.icon, 'fa-arrow-trend-down');
    assert.equal(down.prefix, '');
    assert.match(down.badgeClass, /rose/);

    const downLarge = classifyCockpitTrend(-6.00);
    assert.equal(downLarge.label, 'Düşüş');

    // Flat trend: between -1.00 and +1.00
    const flatZero = classifyCockpitTrend(0);
    assert.equal(flatZero.label, 'Yatay');
    assert.equal(flatZero.direction, 'flat');
    assert.equal(flatZero.tone, 'neutral');
    assert.equal(flatZero.icon, 'fa-arrow-right');
    assert.match(flatZero.badgeClass, /slate/);

    const flatPositive = classifyCockpitTrend(0.60);
    assert.equal(flatPositive.label, 'Yatay');
    assert.equal(flatPositive.prefix, '+');

    const flatNegative = classifyCockpitTrend(-0.60);
    assert.equal(flatNegative.label, 'Yatay');
    assert.equal(flatNegative.prefix, '');
});

test('Scenario I: getCockpitData trend delta and classification derivation', async () => {
    const { getCockpitData } = await import('../student-cockpit-insights.js');

    // 0 exams
    const data0 = getCockpitData({
        student: { denemeler: [] },
        summary: { latestNet: null },
        analysis: {}
    });
    assert.equal(data0.recentExams.length, 0);
    assert.equal(data0.averageNet, null);
    assert.equal(data0.trendDelta, null);
    assert.equal(data0.trendClassification, null);

    // 1 exam
    const data1 = getCockpitData({
        student: {
            sinif: '8',
            denemeler: [
                { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-09-01', toplamNet: 44.67, denemeAdi: 'Deneme 1' }
            ]
        },
        summary: { latestNet: 44.67 },
        analysis: {}
    });
    assert.equal(data1.recentExams.length, 1);
    assert.equal(data1.averageNet, 44.67);
    assert.equal(data1.trendDelta, null);
    assert.equal(data1.trendClassification, null);

    // 2 exams: 44.67 -> 50.87 (delta = +6.20)
    const data2 = getCockpitData({
        student: {
            sinif: '8',
            denemeler: [
                { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-09-01', toplamNet: 44.67, denemeAdi: 'Deneme 1' },
                { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-09-05', toplamNet: 50.87, denemeAdi: 'Deneme 2' }
            ]
        },
        summary: { latestNet: 50.87 },
        analysis: {}
    });
    assert.equal(data2.recentExams.length, 2);
    assert.equal(data2.averageNet, 47.77);
    assert.equal(data2.trendDelta, 6.2);
    assert.equal(data2.trendClassification.label, 'Yükseliş');

    // 6 exams: Only latest 5 must be used
    const data6 = getCockpitData({
        student: {
            sinif: '8',
            denemeler: [
                { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-01', toplamNet: 30.00, denemeAdi: 'Eski Sınav' },
                { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-10', toplamNet: 41.20, denemeAdi: 'Deneme 1' },
                { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-15', toplamNet: 47.60, denemeAdi: 'Deneme 2' },
                { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-20', toplamNet: 49.80, denemeAdi: 'Deneme 3' },
                { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-25', toplamNet: 58.10, denemeAdi: 'Deneme 4' },
                { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-30', toplamNet: 65.30, denemeAdi: 'Deneme 5' }
            ]
        },
        summary: { latestNet: 65.30 },
        analysis: {}
    });
    assert.equal(data6.recentExams.length, 5, 'Must keep exactly latest 5 exams');
    assert.equal(data6.recentExams[0].denemeAdi, 'Deneme 1', 'First exam in recentExams must be Deneme 1 (not Eski Sınav)');
    assert.equal(data6.recentExams.at(-1).denemeAdi, 'Deneme 5');
    // Avg of [41.2, 47.6, 49.8, 58.1, 65.3] = 262 / 5 = 52.4
    assert.equal(data6.averageNet, 52.4);
    // Delta = 65.30 - 41.20 = 24.10
    assert.equal(data6.trendDelta, 24.1);
    assert.equal(data6.trendClassification.label, 'Yükseliş');
});

// ============================================================================
// PART 4: RUNTIME DOM SIMULATION — COCKPIT OVERVIEW
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
globalThis.window.Chart = null; // Headless safety

const { store, STORAGE_KEY, localDataKey } = await import('../store.js');
const { renderStudentCockpit } = await import('../students.js');

test('Scenario J: 0 comparable exams renders quiet empty state without false chart or summary', async () => {
    const student0 = {
        id: 'std_zero',
        adSoyad: 'Sıfır Denemeli',
        sinif: '8',
        denemeler: [],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student0]));
    store.globalStudents = [student0];

    await renderStudentCockpit('std_zero', 'home', 'overview');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Trend empty state
    assert.match(html, /Henüz karşılaştırılabilir genel deneme sonucu yok\./);
    assert.doesNotMatch(html, /id="cockpitTrendChart"/);
    assert.doesNotMatch(html, /Son 5 Ort\./);
    assert.doesNotMatch(html, /Trend Özet Şeridi/);
    assert.doesNotMatch(html, />Eğilim<\/span>/);

    // 3 Primary KPIs
    assert.match(html, /Son Deneme/);
    assert.match(html, /Ödev Disiplini/);
    assert.match(html, /Hedefe Kalan/);

    // Duplicate panel absent
    assert.doesNotMatch(html, /Öğrenci durum özeti/);
});

test('Scenario K: 1 comparable exam displays latest result badge and minimum 2 message without false trend', async () => {
    const student1 = {
        id: 'std_one',
        adSoyad: 'Tek Denemeli',
        sinif: '8',
        hedefNet: '70',
        denemeler: [
            { id: 'ex_1', tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-09-01', toplamNet: 44.67, denemeAdi: 'Yaz Kursu Denemesi' }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student1]));
    store.globalStudents = [student1];

    await renderStudentCockpit('std_one', 'home', 'overview');
    const html = document.getElementById('dynamic-content').innerHTML;

    // 1-exam specific message & badge
    assert.match(html, /Trend için en az 2 genel deneme sonucu gerekli\./);
    assert.match(html, /Son sonuç:\s*44,67\s*net/);

    // Must NOT have false chart, change, or trend
    assert.doesNotMatch(html, /id="cockpitTrendChart"/);
    assert.doesNotMatch(html, /Değişim/);
    assert.doesNotMatch(html, /↑ Yükseliş/);
    assert.doesNotMatch(html, /→ Yatay/);
    assert.doesNotMatch(html, /↓ Düşüş/);

    // Primary KPIs
    assert.match(html, /44,67 net/);
    assert.match(html, /25,33 net/); // 70 - 44.67 = 25.33
});

test('Scenario L: 2+ comparable exams renders trend summary strip and canvas', async () => {
    const student2 = {
        id: 'std_two',
        adSoyad: 'İki Denemeli',
        sinif: '8',
        hedefNet: '50',
        denemeler: [
            { id: 'ex_1', tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-09-01', toplamNet: 44.67, denemeAdi: 'Deneme 1' },
            { id: 'ex_2', tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-09-05', toplamNet: 50.87, denemeAdi: 'Deneme 2' }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student2]));
    store.globalStudents = [student2];

    await renderStudentCockpit('std_two', 'home', 'overview');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Chart canvas present
    assert.match(html, /id="cockpitTrendChart"/);

    // Trend summary strip
    assert.match(html, /Son 2 Ort\./);
    assert.match(html, /47,77 net/);
    assert.match(html, /Değişim/);
    assert.match(html, /\+6,2 net/);
    assert.match(html, /Yükseliş/);

    // Hedef Durumu KPI (target reached: 50.87 >= 50)
    assert.match(html, /Hedef Durumu/);
    assert.match(html, /\+0,87 net/);
    assert.match(html, /Hedefin üzerinde/);
});

test('Scenario M: Exam action buttons preserved with >=44px min targets', async () => {
    const studentActions = {
        id: 'std_act',
        adSoyad: 'Aksiyon Test',
        sinif: '8',
        denemeler: [
            { id: 'ex_done', tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-09-01', toplamNet: 50, toplamDogru: 55, toplamYanlis: 15, toplamBos: 20, denemeAdi: 'Tamamlanan' },
            { id: 'ex_pending', tip: 'genel', sinif: '8', tarih: '2026-09-05', denemeAdi: 'Bekleyen', toplamSoru: 90, toplamBos: 90, toplamDogru: 0, toplamYanlis: 0 }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentActions]));
    store.globalStudents = [studentActions];

    await renderStudentCockpit('std_act', 'home', 'overview');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Completed actions
    assert.match(html, /viewExam\('std_act',\s*'ex_done'\)/);
    assert.match(html, /Sonucu Gör/);
    assert.match(html, /editExam\('std_act',\s*'ex_done'\)/);
    assert.match(html, /Düzenle/);

    // Pending actions
    assert.match(html, /editExam\('std_act',\s*'ex_pending'\)/);
    assert.match(html, /Sonuç Gir/);
    assert.match(html, /Sonuç Bekliyor/);
});

// ============================================================================
// PART 5: UX-COCKPIT-03.1 COMPARABILITY SPECIFICATION TESTS
// ============================================================================

test('Scenario N (Section 14): Mixed scale exams - 60Q exam excluded, only 90Q exams form trend', async () => {
    const { getCockpitData } = await import('../student-cockpit-insights.js');
    const student = {
        sinif: '8',
        denemeler: [
            { tip: 'genel', sinif: '7', toplamSoru: 60, tarih: '2025-05-15', toplamNet: 35.0, denemeAdi: '7. Sınıf Genel' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-10', toplamNet: 44.0, denemeAdi: 'LGS Prova 1' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-09-01', toplamNet: 50.0, denemeAdi: 'LGS Prova 2' }
        ]
    };
    const data = getCockpitData({ student, summary: { latestNet: 50.0 }, analysis: {} });
    assert.equal(data.recentExams.length, 2, 'Must contain exactly 2 comparable exams');
    assert.equal(data.recentExams[0].denemeAdi, 'LGS Prova 1');
    assert.equal(data.recentExams[1].denemeAdi, 'LGS Prova 2');
    assert.equal(data.averageNet, 47.0, 'Average of 44.0 and 50.0 must be 47.0');
    assert.equal(data.trendDelta, 6.0, 'Change must be +6.0');
    assert.equal(data.trendClassification?.label, 'Yükseliş');
    assert.equal(data.comparabilityKey, 'grade8-general-90');
});

test('Scenario O (Section 15): Exactly 5 exams in same scale - all 5 included in trend', async () => {
    const { getCockpitData } = await import('../student-cockpit-insights.js');
    const student = {
        sinif: '8',
        denemeler: [
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-01', toplamNet: 40.0, denemeAdi: 'D1' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-08', toplamNet: 42.0, denemeAdi: 'D2' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-15', toplamNet: 45.0, denemeAdi: 'D3' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-22', toplamNet: 47.0, denemeAdi: 'D4' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-29', toplamNet: 50.0, denemeAdi: 'D5' }
        ]
    };
    const data = getCockpitData({ student, summary: { latestNet: 50.0 }, analysis: {} });
    assert.equal(data.recentExams.length, 5);
    assert.equal(data.averageNet, 44.8);
    assert.equal(data.trendDelta, 10.0);
    assert.equal(data.trendClassification?.label, 'Yükseliş');
});

test('Scenario P (Section 16): 6+ exams in same scale - only latest 5 included in trend', async () => {
    const { getCockpitData } = await import('../student-cockpit-insights.js');
    const student = {
        sinif: '8',
        denemeler: [
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-07-20', toplamNet: 30.0, denemeAdi: 'Oldest' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-01', toplamNet: 40.0, denemeAdi: 'D1' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-08', toplamNet: 42.0, denemeAdi: 'D2' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-15', toplamNet: 45.0, denemeAdi: 'D3' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-22', toplamNet: 47.0, denemeAdi: 'D4' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-29', toplamNet: 50.0, denemeAdi: 'D5' }
        ]
    };
    const data = getCockpitData({ student, summary: { latestNet: 50.0 }, analysis: {} });
    assert.equal(data.recentExams.length, 5);
    assert.equal(data.recentExams[0].denemeAdi, 'D1');
    assert.equal(data.recentExams.at(-1).denemeAdi, 'D5');
});

test('Scenario Q (Section 17): Unknown or insufficient metadata excluded from trend', async () => {
    const { getCockpitExamComparabilityKey, getCockpitData } = await import('../student-cockpit-insights.js');
    // Missing question count and grade
    const incompleteExam = { tip: 'genel', tarih: '2026-08-01', toplamNet: 45.0 };
    assert.equal(getCockpitExamComparabilityKey(incompleteExam, null), null);

    // Exam with non-standard questions (e.g. 50 questions) and no grade
    const unknownScaleExam = { tip: 'genel', tarih: '2026-08-01', toplamSoru: 50, toplamNet: 45.0 };
    assert.equal(getCockpitExamComparabilityKey(unknownScaleExam, null), null);

    // When latest exam is 90Q LGS, incomplete exam is excluded from trend
    const student = {
        sinif: '8',
        denemeler: [
            incompleteExam,
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-10', toplamNet: 48.0, denemeAdi: 'LGS 1' },
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-20', toplamNet: 52.0, denemeAdi: 'LGS 2' }
        ]
    };
    const data = getCockpitData({ student, summary: { latestNet: 52.0 }, analysis: {} });
    assert.equal(data.recentExams.length, 2);
    assert.doesNotMatch(data.recentExams.map(e => e.denemeAdi).join(','), /incomplete/);
});

test('Scenario R (Section 18): Branch exams never enter general exam trend', async () => {
    const { getCockpitExamComparabilityKey, getCockpitData } = await import('../student-cockpit-insights.js');
    const branchExam = { tip: 'branş', ders: 'Fen Bilimleri', tarih: '2026-08-01', toplamNet: 18.0, toplamSoru: 20 };
    assert.equal(getCockpitExamComparabilityKey(branchExam, null), null);

    const student = {
        sinif: '8',
        denemeler: [
            branchExam,
            { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-10', toplamNet: 48.0, denemeAdi: 'LGS 1' }
        ]
    };
    const data = getCockpitData({ student, summary: { latestNet: 48.0 }, analysis: {} });
    assert.equal(data.recentExams.length, 1);
    assert.equal(data.recentExams[0].denemeAdi, 'LGS 1');
});

test('Scenario S (Section 19): Historical lower grade exams do not blend into current grade trend', async () => {
    const { getCockpitExamComparabilityKey, getCockpitData } = await import('../student-cockpit-insights.js');
    // Student currently 8th grade, but has 7th grade exams from last year
    const grade7Exam = { tip: 'genel', sinif: '7', toplamSoru: 60, tarih: '2025-04-10', toplamNet: 42.0, denemeAdi: '7. Sınıf 1' };
    const grade8Exam1 = { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-08-15', toplamNet: 50.0, denemeAdi: '8. Sınıf 1' };
    const grade8Exam2 = { tip: 'genel', sinif: '8', toplamSoru: 90, tarih: '2026-09-01', toplamNet: 55.0, denemeAdi: '8. Sınıf 2' };

    const student = {
        sinif: '8',
        denemeler: [grade7Exam, grade8Exam1, grade8Exam2]
    };

    assert.equal(getCockpitExamComparabilityKey(grade7Exam, student), 'grade7-general-60');
    assert.equal(getCockpitExamComparabilityKey(grade8Exam1, student), 'grade8-general-90');

    const data = getCockpitData({ student, summary: { latestNet: 55.0 }, analysis: {} });
    assert.equal(data.recentExams.length, 2);
    assert.equal(data.recentExams[0].denemeAdi, '8. Sınıf 1');
    assert.equal(data.recentExams[1].denemeAdi, '8. Sınıf 2');

    // And do NOT assume 8th grade if metadata is missing on a non-90 exam
    const non90WithoutGrade = { tip: 'genel', toplamSoru: 60, tarih: '2025-05-01', toplamNet: 38.0 };
    assert.equal(getCockpitExamComparabilityKey(non90WithoutGrade, student), null);
});
