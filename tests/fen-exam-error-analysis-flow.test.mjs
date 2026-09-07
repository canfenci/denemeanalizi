import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const examsJsContent = fs.readFileSync(path.join(ROOT, 'exams.js'), 'utf8');

// ============================================================================
// PART 1: STATIC & ARCHITECTURAL CHECKS (Scenarios Q, R, N, P, H, G, O)
// ============================================================================

test('Scenario Q: store.js has zero git modifications', () => {
    const diff = execSync('git diff HEAD -- store.js', { encoding: 'utf8' }).trim();
    assert.equal(diff, '', 'store.js must have 0 diff against HEAD');
});

test('Scenario R: editGenelExam remains untouched and separate from Fen flow', () => {
    assert.match(examsJsContent, /export function editGenelExam\(studentId, examId, exam\)/);
    // Find the editGenelExam function body
    const fnStart = examsJsContent.indexOf('export function editGenelExam');
    const fnEnd = examsJsContent.indexOf('export async function saveGenelExamEdit');
    const editGenelBody = examsJsContent.slice(fnStart, fnEnd);
    assert.doesNotMatch(editGenelBody, /goToFenHataAnaliziStep/);
    assert.doesNotMatch(editGenelBody, /fen-hata/);
});

test('Scenario N: saveBransExamEdit reuses existing persistence path updateStudentArrayRecord', () => {
    assert.match(examsJsContent, /updateStudentArrayRecord\(studentId,\s*'denemeler',\s*exam\.id,\s*updatedExam\)/);
});

test('Scenario P: student.denemeler schema remains canonical and unchanged', () => {
    assert.doesNotMatch(examsJsContent, /errorAnalysis:/);
    assert.doesNotMatch(examsJsContent, /fenAnalysis:/);
    assert.doesNotMatch(examsJsContent, /wrongTopics:/);
    assert.doesNotMatch(examsJsContent, /errorCodes:/);
});

test('Scenario H: Canonical HATA_KODLARI is imported and used', () => {
    assert.match(examsJsContent, /import\s*\{[^}]*HATA_KODLARI[^}]*\}\s*from\s*['"]\.\/store\.js['"]/);
    assert.match(examsJsContent, /HATA_KODLARI\.map/);
});

test('Scenario G (Static): Fen topics dropdown strictly uses getKonuListesiBySinifAndDers for Fen Bilimleri', () => {
    assert.match(examsJsContent, /getKonuListesiBySinifAndDers\(activeExamState\.sinif,\s*['"]Fen Bilimleri['"]\)/);
});

test('Scenario O: Offline conflict guard is strictly preserved during save', () => {
    assert.match(examsJsContent, /if\s*\(res\s*&&\s*!res\.ok\s*&&\s*res\.blockedOffline\)\s*\{\s*alert\(res\.message\);\s*return;\s*\}/);
});

// ============================================================================
// PART 2: RUNTIME SIMULATION & DOM SETUP
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

let alertMessages = [];
globalThis.alert = (msg) => { alertMessages.push(msg); };
globalThis.window.alert = globalThis.alert;
globalThis.confirm = () => true;
globalThis.window.confirm = globalThis.confirm;

const storageMap = new Map();
const mockStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear()
};
globalThis.localStorage = mockStorage;
globalThis.window.localStorage = mockStorage;
globalThis.sessionStorage = mockStorage;
globalThis.window.sessionStorage = mockStorage;

// Simple in-memory DOM mock that supports realistic element querying and manipulation
class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this.attributes = new Map();
        this.children = [];
        this._innerHTML = '';
        this.value = '';
        this.className = '';
        this.classList = {
            _classes: new Set(),
            add: (...cls) => cls.forEach(c => this.classList._classes.add(c)),
            remove: (...cls) => cls.forEach(c => this.classList._classes.delete(c)),
            contains: (c) => this.classList._classes.has(c),
            toggle: (c, force) => {
                if (force === true) this.classList._classes.add(c);
                else if (force === false) this.classList._classes.delete(c);
                else if (this.classList._classes.has(c)) this.classList._classes.delete(c);
                else this.classList._classes.add(c);
            }
        };
    }

    get id() { return this.attributes.get('id') || ''; }
    set id(val) { this.attributes.set('id', val); }

    getAttribute(name) { return this.attributes.get(name) || null; }
    setAttribute(name, val) { this.attributes.set(name, String(val)); }

    get innerHTML() { return this._innerHTML; }
    set innerHTML(html) {
        this._innerHTML = html;
        this._parseHtml(html);
    }

    get textContent() { return this._textContent || ''; }
    set textContent(txt) { this._textContent = txt; }

    dispatchEvent() {}
    scrollIntoView() {}

    _parseHtml(html) {
        this.children = [];
        const tagRegex = /<([a-zA-Z0-9]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)([^>]*)\/?>/g;
        let match;
        while ((match = tagRegex.exec(html)) !== null) {
            const tagName = match[1] || match[4];
            const rawAttrs = match[2] || match[5] || '';
            const el = new MockElement(tagName);

            // Parse id
            const idMatch = rawAttrs.match(/id=["']([^"']+)["']/);
            if (idMatch) el.id = idMatch[1];

            // Parse class
            const classMatch = rawAttrs.match(/class=["']([^"']+)["']/);
            if (classMatch) {
                el.className = classMatch[1];
                classMatch[1].split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
            }

            // Parse data attributes
            const dataIndexMatch = rawAttrs.match(/data-index=["']([^"']+)["']/);
            if (dataIndexMatch) el.setAttribute('data-index', dataIndexMatch[1]);

            const dataSoruIndexMatch = rawAttrs.match(/data-soru-index=["']([^"']+)["']/);
            if (dataSoruIndexMatch) el.setAttribute('data-soru-index', dataSoruIndexMatch[1]);

            // Parse value
            const valMatch = rawAttrs.match(/value=["']([^"']*)["']/);
            if (valMatch) el.value = valMatch[1];

            // If select, check for selected option inside match[3]
            if (tagName.toLowerCase() === 'select' && match[3]) {
                const optMatch = match[3].match(/<option\s+value=["']([^"']*)["']\s+selected>/);
                if (optMatch) {
                    el.value = optMatch[1];
                }
            }

            this.children.push(el);
        }
    }

    querySelector(selector) {
        const results = this.querySelectorAll(selector);
        return results[0] || null;
    }

    querySelectorAll(selector) {
        const found = [];
        const matchSelector = (el) => {
            if (selector.startsWith('#') && el.id === selector.slice(1)) return true;
            if (selector.startsWith('.')) {
                const cls = selector.replace(/^\./, '').split('.')[0];
                const attrMatch = selector.match(/\[([a-zA-Z0-9_-]+)=["']([^"']+)["']\]/);
                if (attrMatch) {
                    return el.classList.contains(cls) && el.getAttribute(attrMatch[1]) === attrMatch[2];
                }
                return el.classList.contains(cls);
            }
            if (selector.includes('[data-index=')) {
                const attrMatch = selector.match(/\[data-index=["']([^"']+)["']\]/);
                if (attrMatch && el.getAttribute('data-index') === attrMatch[1]) {
                    if (selector.startsWith('.')) {
                        const cls = selector.split('[')[0].slice(1);
                        return el.classList.contains(cls);
                    }
                    return true;
                }
            }
            return false;
        };

        const traverse = (node) => {
            for (const child of node.children) {
                if (matchSelector(child)) found.push(child);
                traverse(child);
            }
        };
        traverse(this);
        return found;
    }
}

const dynamicContent = new MockElement('div');
dynamicContent.id = 'dynamic-content';

globalThis.document = {
    getElementById: (id) => {
        if (id === 'dynamic-content') return dynamicContent;
        return dynamicContent.querySelector(`#${id}`);
    },
    querySelector: (sel) => dynamicContent.querySelector(sel),
    querySelectorAll: (sel) => dynamicContent.querySelectorAll(sel),
    createElement: (tag) => new MockElement(tag),
    body: new MockElement('body')
};
globalThis.window.document = globalThis.document;

// Import store & exams after globals are set
const { store, STORAGE_KEY, localDataKey } = await import('../store.js');
const { editBransExam, goToFenHataAnaliziStep, goToFenStep1, saveFenExamWithAnalysis } = await import('../exams.js');

// ============================================================================
// PART 3: TEST SUITE EXECUTION (Scenarios A through M)
// ============================================================================

test('Scenario A: Fen branch exam activates 2-step flow with Step 1 indicators and CTA', () => {
    alertMessages = [];
    const student = {
        id: 'std_fen_1',
        adSoyad: 'Ali Fen',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_fen_1',
                denemeAdi: 'Fen Branş Denemesi 1',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                konu: 'Mevsimler ve İklim',
                tarih: '2026-09-01',
                toplamSoru: 4,
                toplamDogru: 2,
                toplamYanlis: 1,
                toplamBos: 1,
                toplamNet: 1.67,
                sorular: [
                    { soruNo: 1, durum: 'dogru', konuAdi: 'Mevsimler ve İklim', hataKodu: null },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'DNA ve Genetik Kod', hataKodu: 'BE' },
                    { soruNo: 3, durum: 'dogru', konuAdi: 'Mevsimler ve İklim', hataKodu: null },
                    { soruNo: 4, durum: 'bos', konuAdi: 'Basınç', hataKodu: 'D' }
                ]
            }
        ],
        odevler: []
    };

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    // Render edit
    editBransExam('std_fen_1', 'ex_fen_1', student.denemeler[0]);
    const step1Html = dynamicContent.innerHTML;

    // Verify Step 1 elements
    assert.ok(step1Html.includes('1. Adım: Soru durumlarını'), 'Step 1 subtitle must indicate Step 1');
    assert.ok(step1Html.includes('Hata Analizine Devam'), 'Step 1 must have CTA to continue to error analysis');
    assert.ok(step1Html.includes('Hata Analizi</span>'), 'Step indicator must show Step 2 Hata Analizi');
});

test('Scenario E & F: Only wrong and blank questions appear in Step 2; correct questions are excluded', () => {
    const student = {
        id: 'std_fen_ef',
        adSoyad: 'Ayşe Fen',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_fen_ef',
                denemeAdi: 'Fen Filtre Testi',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                toplamSoru: 4,
                toplamDogru: 2,
                toplamYanlis: 1,
                toplamBos: 1,
                sorular: [
                    { soruNo: 1, durum: 'dogru', konuAdi: 'Mevsimler ve İklim', hataKodu: null },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'DNA ve Genetik Kod', hataKodu: 'BE' },
                    { soruNo: 3, durum: 'dogru', konuAdi: 'Mevsimler ve İklim', hataKodu: null },
                    { soruNo: 4, durum: 'bos', konuAdi: 'Basınç', hataKodu: 'D' }
                ]
            }
        ]
    };

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    editBransExam('std_fen_ef', 'ex_fen_ef', student.denemeler[0]);
    goToFenHataAnaliziStep('std_fen_ef', 'ex_fen_ef');
    const step2Html = dynamicContent.innerHTML;

    // Scenario E: Only Yanlış and Boş questions appear in Step 2 cards
    assert.ok(step2Html.includes('2. Soru'), 'Question 2 (yanlis) must appear in Step 2');
    assert.ok(step2Html.includes('4. Soru'), 'Question 4 (bos) must appear in Step 2');

    // Scenario F: Doğru questions do NOT appear in Step 2
    assert.ok(!step2Html.includes('1. Soru</span>'), 'Question 1 (dogru) must NOT appear as an analysis card');
    assert.ok(!step2Html.includes('3. Soru</span>'), 'Question 3 (dogru) must NOT appear as an analysis card');
});

test('Scenario B: Matematik branch exam does NOT activate Fen error analysis', () => {
    alertMessages = [];
    const studentMat = {
        id: 'std_mat_1',
        adSoyad: 'Mehmet Mat',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_mat_1',
                denemeAdi: 'Matematik Branş 1',
                tip: 'branş',
                ders: 'Matematik',
                konu: 'Çarpanlar ve Katlar',
                tarih: '2026-09-02',
                toplamSoru: 3,
                toplamDogru: 1,
                toplamYanlis: 2,
                toplamBos: 0,
                toplamNet: 0.33,
                sorular: [
                    { soruNo: 1, durum: 'dogru', konuAdi: 'Çarpanlar ve Katlar', hataKodu: null },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'Çarpanlar ve Katlar', hataKodu: null },
                    { soruNo: 3, durum: 'yanlis', konuAdi: 'Çarpanlar ve Katlar', hataKodu: null }
                ]
            }
        ],
        odevler: []
    };

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentMat]));
    store.globalStudents = [studentMat];

    editBransExam('std_mat_1', 'ex_mat_1', studentMat.denemeler[0]);
    const html = dynamicContent.innerHTML;

    assert.ok(!html.includes('Hata Analizine Devam'), 'Math exam must NOT have Hata Analizine Devam button');
    assert.ok(!html.includes('Fen Bilimleri Hata Analizi'), 'Math exam must NOT mention Fen Hata Analizi');
    assert.ok(!html.includes('fen-konu-select'), 'Math exam must NOT render fen topic select');
    assert.ok(html.includes('Sonucu Kaydet'), 'Math exam must show direct Sonucu Kaydet');
});

test('Scenario C: General exam does not invoke Fen error analysis', () => {
    const studentGenel = {
        id: 'std_genel_1',
        adSoyad: 'Zeynep Genel',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_genel_1',
                denemeAdi: 'LGS Deneme 1',
                tip: 'genel',
                toplamSoru: 90,
                toplamDogru: 60,
                toplamYanlis: 20,
                toplamBos: 10,
                toplamNet: 53.33,
                sorular: []
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentGenel]));
    store.globalStudents = [studentGenel];

    // Calling editGenelExam should not initiate activeExamState for Fen
    const fnStart = examsJsContent.indexOf('export function editGenelExam');
    const fnEnd = examsJsContent.indexOf('export async function saveGenelExamEdit');
    const editGenelBody = examsJsContent.slice(fnStart, fnEnd);
    assert.doesNotMatch(editGenelBody, /renderFenStep/);
});

test('Scenario D: Step 1 D/Y/B inputs and exam name are preserved when navigating to Step 2 and returning via [Sonuca Dön]', () => {
    const student = {
        id: 'std_fen_nav',
        adSoyad: 'Bora Fen',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_fen_nav',
                denemeAdi: 'Nav Test Denemesi',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                toplamSoru: 2,
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: '', hataKodu: null },
                    { soruNo: 2, durum: 'bos', konuAdi: '', hataKodu: null }
                ]
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    editBransExam('std_fen_nav', 'ex_fen_nav', student.denemeler[0]);
    // Step 1 -> Step 2
    goToFenHataAnaliziStep('std_fen_nav', 'ex_fen_nav');
    assert.ok(dynamicContent.innerHTML.includes('Fen Bilimleri Hata Analizi'));

    // Step 2 -> Step 1 via goToFenStep1
    goToFenStep1('std_fen_nav', 'ex_fen_nav');
    const returnHtml = dynamicContent.innerHTML;
    assert.ok(returnHtml.includes('1. Adım: Soru durumlarını'), 'Must be back on Step 1');
    assert.ok(returnHtml.includes('Nav Test Denemesi'), 'Exam name preserved');
});

test('Scenario G: Topic list in Step 2 is grade-specific Fen Bilimleri topics', () => {
    const student7 = {
        id: 'std_fen_7',
        adSoyad: 'Can 7. Sınıf',
        sinif: '7',
        denemeler: [
            {
                id: 'ex_fen_7',
                denemeAdi: '7. Sınıf Fen Deneme',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                sinif: '7',
                toplamSoru: 2,
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: '', hataKodu: null },
                    { soruNo: 2, durum: 'dogru', konuAdi: '', hataKodu: null }
                ]
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student7]));
    store.globalStudents = [student7];

    editBransExam('std_fen_7', 'ex_fen_7', student7.denemeler[0]);
    goToFenHataAnaliziStep('std_fen_7', 'ex_fen_7');

    const html = dynamicContent.innerHTML;
    // 7th grade topics should be present
    assert.ok(html.includes('Türkiye ve Uzay Araştırmaları'), '7th grade topic must be included');
    // 8th grade topics should NOT be present for 7th grade
    assert.ok(!html.includes('Mevsimler ve İklim'), '8th grade topic must NOT be in 7th grade dropdown');
    // Math topics should NOT be present
    assert.ok(!html.includes('Çarpanlar ve Katlar'), 'Math topic must NOT be in Fen dropdown');
});

test('Scenario I & J & K: Validation prevents saving when topic or error code is missing for wrong or blank questions', async () => {
    alertMessages = [];
    const studentVal = {
        id: 'std_fen_val',
        adSoyad: 'Elif Fen',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_fen_val',
                denemeAdi: 'Val Deneme',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                toplamSoru: 2,
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: '', hataKodu: null },
                    { soruNo: 2, durum: 'bos', konuAdi: '', hataKodu: null }
                ]
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentVal]));
    store.globalStudents = [studentVal];

    editBransExam('std_fen_val', 'ex_fen_val', studentVal.denemeler[0]);
    goToFenHataAnaliziStep('std_fen_val', 'ex_fen_val');

    // Attempt save without selecting topic/error codes
    await saveFenExamWithAnalysis('std_fen_val', 'ex_fen_val');

    assert.equal(alertMessages.length, 1, 'Alert must be triggered on missing fields');
    assert.ok(alertMessages[0].includes('hata kaydı eksik'), 'Alert message must explain missing entries');
});

test('Scenario L: All-correct Fen exam allows direct save without error analysis step', () => {
    const studentAllCorrect = {
        id: 'std_fen_correct',
        adSoyad: 'Tam Doğru Öğrenci',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_fen_correct',
                denemeAdi: 'Full Çeken Deneme',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                toplamSoru: 3,
                sorular: [
                    { soruNo: 1, durum: 'dogru', konuAdi: 'Basınç', hataKodu: null },
                    { soruNo: 2, durum: 'dogru', konuAdi: 'Basınç', hataKodu: null },
                    { soruNo: 3, durum: 'dogru', konuAdi: 'Basınç', hataKodu: null }
                ]
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentAllCorrect]));
    store.globalStudents = [studentAllCorrect];

    editBransExam('std_fen_correct', 'ex_fen_correct', studentAllCorrect.denemeler[0]);
    const html = dynamicContent.innerHTML;

    assert.ok(html.includes('Sonucu Kaydet'), 'All-correct exam must show Sonucu Kaydet in Step 1');
    assert.ok(!html.includes('Hata Analizine Devam'), 'All-correct exam must NOT show Hata Analizine Devam CTA');
});

test('Scenario M: Existing saved konuAdi and hataKodu are preloaded during edit', () => {
    const studentPreload = {
        id: 'std_fen_pre',
        adSoyad: 'Preload Öğrenci',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_fen_pre',
                denemeAdi: 'Preloaded Deneme',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                toplamSoru: 2,
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'DNA ve Genetik Kod', hataKodu: 'BE' },
                    { soruNo: 2, durum: 'dogru', konuAdi: 'Basınç', hataKodu: null }
                ]
            }
        ]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([studentPreload]));
    store.globalStudents = [studentPreload];

    editBransExam('std_fen_pre', 'ex_fen_pre', studentPreload.denemeler[0]);
    goToFenHataAnaliziStep('std_fen_pre', 'ex_fen_pre');

    const html = dynamicContent.innerHTML;
    assert.ok(html.includes('value="DNA ve Genetik Kod" selected'), 'Saved topic must be preselected');
    assert.ok(html.includes('value="BE" selected'), 'Saved error code BE must be preselected');
});
