import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const examsJsContent = fs.readFileSync(path.join(ROOT, 'exams.js'), 'utf8');

// ============================================================================
// PART 1: STATIC & ARCHITECTURAL CHECKS (Scenarios R, S)
// ============================================================================

test('Scenario S: store.js has zero git modifications against HEAD', () => {
    const diff = execSync('git diff HEAD -- store.js', { encoding: 'utf8' }).trim();
    assert.equal(diff, '', 'store.js must have 0 diff against HEAD');
});

test('Scenario R: No new schema fields introduced in exams.js', () => {
    assert.doesNotMatch(examsJsContent, /fenAnalysis:/, 'Must not introduce fenAnalysis field');
    assert.doesNotMatch(examsJsContent, /errorAnalysis:/, 'Must not introduce errorAnalysis field');
    assert.doesNotMatch(examsJsContent, /generalFenAnalysis:/, 'Must not introduce generalFenAnalysis field');
    assert.doesNotMatch(examsJsContent, /subjectErrors:/, 'Must not introduce subjectErrors field');
});

test('Scenario I: Canonical HATA_KODLARI is imported and used in general exam Step 2', () => {
    assert.match(examsJsContent, /import\s*\{[^}]*HATA_KODLARI[^}]*\}\s*from\s*['"]\.\/store\.js['"]/);
    assert.match(examsJsContent, /HATA_KODLARI\.map/);
});

test('Scenario O: Final save strictly uses existing updateStudentArrayRecord path', () => {
    assert.match(examsJsContent, /updateStudentArrayRecord\(studentId,\s*'denemeler',\s*exam\.id,\s*updatedExam\)/);
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
        this.eventListeners = {};
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
        this._innerHTML = String(html);
        this.children = parseHtmlToMock(this._innerHTML);
    }

    get textContent() {
        if (this._textContent !== undefined) return this._textContent;
        return this._innerHTML.replace(/<[^>]*>/g, '').trim();
    }
    set textContent(text) { this._textContent = String(text); }

    addEventListener(type, listener) {
        if (!this.eventListeners[type]) this.eventListeners[type] = [];
        this.eventListeners[type].push(listener);
    }

    dispatchEvent(event) {
        const type = typeof event === 'string' ? event : event?.type;
        const listeners = this.eventListeners[type] || [];
        listeners.forEach(fn => fn(event));
    }

    querySelector(sel) {
        return findInMock(this, sel, false);
    }

    querySelectorAll(sel) {
        const results = [];
        findInMock(this, sel, true, results);
        return results;
    }

    scrollIntoView() {}
}

function parseHtmlToMock(html) {
    const root = new MockElement('root');
    const stack = [root];
    const selfClosing = new Set(['input', 'br', 'hr', 'img', 'meta', 'link']);
    const tagRegex = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z0-9\-]+)([^>]*)>|([^<]+)/g;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
        if (match[0].startsWith('<!--')) continue;

        if (match[4]) {
            const text = match[4].trim();
            if (text && stack.length > 0) {
                const current = stack[stack.length - 1];
                current.textContent = (current.textContent ? current.textContent + ' ' : '') + text;
            }
            continue;
        }

        const isClosing = Boolean(match[1]);
        const tagName = match[2].toLowerCase();
        const rawAttrs = match[3] || '';

        if (isClosing) {
            for (let i = stack.length - 1; i > 0; i--) {
                if (stack[i].tagName.toLowerCase() === tagName) {
                    stack.splice(i);
                    break;
                }
            }
        } else {
            const el = new MockElement(tagName);
            const attrRegex = /([a-zA-Z0-9\-]+)(?:=["']([^"']*)["'])?/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
                const attrName = attrMatch[1];
                const attrVal = attrMatch[2] !== undefined ? attrMatch[2] : '';
                el.setAttribute(attrName, attrVal);
                if (attrName === 'id') el.id = attrVal;
                if (attrName === 'class') {
                    el.className = attrVal;
                    attrVal.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
                }
                if (attrName === 'value') el.value = attrVal;
            }

            const currentParent = stack[stack.length - 1];
            currentParent.children.push(el);

            if (tagName === 'option') {
                if (rawAttrs.includes('selected') && currentParent.tagName.toLowerCase() === 'select') {
                    currentParent.value = el.getAttribute('value') || '';
                }
            }

            const isSelfClose = selfClosing.has(tagName) || rawAttrs.trim().endsWith('/');
            if (!isSelfClose) {
                stack.push(el);
            }
        }
    }
    return root.children;
}

function findInMock(node, sel, all = false, results = []) {
    const tokens = sel.trim().split(/\s+/);
    if (tokens.length > 1) {
        let currentParents = [node];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const isLast = (i === tokens.length - 1);
            const nextParents = [];
            for (const parent of currentParents) {
                const matches = [];
                findInMock(parent, token, true, matches);
                nextParents.push(...matches);
            }
            if (isLast) {
                if (all) return nextParents;
                return nextParents[0] || null;
            }
            currentParents = nextParents;
        }
        return all ? [] : null;
    }

    const targetSel = tokens[0];

    const matchSingle = (el, s) => {
        if (s.startsWith('#')) {
            return el.id === s.slice(1);
        }
        if (s.startsWith('.')) {
            const parts = s.slice(1).split('[');
            const cls = parts[0];
            if (!el.classList.contains(cls)) return false;
            if (parts[1]) {
                const attrMatch = parts[1].match(/^([a-zA-Z0-9\-]+)=["']?([^"']*)["']?\]?$/);
                if (attrMatch) {
                    return el.getAttribute(attrMatch[1]) === attrMatch[2];
                }
            }
            return true;
        }
        if (s.startsWith('[')) {
            const attrMatch = s.match(/^\[([a-zA-Z0-9\-]+)=["']?([^"']*)["']?\]$/);
            if (attrMatch) {
                return el.getAttribute(attrMatch[1]) === attrMatch[2];
            }
        }
        if (s.toLowerCase() === el.tagName.toLowerCase()) {
            return true;
        }
        return false;
    };

    const traverse = (current) => {
        for (const child of current.children || []) {
            if (matchSingle(child, targetSel)) {
                if (!all) return child;
                results.push(child);
            }
            const sub = traverse(child);
            if (!all && sub) return sub;
        }
        return null;
    };

    const singleRes = traverse(node);
    return all ? results : singleRes;
}

const mockDoc = new MockElement('html');
const dynamicContent = new MockElement('div');
dynamicContent.id = 'dynamic-content';
mockDoc.children.push(dynamicContent);

globalThis.document = {
    getElementById: (id) => {
        if (id === 'dynamic-content') return dynamicContent;
        return dynamicContent.querySelector('#' + id);
    },
    querySelector: (sel) => {
        if (sel === '#dynamic-content') return dynamicContent;
        return dynamicContent.querySelector(sel);
    },
    querySelectorAll: (sel) => dynamicContent.querySelectorAll(sel),
    createElement: (tag) => new MockElement(tag)
};
globalThis.window.document = globalThis.document;

// Dynamic import of store and exams
const { store, STORAGE_KEY, localDataKey } = await import('../store.js');
const {
    getGeneralExamFenQuestionIndexes,
    getGeneralExamFenQuestions,
    editGenelExam,
    goToGeneralFenStep2,
    goToGeneralStep1,
    saveGenelExamWithFenAnalysis,
    saveGenelExamEdit,
    editBransExam,
    isFenBranchExam
} = await import('../exams.js');

// ============================================================================
// PART 3: TEST FIXTURES
// ============================================================================

function createMockGeneralExam(options = {}) {
    const fenDogru = options.fenDogru ?? 7;
    const fenYanlis = options.fenYanlis ?? 5;
    const fenBos = options.fenBos ?? 8;
    const includeFen = options.includeFen ?? true;

    const dersBilgileri = [
        { ders: 'Türkçe', adet: 20 },
        { ders: 'T.C. İnkılap Tarihi ve Sosyal Bilgiler', adet: 10 },
        { ders: 'Din Kültürü ve Ahlak Bilgisi', adet: 10 },
        { ders: 'Yabancı Dil (İngilizce)', adet: 10 },
        { ders: 'Matematik', adet: 20 }
    ];
    if (includeFen) {
        dersBilgileri.push({ ders: 'Fen Bilimleri', adet: 20 });
    }

    const dersSonuclari = {
        'Türkçe': { dogru: 14, yanlis: 6, bos: 0 },
        'T.C. İnkılap Tarihi ve Sosyal Bilgiler': { dogru: 9, yanlis: 1, bos: 0 },
        'Din Kültürü ve Ahlak Bilgisi': { dogru: 7, yanlis: 3, bos: 0 },
        'Yabancı Dil (İngilizce)': { dogru: 7, yanlis: 3, bos: 0 },
        'Matematik': { dogru: 8, yanlis: 4, bos: 8 }
    };
    if (includeFen) {
        dersSonuclari['Fen Bilimleri'] = { dogru: fenDogru, yanlis: fenYanlis, bos: fenBos };
    }

    let totalQ = 0;
    dersBilgileri.forEach(d => totalQ += d.adet);

    const sorular = [];
    let qNo = 1;
    for (const d of dersBilgileri) {
        const res = dersSonuclari[d.ders];
        let dKalan = res.dogru;
        let yKalan = res.yanlis;
        for (let i = 0; i < d.adet; i++) {
            let durum = 'bos';
            if (dKalan > 0) { durum = 'dogru'; dKalan--; }
            else if (yKalan > 0) { durum = 'yanlis'; yKalan--; }

            sorular.push({
                soruNo: qNo++,
                konuAdi: d.ders,
                durum,
                hataKodu: null
            });
        }
    }

    return {
        id: options.id || 'ex_genel_test_1',
        denemeAdi: options.denemeAdi || 'LGS Hazırlık Denemesi 1',
        tip: 'genel',
        toplamSoru: totalQ,
        toplamDogru: 52,
        toplamYanlis: 22,
        toplamBos: 16,
        toplamNet: 44.67,
        dersBilgileri,
        dersSonuclari,
        sorular
    };
}

function setupStudentWithExam(exam) {
    const student = {
        id: 'std_general_test_1',
        adSoyad: 'Test Öğrenci',
        sinif: '8',
        denemeler: [exam]
    };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    storageMap.set('students', JSON.stringify([student]));
    store.globalStudents = [student];
    return student;
}

// ============================================================================
// PART 4: UNIT & INTEGRATION TESTS (Scenarios A through V)
// ============================================================================

test('Scenario G (Helper): getGeneralExamFenQuestionIndexes returns dynamic indices without hardcoding', () => {
    const exam = createMockGeneralExam();
    const indices = getGeneralExamFenQuestionIndexes(exam);
    assert.equal(indices.length, 20);
    assert.equal(indices[0], 70);
    assert.equal(indices[19], 89);

    const fenQuestions = getGeneralExamFenQuestions(exam);
    assert.equal(fenQuestions.length, 20);
    assert.equal(fenQuestions[0].soruNo, 71);
    assert.equal(fenQuestions[19].soruNo, 90);
});

test('Scenario A: General exam with Fen Y/B > 0 displays [Fen Hata Analizine Devam] and [Sadece Sonucu Kaydet]', () => {
    const exam = createMockGeneralExam({ fenDogru: 7, fenYanlis: 5, fenBos: 8 });
    const student = setupStudentWithExam(exam);

    editGenelExam(student.id, exam.id, exam);

    const step2Btn = document.getElementById('btnGoToGeneralFenStep2');
    assert.ok(step2Btn, '[Fen Hata Analizine Devam] CTA must be present');
    assert.match(step2Btn.textContent, /Fen Hata Analizine Devam/);

    const onlySaveBtn = document.querySelector('#genelStep1CtaContainer .btn-secondary');
    assert.ok(onlySaveBtn, '[Sadece Sonucu Kaydet] CTA must be present');
    assert.match(onlySaveBtn.textContent, /Sadece Sonucu Kaydet/);
});

test('Scenario B: General exam with Fen 20D (0 wrong, 0 blank) does NOT show [Fen Hata Analizine Devam]', () => {
    const exam = createMockGeneralExam({ fenDogru: 20, fenYanlis: 0, fenBos: 0 });
    const student = setupStudentWithExam(exam);

    editGenelExam(student.id, exam.id, exam);

    const step2Btn = document.getElementById('btnGoToGeneralFenStep2');
    assert.equal(step2Btn, null, '[Fen Hata Analizine Devam] CTA must NOT be shown when Fen is 20D');

    const saveBtn = document.querySelector('#genelStep1CtaContainer button');
    assert.ok(saveBtn, 'Normal [Sonucu Kaydet] button must be present');
    assert.match(saveBtn.textContent, /Sonucu Kaydet/);
});

test('Scenario C & V: General exam without Science section does NOT show Fen CTA', () => {
    const exam = createMockGeneralExam({ includeFen: false });
    const student = setupStudentWithExam(exam);

    editGenelExam(student.id, exam.id, exam);

    const step2Btn = document.getElementById('btnGoToGeneralFenStep2');
    assert.equal(step2Btn, null, 'Fen CTA must NOT be present when exam has no Science section');

    const saveBtn = document.querySelector('#genelStep1CtaContainer button');
    assert.ok(saveBtn);
    assert.match(saveBtn.textContent, /Sonucu Kaydet/);
});

test('Scenario D & E & F: Step 2 shows ONLY wrong/blank Science questions, excludes correct and non-Fen questions', () => {
    const exam = createMockGeneralExam({ fenDogru: 7, fenYanlis: 5, fenBos: 8 });
    const student = setupStudentWithExam(exam);

    editGenelExam(student.id, exam.id, exam);
    goToGeneralFenStep2(student.id, exam.id);

    const cards = document.querySelectorAll('.genel-fen-hata-karti');
    assert.equal(cards.length, 13, 'Step 2 must show exactly 13 question cards');

    cards.forEach((card) => {
        const title = card.querySelector('.font-bold')?.textContent;
        const qNum = parseInt(title);
        assert.ok(qNum >= 71 && qNum <= 90, `Question number ${qNum} must be in Fen range 71-90`);
    });
});

test('Scenario H & I: Step 2 dropdowns strictly use grade-specific Fen topics and canonical HATA_KODLARI', () => {
    const exam = createMockGeneralExam({ fenDogru: 7, fenYanlis: 5, fenBos: 8 });
    const student = setupStudentWithExam(exam);

    editGenelExam(student.id, exam.id, exam);
    goToGeneralFenStep2(student.id, exam.id);

    const topicSelect = document.querySelector('.genel-fen-konu-select');
    assert.ok(topicSelect, 'Topic dropdown must exist');
    const topicOptions = Array.from(topicSelect.children).map(o => o.getAttribute('value') || o.value).filter(Boolean);
    const hasMevsimler = topicOptions.some(o => o.toLowerCase().includes('mevsimler'));
    assert.ok(hasMevsimler, 'Must include 8. grade Fen topic Mevsimler');
    const hasDna = topicOptions.some(o => o.includes('DNA'));
    assert.ok(hasDna, 'Must include 8. grade Fen topic DNA ve Genetik Kod');
    assert.ok(!topicOptions.includes('Fiilimsiler'), 'Must NOT include Turkish topic Fiilimsiler');
    assert.ok(!topicOptions.includes('Çarpanlar ve Katlar'), 'Must NOT include Math topic Çarpanlar ve Katlar');

    const hataSelect = document.querySelector('.genel-fen-hata-select');
    assert.ok(hataSelect, 'Hata dropdown must exist');
    const hataOptions = Array.from(hataSelect.children).map(o => o.getAttribute('value') || o.value).filter(Boolean);
    assert.ok(hataOptions.includes('BE'), 'Must include BE');
    assert.ok(hataOptions.includes('D'), 'Must include D');
    assert.ok(hataOptions.includes('ZY'), 'Must include ZY');
});

test('Scenario J & K: Validation blocks save when topic or error code is missing', async () => {
    alertMessages = [];
    const exam = createMockGeneralExam({ fenDogru: 7, fenYanlis: 5, fenBos: 8 });
    const student = setupStudentWithExam(exam);

    editGenelExam(student.id, exam.id, exam);
    goToGeneralFenStep2(student.id, exam.id);

    await saveGenelExamWithFenAnalysis(student.id, exam.id);

    assert.ok(alertMessages.length > 0, 'Alert must be triggered for missing validation');
    assert.match(alertMessages[0], /hata kaydı eksik/i);

    const alertBox = document.getElementById('fenValidationAlert');
    assert.ok(alertBox, 'Validation alert box must be visible');
    assert.ok(alertBox.classList.contains('flex'));
});

test('Scenario L: Back navigation from Step 2 to Step 1 preserves all subject D/Y/B inputs and exam name without saving', () => {
    const exam = createMockGeneralExam({ fenDogru: 7, fenYanlis: 5, fenBos: 8 });
    const student = setupStudentWithExam(exam);

    editGenelExam(student.id, exam.id, exam);

    const turkceDogru = document.querySelector('.genel-dogru[data-ders="Türkçe"]');
    turkceDogru.value = '18';
    turkceDogru.dispatchEvent('input');

    const examNameInput = document.getElementById('editExamName');
    examNameInput.value = 'Güncellenmiş Genel Deneme Adı';
    examNameInput.dispatchEvent('input');

    goToGeneralFenStep2(student.id, exam.id);
    goToGeneralStep1(student.id, exam.id);

    const backTurkce = document.querySelector('.genel-dogru[data-ders="Türkçe"]');
    assert.equal(String(backTurkce.value), '18', 'Turkish score must be preserved after back navigation');

    const backName = document.getElementById('editExamName');
    assert.equal(backName.value, 'Güncellenmiş Genel Deneme Adı', 'Exam name must be preserved after back navigation');
});

test('Scenario M & N: Existing saved general result and Fen konuAdi/hataKodu are preloaded correctly', () => {
    const exam = createMockGeneralExam({ fenDogru: 7, fenYanlis: 5, fenBos: 8 });
    exam.sorular[77].konuAdi = 'Mevsimlerin oluşumu';
    exam.sorular[77].hataKodu = 'BE';

    const student = setupStudentWithExam(exam);

    editGenelExam(student.id, exam.id, exam);
    goToGeneralFenStep2(student.id, exam.id);

    const q78Card = document.querySelector('.genel-fen-hata-karti[data-index="0"]');
    assert.ok(q78Card, 'Card 0 must exist');
    const konuSel = q78Card.querySelector('.genel-fen-konu-select');
    const hataSel = q78Card.querySelector('.genel-fen-hata-select');

    assert.equal(konuSel.value.toLowerCase(), 'mevsimlerin oluşumu', 'Pre-existing topic must be preloaded');
    assert.equal(hataSel.value, 'BE', 'Pre-existing error code must be preloaded');
});

test('Scenario P & Q & O: Final save preserves dersSonuclari, updates Fen questions with selected topics, and maintains totals', async () => {
    const exam = createMockGeneralExam({ fenDogru: 18, fenYanlis: 1, fenBos: 1 });
    const student = setupStudentWithExam(exam);

    editGenelExam(student.id, exam.id, exam);
    goToGeneralFenStep2(student.id, exam.id);

    const cards = document.querySelectorAll('.genel-fen-hata-karti');
    assert.equal(cards.length, 2);

    const konuSel1 = cards[0].querySelector('.genel-fen-konu-select');
    const hataSel1 = cards[0].querySelector('.genel-fen-hata-select');
    konuSel1.value = 'Mevsimlerin oluşumu';
    hataSel1.value = 'D';

    const konuSel2 = cards[1].querySelector('.genel-fen-konu-select');
    const hataSel2 = cards[1].querySelector('.genel-fen-hata-select');
    konuSel2.value = 'DNA ve Genetik Kod';
    hataSel2.value = 'BE';

    await saveGenelExamWithFenAnalysis(student.id, exam.id);

    const updatedStudents = JSON.parse(storageMap.get(localDataKey(STORAGE_KEY)) || storageMap.get('students'));
    const savedExam = updatedStudents[0].denemeler[0];

    assert.ok(savedExam, 'Saved exam must exist');
    assert.equal(savedExam.dersSonuclari['Fen Bilimleri'].dogru, 18);
    assert.equal(savedExam.dersSonuclari['Fen Bilimleri'].yanlis, 1);
    assert.equal(savedExam.dersSonuclari['Fen Bilimleri'].bos, 1);

    assert.equal(savedExam.sorular[70].durum, 'dogru');
    assert.equal(savedExam.sorular[70].hataKodu, null);

    assert.equal(savedExam.sorular[88].durum, 'yanlis');
    assert.equal(savedExam.sorular[88].konuAdi.toLowerCase(), 'mevsimlerin oluşumu');
    assert.equal(savedExam.sorular[88].hataKodu, 'D');

    assert.equal(savedExam.sorular[89].durum, 'bos');
    assert.equal(savedExam.sorular[89].konuAdi, 'DNA ve Genetik Kod');
    assert.equal(savedExam.sorular[89].hataKodu, 'BE');

    assert.equal(savedExam.sorular[0].konuAdi, 'Türkçe');
    assert.equal(savedExam.sorular[0].hataKodu, null);
});

test('Scenario T: Branch Fen error analysis flow regression is fully preserved', () => {
    const branchExam = {
        id: 'ex_brans_1',
        denemeAdi: 'Fen Branş Denemesi 1',
        tip: 'branş',
        ders: 'Fen Bilimleri',
        sinif: '8',
        sorular: [
            { soruNo: 1, durum: 'dogru', konuAdi: 'Mevsimlerin Oluşumu', hataKodu: null },
            { soruNo: 2, durum: 'yanlis', konuAdi: 'Mevsimlerin Oluşumu', hataKodu: null }
        ]
    };
    const student = { id: 'std_b_1', sinif: '8', denemeler: [branchExam] };
    storageMap.set(localDataKey(STORAGE_KEY), JSON.stringify([student]));
    storageMap.set('students', JSON.stringify([student]));
    store.globalStudents = [student];

    assert.equal(isFenBranchExam(branchExam, student), true);
    editBransExam(student.id, branchExam.id, branchExam);

    const step1Btn = document.getElementById('btnFenStep1Action');
    assert.ok(step1Btn, 'Branch exam Step 1 button must still exist');
});

test('Scenario U: Non-Fen branch exam flow regression is fully preserved', () => {
    const mathBranchExam = {
        id: 'ex_mat_1',
        denemeAdi: 'Matematik Branş Denemesi 1',
        tip: 'branş',
        ders: 'Matematik',
        sinif: '8',
        sorular: [
            { soruNo: 1, durum: 'dogru', konuAdi: 'Çarpanlar ve Katlar', hataKodu: null }
        ]
    };
    const student = { id: 'std_m_1', sinif: '8', denemeler: [mathBranchExam] };
    assert.equal(isFenBranchExam(mathBranchExam, student), false);
});
