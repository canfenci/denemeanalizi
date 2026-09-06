import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const guidanceJs = fs.readFileSync(path.join(ROOT, 'guidance.js'), 'utf8');
const storeJs = fs.readFileSync(path.join(ROOT, 'store.js'), 'utf8');

// ============================================================================
// STATIC STRUCTURE AND INTEGRITY TESTS (Checks A through J)
// ============================================================================

test('Check A, B, C (Static): Duplicate outer blocks are removed from studentTab === performance', () => {
    // Extract studentTab === 'performance' block
    const perfBlockMatch = guidanceJs.match(/else\s+if\s*\(studentTab === 'performance'\)\s*\{([\s\S]*?)\}\s*else\s+if\s*\(studentTab === 'interventions'\)/);
    assert.ok(perfBlockMatch, 'studentTab === performance block must exist');
    const perfBlock = perfBlockMatch[1];

    // Verify removed duplicate headers in this block
    assert.doesNotMatch(perfBlock, /Deneme Eğilimi/, 'Deneme Eğilimi outer block must be removed');
    assert.doesNotMatch(perfBlock, /Hata Türleri Dağılımı/, 'Hata Türleri Dağılımı outer block must be removed');
    assert.doesNotMatch(perfBlock, /Tekrarlayan Zayıf Alanlar/, 'Tekrarlayan Zayıf Alanlar outer block must be removed');
    assert.doesNotMatch(perfBlock, /errorReasonsHtml/, 'errorReasonsHtml must not be rendered in outer performance block');
    assert.doesNotMatch(perfBlock, /weakTopicsHtml/, 'weakTopicsHtml must not be rendered in outer performance block');
});

test('Check D & E (Static): "Ödevlerde Zorlanılan Konular" and "Hata Nedenleri Dağılımı" are preserved in homeworkTabHtml', () => {
    assert.match(guidanceJs, /Ödevlerde Zorlanılan Konular/, 'Ödevlerde Zorlanılan Konular must be preserved');
    assert.match(guidanceJs, /Hata Nedenleri Dağılımı/, 'Hata Nedenleri Dağılımı must be preserved');
    assert.match(guidanceJs, /hwInsights\.weakTopics/, 'hwInsights.weakTopics must be preserved in homework view');
    assert.match(guidanceJs, /hwInsights\.errorReasons/, 'hwInsights.errorReasons must be preserved in homework view');
});

test('Check F, G, H (Static): homeworkTabHtml, examsTabHtml, and performanceCenterHtml structures are preserved', () => {
    assert.match(guidanceJs, /const homeworkTabHtml = `[\s\S]*?`;/, 'homeworkTabHtml must be defined');
    assert.match(guidanceJs, /const examsTabHtml = `[\s\S]*?`;/, 'examsTabHtml must be defined');
    assert.match(guidanceJs, /const performanceCenterHtml = `[\s\S]*?`;/, 'performanceCenterHtml must be defined');
    assert.match(guidanceJs, /id="guidance-performance-center"/, 'Performance center element ID must be preserved');
    assert.match(guidanceJs, /switchGuidancePerformanceTab\('\$\{studentId\}',\s*'homework'\)/, 'Homework tab switch button preserved');
    assert.match(guidanceJs, /switchGuidancePerformanceTab\('\$\{studentId\}',\s*'exams'\)/, 'Exams tab switch button preserved');
});

test('Check I (Static): guidance-performance-insights imports are intact', () => {
    assert.match(guidanceJs, /import\s*\{[\s\S]*?buildHomeworkPerformanceInsights[\s\S]*?\}\s*from\s*'\.\/guidance-performance-insights\.js';/);
    assert.match(guidanceJs, /import\s*\{[\s\S]*?buildSchoolExamPerformanceInsights[\s\S]*?\}\s*from\s*'\.\/guidance-performance-insights\.js';/);
    assert.match(guidanceJs, /import\s*\{[\s\S]*?LGS_SUBJECTS[\s\S]*?\}\s*from\s*'\.\/guidance-performance-insights\.js';/);
});

test('Check J (Static): store.js and insight files remain completely untouched', () => {
    const storeDiff = execSync('git diff HEAD -- store.js', { encoding: 'utf8' }).trim();
    assert.equal(storeDiff, '', 'store.js must have 0 diff');

    const studentInsightsDiff = execSync('git diff HEAD -- guidance-student-insights.js', { encoding: 'utf8' }).trim();
    assert.equal(studentInsightsDiff, '', 'guidance-student-insights.js must have 0 diff');

    const perfInsightsDiff = execSync('git diff HEAD -- guidance-performance-insights.js', { encoding: 'utf8' }).trim();
    assert.equal(perfInsightsDiff, '', 'guidance-performance-insights.js must have 0 diff');
});

// ============================================================================
// DYNAMIC RUNTIME / DOM RENDERING TESTS
// ============================================================================

// Setup minimal globals for modules expecting browser environment
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

const { store, STORAGE_KEY, localDataKey } = await import('../store.js');
const { renderGuidanceStudentDetail } = await import('../guidance.js');

const sampleStudent = {
    id: 'std_perf_test',
    adSoyad: 'Barış Can',
    sinif: '8',
    okul: 'Atatürk Ortaokulu',
    denemeler: [
        {
            tip: 'genel',
            denemeAdi: '1. Deneme',
            tarih: '2026-08-10',
            toplamNet: 14.5,
            turkceNet: 17,
            matematikNet: 12,
            fenNet: 15,
            inkilapNet: 9,
            dinNet: 10,
            ingilizceNet: 8
        },
        {
            tip: 'genel',
            denemeAdi: '2. Deneme',
            tarih: '2026-08-20',
            toplamNet: 16.5,
            turkceNet: 18,
            matematikNet: 14,
            fenNet: 16,
            inkilapNet: 10,
            dinNet: 10,
            ingilizceNet: 9
        }
    ],
    odevler: [
        {
            id: 'hw1',
            durum: 'tamamlandi',
            tarih: '2026-08-15',
            dogru: 18,
            yanlis: 2,
            bos: 0,
            net: 17.33,
            yanlisKonular: [
                { unite: 'Basınç', konu: 'Katı Basıncı', adet: 2, hataNedenleri: ['bilgi_eksikligi'] }
            ]
        }
    ],
    studyPlan: {},
    studyPlanProfile: null,
    guidanceRecords: []
};

test('Runtime: Ödev Performansı subtab renders cleanly without duplicate outer blocks', () => {
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([sampleStudent]));
    store.globalStudents = [sampleStudent];
    window._guidanceStudentTab = 'performance';
    window._guidancePerformanceTab = 'homework';

    renderGuidanceStudentDetail('std_perf_test');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Preserved homework items
    assert.ok(html.includes('Ortalama Doğru'), 'KPI Ortalama Doğru must exist');
    assert.ok(html.includes('Ortalama Yanlış'), 'KPI Ortalama Yanlış must exist');
    assert.ok(html.includes('Ortalama Net'), 'KPI Ortalama Net must exist');
    assert.ok(html.includes('Son Ödev Neti'), 'KPI Son Ödev Neti must exist');
    assert.ok(html.includes('Net Değişimi'), 'KPI Net Değişimi must exist');
    assert.ok(html.includes('Tamamlanan Ödev'), 'KPI Tamamlanan Ödev must exist');
    assert.ok(html.includes('Ödev Net Gelişim Trendi'), 'Trend chart header must exist');
    assert.ok(html.includes('Ödevlerde Zorlanılan Konular'), 'Weak topics header must exist');
    assert.ok(html.includes('Hata Nedenleri Dağılımı'), 'Error reasons header must exist');
    assert.ok(html.includes('Katı Basıncı'), 'Sample weak topic must exist');

    // Verify duplicate outer block is NOT present
    assert.doesNotMatch(html, /<h3[^>]*>Deneme Eğilimi<\/h3>/, 'Outer Deneme Eğilimi card must not be rendered');
    assert.doesNotMatch(html, /<h3[^>]*>Tekrarlayan Zayıf Alanlar<\/h3>/, 'Outer Tekrarlayan Zayıf Alanlar card must not be rendered');
    assert.doesNotMatch(html, /<h3[^>]*>Hata Türleri Dağılımı<\/h3>/, 'Outer Hata Türleri Dağılımı card must not be rendered');
});

test('Runtime: Okul Denemeleri subtab renders exam analytics cleanly without duplicate outer blocks', () => {
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([sampleStudent]));
    store.globalStudents = [sampleStudent];
    window._guidanceStudentTab = 'performance';
    window._guidancePerformanceTab = 'exams';

    renderGuidanceStudentDetail('std_perf_test');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Preserved exam items
    assert.ok(html.includes('Son Deneme Neti'), 'KPI Son Deneme Neti must exist');
    assert.ok(html.includes('Ortalama Net'), 'KPI Ortalama Net must exist');
    assert.ok(html.includes('Son Net Farkı'), 'KPI Son Net Farkı must exist');
    assert.ok(html.includes('En Güçlü Ders'), 'KPI En Güçlü Ders must exist');
    assert.ok(html.includes('En Zayıf Ders'), 'KPI En Zayıf Ders must exist');
    assert.ok(html.includes('Okul Denemeleri Toplam Net Trendi'), 'Overall exam trend must exist');
    assert.ok(html.includes('LGS Ders Bazlı Performans Tablosu'), 'LGS subjects table must exist');
    assert.ok(html.includes('Ders Bazlı Net Gelişim Trendi'), 'Subject exam trend must exist');

    // Verify duplicate outer block is NOT present
    assert.doesNotMatch(html, /<h3[^>]*>Deneme Eğilimi<\/h3>/, 'Outer Deneme Eğilimi card must not be rendered');
    assert.doesNotMatch(html, /<h3[^>]*>Tekrarlayan Zayıf Alanlar<\/h3>/, 'Outer Tekrarlayan Zayıf Alanlar card must not be rendered');
    assert.doesNotMatch(html, /<h3[^>]*>Hata Türleri Dağılımı<\/h3>/, 'Outer Hata Türleri Dağılımı card must not be rendered');
});
