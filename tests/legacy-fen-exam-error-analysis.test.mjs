import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const examsJsContent = fs.readFileSync(path.join(ROOT, 'exams.js'), 'utf8');

// ============================================================================
// PART 1: STATIC & ARCHITECTURAL CHECKS (Scenarios L, M, N)
// ============================================================================

test('Scenario N: store.js has zero git modifications against HEAD', () => {
    const diff = execSync('git diff HEAD -- store.js', { encoding: 'utf8' }).trim();
    assert.equal(diff, '', 'store.js must have 0 diff against HEAD');
});

test('Scenario L: No schema change — student.denemeler remains canonical', () => {
    assert.doesNotMatch(examsJsContent, /errorAnalysis:/, 'Must not introduce errorAnalysis field');
    assert.doesNotMatch(examsJsContent, /fenAnalysis:/, 'Must not introduce fenAnalysis field');
    assert.doesNotMatch(examsJsContent, /wrongTopics:/, 'Must not introduce wrongTopics field');
    assert.doesNotMatch(examsJsContent, /errorCodes:/, 'Must not introduce errorCodes field');
});

test('Scenario M: No database migration or bulk mutation exists', () => {
    assert.doesNotMatch(examsJsContent, /migrateLegacyExams/, 'Must not contain migration function');
    assert.doesNotMatch(examsJsContent, /bulkMigrate/, 'Must not contain bulk migration');
    assert.doesNotMatch(examsJsContent, /normalizeLegacyData/, 'Must not contain legacy data normalization mutation');
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
        const tagRegex = /<([a-zA-Z0-9]+)([^>]*)>/g;
        let match;
        while ((match = tagRegex.exec(html)) !== null) {
            const tagName = match[1];
            if (tagName.toLowerCase() === 'option') continue;
            const rawAttrs = match[2] || '';
            const el = new MockElement(tagName);

            const idMatch = rawAttrs.match(/id=["']([^"']+)["']/);
            if (idMatch) el.id = idMatch[1];

            const classMatch = rawAttrs.match(/class=["']([^"']+)["']/);
            if (classMatch) {
                el.className = classMatch[1];
                classMatch[1].split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
            }

            const dataIndexMatch = rawAttrs.match(/data-index=["']([^"']+)["']/);
            if (dataIndexMatch) el.setAttribute('data-index', dataIndexMatch[1]);

            const valMatch = rawAttrs.match(/value=["']([^"']*)["']/);
            if (valMatch) el.value = valMatch[1];

            if (tagName.toLowerCase() === 'select') {
                const rest = html.slice(match.index);
                const selectEnd = rest.indexOf('</select>');
                const selectHtml = selectEnd !== -1 ? rest.slice(0, selectEnd) : rest;
                el._innerHTML = selectHtml;
                const optMatch = selectHtml.match(/<option\s+value=["']([^"']*)["']\s+selected>/);
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
                const cls = selector.replace(/^\./, '').split('[')[0];
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

        for (const child of this.children) {
            if (matchSelector(child)) found.push(child);
        }
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

// Import store & exams modules
const { store, STORAGE_KEY, localDataKey } = await import('../store.js');
const {
    isFenBranchExam,
    editBransExam,
    goToFenHataAnaliziStep,
    goToFenStep1,
    saveFenExamWithAnalysis,
    saveBransExamEdit
} = await import('../exams.js');

// ============================================================================
// PART 3: SCENARIO TESTS (A through P)
// ============================================================================

test('Scenario A: New canonical Fen exam => true', () => {
    const canonicalExam = {
        id: 'ex_canonical_fen',
        tip: 'branş',
        ders: 'Fen Bilimleri',
        sinif: '8',
        konu: 'Mevsimlerin Oluşumu',
        sorular: [{ soruNo: 1, durum: 'dogru', konuAdi: 'Mevsimlerin Oluşumu', hataKodu: null }]
    };
    const student = { id: 'std_1', sinif: '8' };
    assert.equal(isFenBranchExam(canonicalExam, student), true);
});

test('Scenario B: Legacy branş, ders missing, 8. sınıf Fen konusu => true', () => {
    const legacyExam1 = {
        id: 'ex_legacy_1',
        tip: 'branş',
        // ders is undefined / missing
        sinif: '8',
        konu: 'Mevsimlerin Oluşumu',
        sorular: [
            { soruNo: 1, durum: 'dogru', konuAdi: 'Mevsimlerin Oluşumu' },
            { soruNo: 2, durum: 'yanlis', konuAdi: 'Mevsimlerin Oluşumu' }
        ]
    };
    const student = { id: 'std_2', sinif: '8' };
    assert.equal(isFenBranchExam(legacyExam1, student), true, 'Legacy exam with Mevsimlerin Oluşumu must evaluate to true');

    // Also test with unit name "Basınç"
    const legacyExam2 = {
        id: 'ex_legacy_2',
        tip: 'branş',
        sinif: '8',
        konu: 'Basınç',
        sorular: [{ soruNo: 1, durum: 'dogru', konuAdi: 'Basınç' }]
    };
    assert.equal(isFenBranchExam(legacyExam2, student), true, 'Legacy exam with unit Basınç must evaluate to true');

    // Also test with case-insensitive / trimmed match
    const legacyExam3 = {
        id: 'ex_legacy_3',
        tip: 'branş',
        konu: '  mevsimlerin oluşumu  ',
        sorular: []
    };
    assert.equal(isFenBranchExam(legacyExam3, student), true, 'Whitespace and case variations must match');
});

test('Scenario C: Legacy branş, ders missing, exam.konu missing, but Fen soru konuAdi present => true', () => {
    const legacyExam = {
        id: 'ex_legacy_soru_topic',
        tip: 'branş',
        // ders is undefined
        // konu is undefined
        sinif: '8',
        sorular: [
            { soruNo: 1, durum: 'dogru', konuAdi: 'DNA ve Genetik Kod', hataKodu: null },
            { soruNo: 2, durum: 'yanlis', konuAdi: 'Katı basıncı', hataKodu: null }
        ]
    };
    const student = { id: 'std_3', sinif: '8' };
    assert.equal(isFenBranchExam(legacyExam, student), true, 'Question topic evidence must classify legacy exam as Fen');
});

test('Scenario D: Legacy Matematik konusu => false (False Positive Protection)', () => {
    const mathExam1 = {
        id: 'ex_legacy_math',
        tip: 'branş',
        // ders is undefined
        sinif: '8',
        konu: 'Çarpanlar ve Katlar',
        sorular: [
            { soruNo: 1, durum: 'dogru', konuAdi: 'Çarpanlar ve Katlar' },
            { soruNo: 2, durum: 'yanlis', konuAdi: 'Çarpanlar ve Katlar' }
        ]
    };
    const mathExam2 = {
        id: 'ex_legacy_math_2',
        tip: 'branş',
        sinif: '8',
        konu: 'Üslü İfadeler',
        sorular: [{ soruNo: 1, durum: 'bos', konuAdi: 'Üslü İfadeler' }]
    };
    const student = { id: 'std_4', sinif: '8' };
    assert.equal(isFenBranchExam(mathExam1, student), false, 'Legacy Math exam must NOT be detected as Fen');
    assert.equal(isFenBranchExam(mathExam2, student), false, 'Legacy Math exam must NOT be detected as Fen');
});

test('Scenario E: Legacy Türkçe konusu => false (False Positive Protection)', () => {
    const turkceExam = {
        id: 'ex_legacy_turkce',
        tip: 'branş',
        // ders is undefined
        sinif: '8',
        konu: 'Fiilimsiler (İsim-Fiil, Sıfat-Fiil, Zarf-Fiil)',
        sorular: [
            { soruNo: 1, durum: 'dogru', konuAdi: 'Fiilimsiler' }
        ]
    };
    const student = { id: 'std_5', sinif: '8' };
    assert.equal(isFenBranchExam(turkceExam, student), false, 'Legacy Turkish exam must NOT be detected as Fen');
});

test('Scenario F: General exam => false (even if containing Science topics)', () => {
    const generalExam = {
        id: 'ex_general',
        tip: 'genel',
        denemeAdi: 'LGS Deneme 3',
        sinif: '8',
        dersBilgileri: [
            { ders: 'Türkçe', adet: 20 },
            { ders: 'Matematik', adet: 20 },
            { ders: 'Fen Bilimleri', adet: 20 }
        ],
        sorular: [
            { soruNo: 1, durum: 'dogru', konuAdi: 'Fen Bilimleri' },
            { soruNo: 2, durum: 'yanlis', konuAdi: 'Mevsimlerin Oluşumu' }
        ]
    };
    const student = { id: 'std_6', sinif: '8' };
    assert.equal(isFenBranchExam(generalExam, student), false, 'General exam must never trigger branch error analysis');
});

test('Scenario G: Legacy Fen completed result D/Y/B preload is preserved', () => {
    const student = {
        id: 'std_legacy_preload',
        adSoyad: 'Can Fenli',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_legacy_g',
                denemeAdi: 'Eski Fen Denemesi 2025',
                tip: 'branş',
                // ders missing
                sinif: '8',
                konu: 'Mevsimlerin Oluşumu',
                toplamSoru: 4,
                toplamDogru: 2,
                toplamYanlis: 1,
                toplamBos: 1,
                toplamNet: 1.67,
                sorular: [
                    { soruNo: 1, durum: 'dogru', konuAdi: 'Mevsimlerin Oluşumu' },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'Mevsimlerin Oluşumu' },
                    { soruNo: 3, durum: 'dogru', konuAdi: 'Mevsimlerin Oluşumu' },
                    { soruNo: 4, durum: 'bos', konuAdi: 'Mevsimlerin Oluşumu' }
                ]
            }
        ]
    };

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    editBransExam('std_legacy_preload', 'ex_legacy_g', student.denemeler[0]);
    const footerText = document.getElementById('editFooter')?.innerHTML || '';

    // Verify footer reflects D:2, Y:1, B:1, Net: 1.67
    assert.ok(footerText.includes('D:2'), 'Footer must show D:2');
    assert.ok(footerText.includes('Y:1'), 'Footer must show Y:1');
    assert.ok(footerText.includes('B:1'), 'Footer must show B:1');
    assert.ok(footerText.includes('Net: 1.67'), 'Footer must show Net: 1.67');
});

test('Scenario H: Legacy Fen wrong question konuAdi is preloaded in Step 2', () => {
    const student = {
        id: 'std_legacy_h',
        adSoyad: 'Zeynep Fen',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_legacy_h',
                denemeAdi: 'Eski Fen Konu Testi',
                tip: 'branş',
                sinif: '8',
                konu: 'Mevsimlerin Oluşumu',
                toplamSoru: 2,
                toplamDogru: 0,
                toplamYanlis: 2,
                toplamBos: 0,
                sorular: [
                    { soruNo: 1, durum: 'yanlis', konuAdi: 'Mevsimlerin oluşumu', hataKodu: null },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'DNA ve Genetik Kod', hataKodu: null }
                ]
            }
        ]
    };

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    editBransExam('std_legacy_h', 'ex_legacy_h', student.denemeler[0]);
    goToFenHataAnaliziStep('std_legacy_h', 'ex_legacy_h');

    const card0 = document.getElementById('fen-card-0');
    const card1 = document.getElementById('fen-card-1');

    assert.ok(card0, 'Card 0 must exist in Step 2');
    assert.ok(card1, 'Card 1 must exist in Step 2');

    const select0 = document.querySelector('.fen-konu-select[data-index="0"]');
    const select1 = document.querySelector('.fen-konu-select[data-index="1"]');

    assert.ok(select0, 'Topic select 0 must exist');
    assert.ok(select1, 'Topic select 1 must exist');
    assert.ok(select0.innerHTML.includes('selected') || select0.value, 'Topic select 0 must have selected topic');
    assert.ok(select1.innerHTML.includes('selected') || select1.value, 'Topic select 1 must have selected topic');
});

test('Scenario I: Legacy Fen with hataKodu null opens Step 2 cleanly without errors', () => {
    alertMessages = [];
    const student = {
        id: 'std_legacy_null_error',
        adSoyad: 'Kerem Fen',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_legacy_i',
                denemeAdi: 'Hata Kodu Olmayan Eski Deneme',
                tip: 'branş',
                konu: 'Mevsimlerin Oluşumu',
                toplamSoru: 2,
                toplamDogru: 1,
                toplamYanlis: 1,
                toplamBos: 0,
                sorular: [
                    { soruNo: 1, durum: 'dogru', konuAdi: 'Mevsimlerin Oluşumu', hataKodu: null },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'Mevsimlerin Oluşumu', hataKodu: null }
                ]
            }
        ]
    };

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    assert.doesNotThrow(() => {
        editBransExam('std_legacy_null_error', 'ex_legacy_i', student.denemeler[0]);
        goToFenHataAnaliziStep('std_legacy_null_error', 'ex_legacy_i');
    }, 'Opening Step 2 with null hataKodu must not throw');

    const card = document.getElementById('fen-card-1');
    assert.ok(card, 'Card 1 must be rendered in Step 2');
    const hataSelect = document.querySelector('.fen-hata-select[data-index="1"]');
    assert.ok(hataSelect, 'Hata select 1 must exist');
    // Default option is -- Hata Kodu Seçin -- (value "")
    assert.equal(hataSelect.value, '', 'Hata kodu dropdown must default to empty when hataKodu is null');
});

test('Scenario J: Legacy Fen in Step 1 displays [Hata Analizine Devam] button', () => {
    const student = {
        id: 'std_legacy_cta',
        adSoyad: 'Murat Fen',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_legacy_j',
                denemeAdi: 'Eski Fen Deneme CTA',
                tip: 'branş',
                konu: 'Mevsimlerin Oluşumu',
                toplamSoru: 3,
                toplamDogru: 1,
                toplamYanlis: 1,
                toplamBos: 1,
                sorular: [
                    { soruNo: 1, durum: 'dogru', konuAdi: 'Mevsimlerin Oluşumu' },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'Mevsimlerin Oluşumu' },
                    { soruNo: 3, durum: 'bos', konuAdi: 'Mevsimlerin Oluşumu' }
                ]
            }
        ]
    };

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    editBransExam('std_legacy_cta', 'ex_legacy_j', student.denemeler[0]);
    const step1Html = dynamicContent.innerHTML;

    assert.ok(step1Html.includes('Hata Analizine Devam'), 'Step 1 must have CTA to continue to error analysis');
    assert.ok(step1Html.includes('Sonuç'), 'Step 1 indicator must display Sonuç');
    assert.ok(step1Html.includes('Hata Analizi'), 'Step indicator must display Hata Analizi');
});

test('Scenario K: Legacy Fen final save reuses existing saveBransExamEdit and preserves structure', async () => {
    alertMessages = [];
    const student = {
        id: 'std_legacy_save',
        adSoyad: 'Eski Kaydet Fen',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_legacy_k',
                denemeAdi: 'Eski Fen Kaydet Test',
                tip: 'branş',
                // ders is intentionally omitted (legacy)
                tarih: '2025-10-15',
                konu: 'Mevsimlerin Oluşumu',
                toplamSoru: 2,
                toplamDogru: 1,
                toplamYanlis: 1,
                toplamBos: 0,
                toplamNet: 0.67,
                sorular: [
                    { soruNo: 1, durum: 'dogru', konuAdi: 'Mevsimlerin Oluşumu', hataKodu: null },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'Mevsimlerin Oluşumu', hataKodu: null }
                ]
            }
        ]
    };

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    editBransExam('std_legacy_save', 'ex_legacy_k', student.denemeler[0]);
    goToFenHataAnaliziStep('std_legacy_save', 'ex_legacy_k');

    // Fill in error analysis in Step 2
    const topicSelect = document.querySelector('.fen-konu-select[data-index="1"]');
    const errorSelect = document.querySelector('.fen-hata-select[data-index="1"]');
    topicSelect.value = 'Mevsimlerin oluşumu';
    errorSelect.value = 'D'; // Dikkat Eksikliği

    await saveFenExamWithAnalysis('std_legacy_save', 'ex_legacy_k');

    // Verify persisted student data
    const savedStudents = JSON.parse(storageMap.get(localDataKey(STORAGE_KEY)));
    const savedExam = savedStudents[0].denemeler[0];

    assert.equal(savedExam.sorular[1].hataKodu, 'D', 'Question 2 hataKodu must be saved as D');
    assert.equal(savedExam.sorular[1].durum, 'yanlis', 'Question 2 durum must remain yanlis');
    assert.equal(savedExam.sorular[0].durum, 'dogru', 'Question 1 durum must remain dogru');
    assert.equal(savedExam.sorular[0].hataKodu, null, 'Question 1 hataKodu must remain null');
    assert.equal(savedExam.tarih, '2025-10-15', 'Original exam.tarih must be preserved');
    // Notice: ders was undefined, no forced migration or extra fields added
    assert.equal(savedExam.errorAnalysis, undefined, 'Must not have errorAnalysis property');
});

test('Scenario O: New canonical Fen flow regression preserved', async () => {
    alertMessages = [];
    const student = {
        id: 'std_new_fen',
        adSoyad: 'Yeni Fen Öğrenci',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_new_fen',
                denemeAdi: 'Yeni Fen Denemesi 2026',
                tip: 'branş',
                ders: 'Fen Bilimleri',
                sinif: '8',
                konu: 'DNA ve Genetik Kod',
                toplamSoru: 2,
                toplamDogru: 1,
                toplamYanlis: 1,
                toplamBos: 0,
                sorular: [
                    { soruNo: 1, durum: 'dogru', konuAdi: 'DNA ve Genetik Kod', hataKodu: null },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'DNA ve Genetik Kod', hataKodu: null }
                ]
            }
        ]
    };

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    assert.equal(isFenBranchExam(student.denemeler[0], student), true, 'Canonical exam must return true');

    editBransExam('std_new_fen', 'ex_new_fen', student.denemeler[0]);
    goToFenHataAnaliziStep('std_new_fen', 'ex_new_fen');

    const topicSelect = document.querySelector('.fen-konu-select[data-index="1"]');
    const errorSelect = document.querySelector('.fen-hata-select[data-index="1"]');
    topicSelect.value = 'DNA ve Genetik Kod';
    errorSelect.value = 'BE'; // Bilgi Eksikliği

    await saveFenExamWithAnalysis('std_new_fen', 'ex_new_fen');

    const savedStudents = JSON.parse(storageMap.get(localDataKey(STORAGE_KEY)));
    const savedExam = savedStudents[0].denemeler[0];
    assert.equal(savedExam.sorular[1].hataKodu, 'BE');
    assert.equal(savedExam.ders, 'Fen Bilimleri');
});

test('Scenario P: Non-Fen flow regression preserved', () => {
    const student = {
        id: 'std_mat_nonfen',
        adSoyad: 'Matematik Öğrenci',
        sinif: '8',
        denemeler: [
            {
                id: 'ex_mat_p',
                denemeAdi: 'Mat Denemesi',
                tip: 'branş',
                ders: 'Matematik',
                toplamSoru: 3,
                toplamDogru: 1,
                toplamYanlis: 2,
                toplamBos: 0,
                sorular: [
                    { soruNo: 1, durum: 'dogru', konuAdi: 'Çarpanlar ve Katlar', hataKodu: null },
                    { soruNo: 2, durum: 'yanlis', konuAdi: 'Çarpanlar ve Katlar', hataKodu: null },
                    { soruNo: 3, durum: 'yanlis', konuAdi: 'Çarpanlar ve Katlar', hataKodu: null }
                ]
            }
        ]
    };

    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    store.globalStudents = [student];

    assert.equal(isFenBranchExam(student.denemeler[0], student), false);

    editBransExam('std_mat_nonfen', 'ex_mat_p', student.denemeler[0]);
    const html = dynamicContent.innerHTML;

    assert.ok(!html.includes('Hata Analizine Devam'), 'Must not show Hata Analizine Devam');
    assert.ok(html.includes('Sonucu Kaydet'), 'Must show direct Sonucu Kaydet button');
});
