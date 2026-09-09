import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const studentsJsContent = fs.readFileSync(path.join(ROOT, 'students.js'), 'utf8');

// ============================================================================
// PART 1: STATIC & ARCHITECTURAL VERIFICATIONS
// ============================================================================

test('Scenario P: Zero git modifications against HEAD for store.js, firebase-config.js, firestore.rules', () => {
    const storeDiff = execSync('git diff HEAD -- store.js', { encoding: 'utf8' }).trim();
    assert.equal(storeDiff, '', 'store.js must have 0 diff against HEAD');

    const fbDiff = execSync('git diff HEAD -- firebase-config.js', { encoding: 'utf8' }).trim();
    assert.equal(fbDiff, '', 'firebase-config.js must have 0 diff against HEAD');

    const rulesDiff = execSync('git diff HEAD -- firestore.rules', { encoding: 'utf8' }).trim();
    assert.equal(rulesDiff, '', 'firestore.rules must have 0 diff against HEAD');
});

test('Scenario A & B (Static): Exactly two sub-tabs under Performans with no extra sub-tabs', () => {
    // Exactly two sub-tab buttons with IDs perf-subtab-homework and perf-subtab-exams
    assert.match(studentsJsContent, /id="perf-subtab-homework"/, 'Must define perf-subtab-homework');
    assert.match(studentsJsContent, /id="perf-subtab-exams"/, 'Must define perf-subtab-exams');

    // No extra/legacy third or fourth sub-tabs
    assert.doesNotMatch(studentsJsContent, /id="perf-subtab-konular"/, 'No separate Konular sub-tab');
    assert.doesNotMatch(studentsJsContent, /id="perf-subtab-hata-analizi"/, 'No separate Hata Analizi sub-tab');
    assert.doesNotMatch(studentsJsContent, /id="perf-subtab-netler"/, 'No separate Netler sub-tab');
    assert.doesNotMatch(studentsJsContent, /id="perf-subtab-brans"/, 'No separate Branş sub-tab under Performans');
});

test('Scenario J (Static): Canonical HATA_KODLARI are used for error codes', () => {
    assert.match(studentsJsContent, /kod:\s*['"]BE['"],\s*aciklama:\s*['"]Bilgi Eksikliği['"]/);
    assert.match(studentsJsContent, /kod:\s*['"]KY['"],\s*aciklama:\s*['"]Kavram Yanılgısı['"]/);
    assert.match(studentsJsContent, /kod:\s*['"]D['"],\s*aciklama:\s*['"]Dikkatsizlik['"]/);
    assert.match(studentsJsContent, /kod:\s*['"]YO['"],\s*aciklama:\s*['"]Yanlış Okuma['"]/);
    assert.match(studentsJsContent, /kod:\s*['"]İH['"],\s*aciklama:\s*['"]İşlem Hatası['"]/);
    assert.match(studentsJsContent, /kod:\s*['"]ZY['"],\s*aciklama:\s*['"]Zaman Yetmedi['"]/);
});

// ============================================================================
// PART 2: RUNTIME SIMULATION & DOM SETUP
// ============================================================================

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
const {
    renderStudentCockpit,
    switchCockpitTab,
    switchCockpitPerfSubTab,
    calculateStudentSchoolExamPerformance,
    calculateStudentHomeworkPerformance
} = await import('../students.js');

// ============================================================================
// PART 3: SCENARIO TESTS (A through O)
// ============================================================================

test('Scenario A & B (Runtime): Cockpit has top tabs (Genel Bakış, Performans) and Performans has exactly 2 sub-tabs', () => {
    const student = {
        id: 'std_tabs_1',
        adSoyad: 'Baran Çelik',
        sinif: '8',
        denemeler: [],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    // 1. Initial overview tab
    renderStudentCockpit('std_tabs_1');
    let html = document.getElementById('dynamic-content').innerHTML;
    assert.ok(html.includes('id="cockpit-tab-overview"'), 'Top overview tab must exist');
    assert.ok(html.includes('id="cockpit-tab-performance"'), 'Top performance tab must exist');

    // 2. Switch to performance tab
    switchCockpitTab('std_tabs_1', 'performance');
    html = document.getElementById('dynamic-content').innerHTML;

    // Must have exactly 2 sub-tabs: Ödevler and Okul Denemeleri
    assert.ok(html.includes('id="perf-subtab-homework"'), 'Sub-tab Ödevler must exist');
    assert.ok(html.includes('id="perf-subtab-exams"'), 'Sub-tab Okul Denemeleri must exist');
    assert.ok(html.includes('Ödevler'), 'Label Ödevler must be visible');
    assert.ok(html.includes('Okul Denemeleri'), 'Label Okul Denemeleri must be visible');

    // Must not have extra subtabs
    assert.ok(!html.includes('id="perf-subtab-konular"'), 'Must not have separate Konular sub-tab');
    assert.ok(!html.includes('id="perf-subtab-hata"'), 'Must not have separate Hata sub-tab');
});

test('Scenario C: Ödevler sub-tab renders existing homework performance insights', () => {
    const student = {
        id: 'std_hw_1',
        adSoyad: 'Defne Kaya',
        sinif: '8',
        denemeler: [],
        odevler: [
            {
                id: 'hw_1',
                durum: 'tamamlandi',
                tarih: '2026-09-01',
                bitisTarihi: '2026-09-05',
                unite: 'Mevsimler ve İklim',
                konu: 'Mevsimlerin Oluşumu',
                dogru: 18,
                yanlis: 2,
                toplamSoru: 20,
                yanlisAnalizi: [{ unite: 'Mevsimler ve İklim', konu: 'Mevsimlerin Oluşumu', adet: 2, hataNedenleriKeys: ['dikkatsizlik'] }]
            },
            {
                id: 'hw_2',
                durum: 'yapilmadi',
                tarih: '2026-09-06',
                bitisTarihi: '2026-09-08',
                unite: 'DNA ve Genetik Kod',
                konu: 'DNA',
                toplamSoru: 15
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_hw_1', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Verilen Ödev'), 'Must show Verilen Ödev KPI');
    assert.ok(html.includes('Tamamlanan'), 'Must show Tamamlanan KPI');
    assert.ok(html.includes('Eksik / Yapılmayan'), 'Must show Eksik KPI');
    assert.ok(html.includes('Mevsimler ve İklim'), 'Must show topic weakness');
    assert.ok(html.includes('Ödevlerde Zorlanılan Konular'), 'Must show weak topics card');
});

test('Scenario D: Okul Denemeleri sub-tab renders exam list with #cockpit-exams-section', () => {
    const student = {
        id: 'std_exams_list',
        adSoyad: 'Can Demir',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_c1',
                denemeAdi: 'LGS Prova 1',
                tip: 'genel',
                tarih: '2026-09-01',
                toplamSoru: 90,
                toplamDogru: 75,
                toplamYanlis: 9,
                toplamBos: 6,
                toplamNet: 72.0,
                sorular: []
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_exams_list', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('id="cockpit-exams-section"'), 'Must render #cockpit-exams-section inside Okul Denemeleri');
    assert.ok(html.includes('LGS Prova 1'), 'Must render exam title');
    assert.ok(html.includes('72 Net') || html.includes('72.00 Net'), 'Must render exam net');
});

test('Scenario E, F, G: General exam total net, runtime average net, and highest net are correct', () => {
    const student = {
        id: 'std_stat_calc',
        sinif: '8',
        denemeler: [
            { id: 'e1', tip: 'genel', tarih: '2026-08-10', toplamNet: 60.0 },
            { id: 'e2', tip: 'genel', tarih: '2026-08-20', toplamNet: 80.0 },
            { id: 'e3', tip: 'genel', tarih: '2026-08-30', toplamNet: 70.0 }
        ]
    };

    const perf = calculateStudentSchoolExamPerformance(student);

    // E: latestNet
    assert.equal(perf.genelSummary.latestNet, 70.0, 'Latest general exam net should be 70');
    // F: averageNet: (60 + 80 + 70) / 3 = 70.0
    assert.equal(perf.genelSummary.averageNet, 70.0, 'Average net should be 70.0');
    // G: maxNet: max(60, 80, 70) = 80.0
    assert.equal(perf.genelSummary.maxNet, 80.0, 'Highest net should be 80.0');
});

test('Scenario H & I: Topic analysis is computed from wrong + blank, and sorted descending', () => {
    const student = {
        id: 'std_topic_calc',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_t1',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-09-01',
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'D' },
                    { soruNo: 2, durum: 'bos', konuAdi: 'Basınç', hataKodu: 'ZY' },
                    { soruNo: 3, durum: 'yanlis', konuAdi: 'Mevsimler', hataKodu: 'BE' },
                    { soruNo: 4, durum: 'dogru', konuAdi: 'DNA', hataKodu: null }
                ]
            },
            {
                id: 'ex_t2',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-09-05',
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'BE' },
                    { soruNo: 2, durum: 'dogru', konuAdi: 'Mevsimler', hataKodu: null }
                ]
            }
        ]
    };

    const perf = calculateStudentSchoolExamPerformance(student);

    // Basınç: 2 wrong + 1 blank = 3 errors across 2 exams
    // Mevsimler: 1 wrong + 0 blank = 1 error across 1 exam
    // DNA: 0 errors
    assert.equal(perf.weakTopics.length, 2, 'Should identify 2 topics with errors');
    // I: En çok hata yapılan konu üstte sıralanır
    assert.equal(perf.weakTopics[0].topic, 'Basınç', 'Highest error topic must be first');
    assert.equal(perf.weakTopics[0].wrong, 2);
    assert.equal(perf.weakTopics[0].blank, 1);
    assert.equal(perf.weakTopics[0].total, 3);
    assert.equal(perf.weakTopics[0].examCount, 2);

    assert.equal(perf.weakTopics[1].topic, 'Mevsimler');
    assert.equal(perf.weakTopics[1].total, 1);
});

test('Scenario J: hataKodu distribution calculates counts and percentages with canonical codes', () => {
    const student = {
        id: 'std_err_codes',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_code_1',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-09-02',
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'BE' },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'BE' },
                    { soruNo: 3, durum: 'bos', konuAdi: 'Basınç', hataKodu: 'KY' },
                    { soruNo: 4, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'D' }
                ]
            }
        ]
    };

    const perf = calculateStudentSchoolExamPerformance(student);

    // Total analyzed = 4 (2 BE, 1 KY, 1 D)
    assert.equal(perf.analyzedCount, 4);
    assert.equal(perf.unassignedCount, 0);

    const be = perf.errorReasons.find(r => r.code === 'BE');
    assert.equal(be.count, 2);
    assert.equal(be.percentage, 50); // 2/4 = 50%

    const ky = perf.errorReasons.find(r => r.code === 'KY');
    assert.equal(ky.count, 1);
    assert.equal(ky.percentage, 25); // 1/4 = 25%

    const d = perf.errorReasons.find(r => r.code === 'D');
    assert.equal(d.count, 1);
    assert.equal(d.percentage, 25); // 1/4 = 25%
});

test('Scenario K: Null or missing hataKodu is tracked and displayed as eksik analiz', () => {
    const student = {
        id: 'std_unassigned',
        adSoyad: 'Emir Koç',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_unassigned_1',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-08-20',
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Mevsimler', hataKodu: null },
                    { soruNo: 2, durum: 'bos', konuAdi: 'Mevsimler', hataKodu: null },
                    { soruNo: 3, durum: 'yanlis', konuAdi: 'Basınç', hataKodu: 'BE' }
                ]
            }
        ],
        odevler: []
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.unassignedCount, 2, 'Should detect 2 unassigned error reasons');
    assert.equal(perf.analyzedCount, 1, 'Should detect 1 analyzed error reason');

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_unassigned', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('2 soru için hata nedeni girilmemiş'), 'Must display unassigned error count in alert banner');
    assert.ok(html.includes('Eksik Hata Analizi'), 'Must show missing analysis title');
});

test('Scenario L: Science branch exam data is included in topic and error analyses', () => {
    const student = {
        id: 'std_brans_inc',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_brans_inc',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-09-01',
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Katı Basıncı', hataKodu: 'İH' }
                ]
            }
        ]
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    const hasTopic = perf.weakTopics.some(t => t.topic === 'Katı Basıncı');
    assert.ok(hasTopic, 'Science branch exam topic must be included');
    const ih = perf.errorReasons.find(r => r.code === 'İH');
    assert.equal(ih.count, 1, 'Science branch exam error code must be included');
});

test('Scenario M: Science questions from general LGS exam are included in topic and error analyses', () => {
    const student = {
        id: 'std_genel_inc',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_genel_inc',
                tip: 'genel',
                tarih: '2026-09-03',
                dersBilgileri: [
                    { ders: 'Türkçe', adet: 20 },
                    { ders: 'Matematik', adet: 20 },
                    { ders: 'Fen Bilimleri', adet: 20 }
                ],
                // 40 non-science questions, then 20 science questions (index 40..59)
                sorular: [
                    ...Array.from({ length: 40 }, (_, i) => ({ soruNo: i + 1, durum: 'dogru', konuAdi: 'Diğer Ders' })),
                    { soruNo: 41, durum: 'yanlis', konuAdi: 'Genel Fen DNA', hataKodu: 'YO' },
                    ...Array.from({ length: 19 }, (_, i) => ({ soruNo: i + 42, durum: 'dogru', konuAdi: 'Genel Fen' }))
                ]
            }
        ]
    };

    const perf = calculateStudentSchoolExamPerformance(student);
    const hasTopic = perf.weakTopics.some(t => t.topic === 'Genel Fen DNA');
    assert.ok(hasTopic, 'General exam Science question must be included in weak topics');
    const yo = perf.errorReasons.find(r => r.code === 'YO');
    assert.equal(yo.count, 1, 'General exam Science error code must be included');
});

test('Scenario N: General and branch nets are not blended into a single composite series', () => {
    const student = {
        id: 'std_separate_nets',
        sinif: '8',
        denemeler: [
            // 90-question general exam with 75 net
            { id: 'ex_g', tip: 'genel', tarih: '2026-09-01', toplamNet: 75.0 },
            // 20-question branch exam with 17 net
            { id: 'ex_b', tip: 'branş', ders: 'Fen Bilimleri', tarih: '2026-09-02', toplamNet: 17.0 }
        ]
    };

    const perf = calculateStudentSchoolExamPerformance(student);

    // General summary must not be corrupted by the 17 net branch exam
    assert.equal(perf.genelSummary.latestNet, 75.0);
    assert.equal(perf.genelSummary.averageNet, 75.0);
    assert.equal(perf.genelSummary.maxNet, 75.0);

    // Branch summary must isolate the 17 net branch exam
    assert.equal(perf.bransSummary.latestNet, 17.0);
    assert.equal(perf.bransSummary.averageNet, 17.0);
    assert.equal(perf.bransSummary.maxNet, 17.0);
});

test('Scenario O: Sonuç Gir, Sonucu Gör, and Düzenle CTAs remain functional without regression', () => {
    const student = {
        id: 'std_cta_check',
        adSoyad: 'Elif Şen',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_p',
                denemeAdi: 'Atanmış Deneme',
                tip: 'genel',
                tarih: '2026-09-05',
                toplamSoru: 90,
                toplamDogru: 0,
                toplamYanlis: 0,
                toplamBos: 90,
                toplamNet: 0,
                sorular: Array.from({ length: 90 }, (_, i) => ({ soruNo: i + 1, durum: 'bos' }))
            },
            {
                id: 'ex_d',
                denemeAdi: 'Bitmiş Deneme',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                tarih: '2026-08-25',
                toplamSoru: 20,
                toplamDogru: 18,
                toplamYanlis: 2,
                toplamBos: 0,
                toplamNet: 17.33,
                sorular: []
            }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_cta_check', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Pending exam CTA
    assert.ok(html.includes("editExam('std_cta_check', 'ex_p')"), 'Pending exam must have editExam CTA');
    assert.ok(html.includes('Sonuç Gir'), 'Pending exam button text must be Sonuç Gir');

    // Completed exam CTAs
    assert.ok(html.includes("viewExam('std_cta_check', 'ex_d')"), 'Completed exam must have viewExam CTA');
    assert.ok(html.includes('Sonucu Gör'), 'Completed exam button text must be Sonucu Gör');
    assert.ok(html.includes("editExam('std_cta_check', 'ex_d')"), 'Completed exam must have editExam (Düzenle) CTA');
    assert.ok(html.includes('Düzenle'), 'Completed exam button text must be Düzenle');
});

// ============================================================================
// PART 3: PERFORMANCE CHARTS & INSIGHTS (UX-COCKPIT-02)
// ============================================================================

test('Scenario Q: Ödevler - 0 completed homeworks shows empty state without chart canvas', () => {
    const student = {
        id: 'std_hw_0',
        adSoyad: 'Sıfır Ödevli',
        sinif: '8',
        denemeler: [],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_hw_0', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Ödev gelişimini göstermek için en az 2 tamamlanmış ödev gerekli.'));
    assert.ok(!html.includes('id="cockpitHomeworkPerfChart"'), 'Should not render canvas when < 2 homeworks');
});

test('Scenario R: Ödevler - 1 completed homework shows empty state without false trend', () => {
    const student = {
        id: 'std_hw_1',
        adSoyad: 'Tek Ödevli',
        sinif: '8',
        denemeler: [],
        odevler: [
            { id: 'hw_1', konu: 'Hücre Bölünmesi', durum: 'tamamlandi', bitisTarihi: '2026-09-01', dogru: 18, yanlis: 2, net: 16 }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_hw_1', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Ödev gelişimini göstermek için en az 2 tamamlanmış ödev gerekli.'));
    assert.ok(!html.includes('id="cockpitHomeworkPerfChart"'), 'Should not render canvas when 1 homework');
});

test('Scenario S: Ödevler - 3+ completed homeworks renders trend series, badges, and canvas', () => {
    const student = {
        id: 'std_hw_multi',
        adSoyad: 'Çok Ödevli',
        sinif: '8',
        denemeler: [],
        odevler: [
            { id: 'hw_1', konu: 'Mevsimler', durum: 'tamamlandi', bitisTarihi: '2026-09-01', dogru: 10, yanlis: 5, net: 8.33 },
            { id: 'hw_2', konu: 'DNA ve Genetik Kod', durum: 'tamamlandi', bitisTarihi: '2026-09-03', dogru: 15, yanlis: 3, net: 14.0 },
            { id: 'hw_3', konu: 'Basınç', durum: 'tamamlandi', bitisTarihi: '2026-09-05', dogru: 18, yanlis: 2, net: 17.33 }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_hw_multi', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('id="cockpitHomeworkPerfChart"'), 'Should render canvas when >= 2 homeworks');
    assert.ok(html.includes('Ödev Performansı'), 'Should have Ödev Performansı card title');
    assert.ok(html.includes('Yükseliş'), 'Should show Yükseliş trend badge for improving success percent');
    assert.ok(html.includes('Son Başarı: %'), 'Should show latest success percent badge');
    assert.ok(html.includes('Ortalama Başarı: %'), 'Should show average success percent badge');
    assert.ok(html.includes('En Yüksek Başarı: %'), 'Should show max success percent badge');
    assert.ok(!html.includes('undefined'), 'Must never render undefined in HTML');
    assert.ok(!html.includes('NaN'), 'Must never render NaN in HTML');
    assert.ok(!html.includes('— net'), 'Must not render — net placeholder');
});

test('Scenario T: Ödevler - Hata Nedenleri distribution renders bars with counts and percentages', () => {
    const student = {
        id: 'std_hw_errs',
        adSoyad: 'Hatalı Ödevli',
        sinif: '8',
        denemeler: [],
        odevler: [
            {
                id: 'hw_err_1',
                konu: 'Mevsimler',
                durum: 'tamamlandi',
                dogru: 16,
                yanlis: 4,
                net: 14.67,
                yanlisAnalizi: [
                    { unite: 'Mevsimler', konu: 'Mevsimler', adet: 2, hataNedeni: 'Dikkatsizlik' },
                    { unite: 'Mevsimler', konu: 'Mevsimler', adet: 1, hataNedeni: 'Bilgi Eksikliği' },
                    { unite: 'Mevsimler', konu: 'Mevsimler', adet: 1, hataNedeni: 'Yanlış Okuma' }
                ]
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_hw_errs', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Hata Nedenleri Dağılımı'));
    assert.ok(html.includes('Dikkatsizlik'));
    assert.ok(html.includes('2 soru (%50)'));
    assert.ok(html.includes('Bilgi Eksikliği'));
    assert.ok(html.includes('1 soru (%25)'));
    assert.ok(html.includes('Yanlış Okuma'));
    assert.ok(html.includes('1 soru (%25)'));
});

test('Scenario U: Ödevler - Hata Nedenleri empty state renders exact required message', () => {
    const student = {
        id: 'std_hw_no_errs',
        adSoyad: 'Kusursuz Öğrenci',
        sinif: '8',
        denemeler: [],
        odevler: [
            { id: 'hw_clean', konu: 'Basınç', durum: 'tamamlandi', dogru: 20, yanlis: 0, net: 20 }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_hw_no_errs', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Hata analizi yapılmış kayıt bulunmuyor.'));
});

test('Scenario V: Okul Denemeleri - 0 exams shows empty state without chart canvas', () => {
    const student = {
        id: 'std_exam_0',
        adSoyad: 'Denemesiz Öğrenci',
        sinif: '8',
        denemeler: [],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_exam_0', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Net gelişimini göstermek için en az 2 deneme gerekli.'));
    assert.ok(!html.includes('id="cockpitGenelExamChart"'), 'Should not render canvas when < 2 exams');
});

test('Scenario W: Okul Denemeleri - 1 completed general exam shows empty state without false trend', () => {
    const student = {
        id: 'std_exam_1',
        adSoyad: 'Tek Denemeli',
        sinif: '8',
        denemeler: [
            { id: 'ex_1', tip: 'genel', denemeAdi: 'Deneme 1', tarih: '2026-09-01', toplamNet: 70.0 }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_exam_1', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('Net gelişimini göstermek için en az 2 deneme gerekli.'));
    assert.ok(!html.includes('id="cockpitGenelExamChart"'), 'Should not render canvas when 1 exam');

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.trend, null, 'Trend should be null for 1 exam');
});

test('Scenario X: Okul Denemeleri - 3+ completed general exams renders chronological chart canvas and trend', () => {
    const student = {
        id: 'std_exam_multi',
        adSoyad: 'Çok Denemeli',
        sinif: '8',
        denemeler: [
            { id: 'ex_1', tip: 'genel', denemeAdi: 'Deneme 1', tarih: '2026-09-01', toplamNet: 60.0 },
            { id: 'ex_2', tip: 'genel', denemeAdi: 'Deneme 2', tarih: '2026-09-03', toplamNet: 68.0 },
            { id: 'ex_3', tip: 'genel', denemeAdi: 'Deneme 3', tarih: '2026-09-05', toplamNet: 75.0 }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_exam_multi', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('id="cockpitGenelExamChart"'), 'Should render canvas when >= 2 general exams');
    assert.ok(html.includes('Net Gelişimi'), 'Should have Net Gelişimi section');
    assert.ok(html.includes('Yükseliş'), 'Should display Yükseliş trend badge (60.0 -> 75.0)');

    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelChronological.length, 3);
    assert.equal(perf.genelChronological[0].toplamNet, 60.0);
    assert.equal(perf.genelChronological[2].toplamNet, 75.0);
    assert.equal(perf.genelSummary.trend, 'improving');
    assert.equal(perf.genelSummary.trendLabel, 'Yükseliş');
    assert.equal(perf.genelSummary.chronologicalDelta, 15.0);
});

test('Scenario Y: Okul Denemeleri - Branch exams render in separate block without bleeding into general nets', () => {
    const student = {
        id: 'std_exam_brans_sep',
        adSoyad: 'Ayrık Denemeli',
        sinif: '8',
        denemeler: [
            { id: 'ex_g1', tip: 'genel', denemeAdi: 'Genel 1', tarih: '2026-09-01', toplamNet: 80.0 },
            { id: 'ex_g2', tip: 'genel', denemeAdi: 'Genel 2', tarih: '2026-09-04', toplamNet: 82.0 },
            { id: 'ex_b1', tip: 'branş', ders: 'Fen Bilimleri', denemeAdi: 'Fen Branş 1', tarih: '2026-09-02', toplamNet: 18.0 },
            { id: 'ex_b2', tip: 'branş', ders: 'Fen Bilimleri', denemeAdi: 'Fen Branş 2', tarih: '2026-09-05', toplamNet: 19.0 }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_exam_brans_sep', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    // Both canvases must exist separately
    assert.ok(html.includes('id="cockpitGenelExamChart"'), 'Should render general exam canvas');
    assert.ok(html.includes('id="cockpitBransExamChart"'), 'Should render branch exam canvas');
    assert.ok(html.includes('Fen Bilimleri Branş Denemeleri'), 'Should render branch exam panel');
    assert.ok(html.includes('Fen Branş Net Gelişimi'), 'Should render branch exam chart section');

    // Summaries strictly separated
    const perf = calculateStudentSchoolExamPerformance(student);
    assert.equal(perf.genelSummary.completedCount, 2);
    assert.equal(perf.genelSummary.latestNet, 82.0);
    assert.equal(perf.genelSummary.averageNet, 81.0);
    assert.equal(perf.bransSummary.completedCount, 2);
    assert.equal(perf.bransSummary.latestNet, 19.0);
    assert.equal(perf.bransSummary.averageNet, 18.5);
});

test('Scenario Z: Okul Denemeleri - When 0 branch exams exist, branch section is omitted', () => {
    const student = {
        id: 'std_exam_no_brans',
        adSoyad: 'Yalnız Genel',
        sinif: '8',
        denemeler: [
            { id: 'ex_g1', tip: 'genel', denemeAdi: 'Genel 1', tarih: '2026-09-01', toplamNet: 75.0 },
            { id: 'ex_g2', tip: 'genel', denemeAdi: 'Genel 2', tarih: '2026-09-03', toplamNet: 78.0 }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_exam_no_brans', 'home', 'performance', 'exams');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(!html.includes('Fen Bilimleri Branş Denemeleri'), 'Branch panel must NOT render when 0 branch exams');
    assert.ok(!html.includes('cockpitBransExamChart'), 'Branch chart canvas must NOT render when 0 branch exams');
});

test('Scenario AA: Okul Denemeleri - Branch exam trend calculation and 1-exam empty state', () => {
    const studentSingle = {
        id: 'std_brans_single',
        adSoyad: 'Tek Branş',
        sinif: '8',
        denemeler: [
            { id: 'ex_b1', tip: 'branş', ders: 'Fen Bilimleri', denemeAdi: 'Fen 1', tarih: '2026-09-01', toplamNet: 17.0 }
        ],
        odevler: []
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentSingle]));
    store.globalStudents = [studentSingle];

    renderStudentCockpit('std_brans_single', 'home', 'performance', 'exams');
    const htmlSingle = document.getElementById('dynamic-content').innerHTML;
    assert.ok(htmlSingle.includes('Fen branş gelişimini göstermek için en az 2 branş denemesi gerekli.'));
    assert.ok(!htmlSingle.includes('id="cockpitBransExamChart"'));

    const perfSingle = calculateStudentSchoolExamPerformance(studentSingle);
    assert.equal(perfSingle.bransSummary.trend, null);

    // Multi branch exam
    const studentMulti = {
        id: 'std_brans_multi',
        adSoyad: 'Çok Branş',
        sinif: '8',
        denemeler: [
            { id: 'ex_b1', tip: 'branş', ders: 'Fen Bilimleri', denemeAdi: 'Fen 1', tarih: '2026-09-01', toplamNet: 14.0 },
            { id: 'ex_b2', tip: 'branş', ders: 'Fen Bilimleri', denemeAdi: 'Fen 2', tarih: '2026-09-05', toplamNet: 18.0 }
        ],
        odevler: []
    };
    const perfMulti = calculateStudentSchoolExamPerformance(studentMulti);
    assert.equal(perfMulti.bransSummary.trend, 'improving');
    assert.equal(perfMulti.bransSummary.trendLabel, 'Yükseliş');
    assert.equal(perfMulti.bransSummary.chronologicalDelta, 4.0);
});

test('Scenario AB: Headless safety - renderStudentCockpit never crashes when window.Chart is undefined', () => {
    const student = {
        id: 'std_headless_safe',
        adSoyad: 'Headless Güvenli',
        sinif: '8',
        denemeler: [
            { id: 'ex_g1', tip: 'genel', denemeAdi: 'Genel 1', tarih: '2026-09-01', toplamNet: 70.0 },
            { id: 'ex_g2', tip: 'genel', denemeAdi: 'Genel 2', tarih: '2026-09-03', toplamNet: 75.0 }
        ],
        odevler: [
            { id: 'hw_1', konu: 'Mevsimler', durum: 'tamamlandi', bitisTarihi: '2026-09-01', dogru: 15, yanlis: 5, net: 13.33 },
            { id: 'hw_2', konu: 'Basınç', durum: 'tamamlandi', bitisTarihi: '2026-09-03', dogru: 18, yanlis: 2, net: 17.33 }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    // Ensure window.Chart is undefined
    const origChart = globalThis.window.Chart;
    delete globalThis.window.Chart;

    assert.doesNotThrow(() => {
        renderStudentCockpit('std_headless_safe', 'home', 'overview');
        renderStudentCockpit('std_headless_safe', 'home', 'performance', 'homework');
        renderStudentCockpit('std_headless_safe', 'home', 'performance', 'exams');
    }, 'renderStudentCockpit must safely execute without window.Chart');

    if (origChart) globalThis.window.Chart = origChart;
});

// ============================================================================
// PART 4: HOMEWORK SUCCESS PERCENTAGE & MAX VALUE FIXES (UX-COCKPIT-02.1)
// ============================================================================

test('Scenario AC: Homework metric calculation - net = dogru - yanlis/3, successPercent = (net/toplamSoru)*100', () => {
    const student = {
        id: 'std_metric_calc',
        odevler: [
            { id: 'hw_10q', durum: 'tamamlandi', bitisTarihi: '2026-09-01', dogru: 9, yanlis: 0, toplamSoru: 10 },
            { id: 'hw_30q', durum: 'tamamlandi', bitisTarihi: '2026-09-02', dogru: 21, yanlis: 3, toplamSoru: 30 }
        ]
    };

    const perf = calculateStudentHomeworkPerformance(student);
    assert.equal(perf.completedCount, 2);

    // HW1: 9D 0Y / 10q -> net = 9.0, success = 90.0%
    const item1 = perf.chronological[0];
    assert.equal(item1.net, 9.0);
    assert.equal(item1.totalQuestions, 10);
    assert.equal(item1.successPercent, 90.0);

    // HW2: 21D 3Y / 30q -> net = 21 - 1 = 20.0, success = (20/30)*100 = 66.7%
    const item2 = perf.chronological[1];
    assert.equal(item2.net, 20.0);
    assert.equal(item2.totalQuestions, 30);
    assert.equal(item2.successPercent, 66.7);
});

test('Scenario AD: Variable question count trend normalization - raw net increase with percent drop evaluates to declining', () => {
    const student = {
        id: 'std_trend_norm',
        odevler: [
            { id: 'hw_1', durum: 'tamamlandi', bitisTarihi: '2026-09-01', dogru: 9, yanlis: 0, toplamSoru: 10 }, // 90.0%
            { id: 'hw_2', durum: 'tamamlandi', bitisTarihi: '2026-09-05', dogru: 21, yanlis: 3, toplamSoru: 30 } // 66.7%
        ]
    };

    const perf = calculateStudentHomeworkPerformance(student);
    // Raw net: 9.0 -> 20.0 (an increase of +11.0 net)
    assert.ok(perf.chronological[1].net > perf.chronological[0].net, 'Raw net actually increased');

    // Success %: 90.0% -> 66.7% (a drop of -23.3%)
    assert.equal(perf.deltaPercent, -23.3);
    assert.equal(perf.trend, 'declining', 'Trend MUST evaluate to declining based on normalized %');
    assert.equal(perf.trendLabel, 'Düşüş', 'Trend label must be Düşüş');
});

test('Scenario AE: Max value calculation - maxSuccessPercent is exact without undefined/NaN', () => {
    const student = {
        id: 'std_max_val',
        odevler: [
            { id: 'hw_1', durum: 'tamamlandi', bitisTarihi: '2026-09-01', dogru: 5, yanlis: 0, toplamSoru: 10 },   // 50.0%
            { id: 'hw_2', durum: 'tamamlandi', bitisTarihi: '2026-09-03', dogru: 19, yanlis: 0, toplamSoru: 20 },  // 95.0%
            { id: 'hw_3', durum: 'tamamlandi', bitisTarihi: '2026-09-05', dogru: 16, yanlis: 0, toplamSoru: 20 }   // 80.0%
        ]
    };

    const perf = calculateStudentHomeworkPerformance(student);
    assert.equal(perf.maxSuccessPercent, 95.0, 'Max success percentage must be 95.0');
    assert.notEqual(perf.maxSuccessPercent, undefined);
    assert.notEqual(perf.maxSuccessPercent, null);
    assert.ok(!Number.isNaN(perf.maxSuccessPercent));

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    renderStudentCockpit('std_max_val', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;

    assert.ok(html.includes('En Yüksek Başarı: %95'), 'Must render En Yüksek Başarı: %95');
    assert.ok(!html.includes('— net'), 'Must not render — net placeholder');
    assert.ok(!html.includes('undefined'), 'Must not render undefined');
    assert.ok(!html.includes('NaN'), 'Must not render NaN');
});

test('Scenario AF: Safe empty states - 0 records and 1 record trend safety', () => {
    const studentZero = { id: 'std_zero', odevler: [] };
    const perfZero = calculateStudentHomeworkPerformance(studentZero);
    assert.equal(perfZero.completedCount, 0);
    assert.equal(perfZero.trend, null);
    assert.equal(perfZero.maxSuccessPercent, null);
    assert.equal(perfZero.averageSuccessPercent, null);
    assert.equal(perfZero.latestSuccessPercent, null);

    const studentSingle = {
        id: 'std_single',
        odevler: [
            { id: 'hw_1', durum: 'tamamlandi', bitisTarihi: '2026-09-01', dogru: 17, yanlis: 3, toplamSoru: 20 }
        ]
    };
    const perfSingle = calculateStudentHomeworkPerformance(studentSingle);
    assert.equal(perfSingle.completedCount, 1);
    assert.equal(perfSingle.latestSuccessPercent, 80.0);
    assert.equal(perfSingle.maxSuccessPercent, 80.0);
    assert.equal(perfSingle.trend, null, 'Trend must be null when only 1 homework');
    assert.equal(perfSingle.trendLabel, 'Trend için yeterli ödev yok');

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentSingle]));
    store.globalStudents = [studentSingle];

    renderStudentCockpit('std_single', 'home', 'performance', 'homework');
    const html = document.getElementById('dynamic-content').innerHTML;
    assert.ok(html.includes('Ödev gelişimini göstermek için en az 2 tamamlanmış ödev gerekli.'));
    assert.ok(!html.includes('Yükseliş'), 'Must not claim Yükseliş with 1 record');
    assert.ok(!html.includes('Düşüş'), 'Must not claim Düşüş with 1 record');
});

test('Scenario AG: Preservation of raw net in data structure and secondary display', () => {
    const student = {
        id: 'std_raw_net',
        odevler: [
            { id: 'hw_1', durum: 'tamamlandi', bitisTarihi: '2026-09-01', dogru: 15, yanlis: 3, toplamSoru: 20 }
        ]
    };

    const perf = calculateStudentHomeworkPerformance(student);
    const item = perf.chronological[0];
    assert.equal(item.net, 14.0, 'Raw net must be 14.0');
    assert.equal(item.correct, 15);
    assert.equal(item.wrong, 3);
    assert.equal(item.totalQuestions, 20);
    assert.equal(perf.latestNet, 14.0);
    assert.equal(perf.averageNet, 14.0);
});
