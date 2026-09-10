import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const financeJsContent = fs.readFileSync(path.join(ROOT, 'finance.js'), 'utf8');

// ============================================================================
// PART 1: SAFETY & STATIC CODE AUDIT
// ============================================================================

test('Scenario A: Zero git modifications on protected files', () => {
    const protectedFiles = [
        'store.js',
        'firebase-config.js',
        'firestore.rules',
        'exams.js',
        'auth.js',
        'index.html',
        'ui-helpers.js',
        'schedule.js',
        'homework.js'
    ];

    for (const file of protectedFiles) {
        const diff = execSync(`git diff HEAD -- ${file}`, { encoding: 'utf8' }).trim();
        assert.equal(diff, '', `${file} must have 0 diff against HEAD`);
    }
});

test('Scenario B: No destructive database operations in finance.js', () => {
    assert.doesNotMatch(financeJsContent, /localStorage\.clear\s*\(/);
    assert.doesNotMatch(financeJsContent, /indexedDB\.deleteDatabase\s*\(/);
    assert.doesNotMatch(financeJsContent, /clearPersistence\s*\(/);
    assert.doesNotMatch(financeJsContent, /deleteDoc\s*\(/);
    assert.doesNotMatch(financeJsContent, /setDoc\s*\(/);
});

test('Scenario C: Architecture elements and card simplification in finance.js', () => {
    // 3 separate KPI columns removed from renderDersKayitlari
    assert.doesNotMatch(financeJsContent, /grid grid-cols-3 gap-2 mt-4 pt-4 border-t/, '3-column KPI blocks must be removed');
    assert.doesNotMatch(financeJsContent, /Bir ders ücreti ·/, 'Old Bir ders ücreti format must be removed');

    // Simplified elements present
    assert.match(financeJsContent, /Ders ücreti:\s*\$\{dersUcreti\}\s*TL/, 'Ders ücreti label must be simplified');
    assert.match(financeJsContent, /Tahsil\s*\$\{toplamOdeme\}\s*TL/, 'Summary row must use canonical Tahsil label');
    assert.match(financeJsContent, /Henüz ders kaydı yok/, 'Zero-lesson state message must be present');
    assert.match(financeJsContent, /min-w-\[44px\]\s+min-h-\[44px\]/, 'Chevron touch target must satisfy >=44x44');
    assert.match(financeJsContent, /renderDerslerTabBarHtml\('lessons'\)/, 'Dersler tab bar must be preserved');
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
globalThis.window.isFirebaseActive = true;
globalThis.window.auth = { currentUser: null };
globalThis.window.confirm = () => true;
globalThis.window.alert = () => {};

class MockClassList {
    constructor() { this._classes = new Set(); }
    add(...cls) { cls.forEach(c => c && this._classes.add(c)); }
    remove(...cls) { cls.forEach(c => this._classes.delete(c)); }
    contains(c) { return this._classes.has(c); }
}

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this._id = '';
        this._innerHTML = '';
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.classList = new MockClassList();
        this.style = {};
    }
    get id() { return this._id; }
    set id(val) { this._id = val; }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(val) { this._innerHTML = val; }
    addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getAttribute(name) { return this.attributes[name] || null; }
    setAttribute(name, val) { this.attributes[name] = String(val); }
    removeAttribute(name) { delete this.attributes[name]; }
}

const mockElements = new Map();
globalThis.document = {
    getElementById: (id) => {
        if (!mockElements.has(id)) {
            const el = new MockElement('div');
            el.id = id;
            mockElements.set(id, el);
        }
        return mockElements.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => []
};

// Dynamic import of modules after mock environment setup
const storeModule = await import('../store.js');
const financeModule = await import('../finance.js');

const { store } = storeModule;
const { renderDersKayitlari } = financeModule;

function setupMockData(students, lessonsMap = {}) {
    mockElements.clear();
    mockElements.set('dynamic-content', new MockElement('div'));

    globalThis.window.isFirebaseActive = true;
    store.useFirestore = true;
    store.globalStudents = students;
    store.globalLessons = lessonsMap;
}

// ============================================================================
// PART 3: TEST SCENARIOS
// ============================================================================

test('Scenario D: Test Fixture — Dersli Öğrenci (Muhammed Emir: 5 ders, 4 ödendi, Tahsil 6000 TL)', () => {
    const students = [
        { id: 's-emir', adSoyad: 'Muhammed Emir', dersUcreti: 1500, sinif: '8' }
    ];
    const lessons = {
        's-emir': [
            { id: 'l1', tarih: '2026-03-01', ders: 'Matematik', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l2', tarih: '2026-03-08', ders: 'Matematik', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l3', tarih: '2026-03-15', ders: 'Matematik', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l4', tarih: '2026-03-22', ders: 'Matematik', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l5', tarih: '2026-03-29', ders: 'Matematik', katilimDurumu: 'yapildi', odendi: false }
        ]
    };

    setupMockData(students, lessons);
    renderDersKayitlari();

    const output = document.getElementById('dynamic-content').innerHTML;

    // Student Name
    assert.ok(output.includes('Muhammed Emir'), 'Must show student name Muhammed Emir');
    // Simplified Fee
    assert.ok(output.includes('Ders ücreti: 1500 TL'), 'Must show Ders ücreti: 1500 TL');
    // Summary line
    assert.match(output, /5\s*ders/, 'Must show 5 ders');
    assert.match(output, /4\s*ödendi/, 'Must show 4 ödendi');
    assert.match(output, /Tahsil\s*6000\s*TL/, 'Must show Tahsil 6000 TL');
    // Pending payment indicator (amber)
    assert.match(output, /text-amber-600/, 'Partial payment must use amber highlight');
    // No 3-column KPI blocks
    assert.doesNotMatch(output, /grid grid-cols-3/, 'Must not contain 3-column KPI blocks');
});

test('Scenario E: Test Fixture — Sıfır Ders (Yusuf Tuğra Var: 0 ders, 0/0, 0 TL not shown)', () => {
    const students = [
        { id: 's-yusuf', adSoyad: 'Yusuf Tuğra Var', dersUcreti: 0, sinif: '8' }
    ];
    const lessons = {
        's-yusuf': []
    };

    setupMockData(students, lessons);
    renderDersKayitlari();

    const output = document.getElementById('dynamic-content').innerHTML;

    // Student Name
    assert.ok(output.includes('Yusuf Tuğra Var'), 'Must show student name Yusuf Tuğra Var');
    // Calm empty state message
    assert.ok(output.includes('Henüz ders kaydı yok'), 'Must show Henüz ders kaydı yok');
    // Forbidden 3-zero metrics
    assert.doesNotMatch(output, /0\/0/, 'Must NOT show 0/0');
    assert.doesNotMatch(output, /0\s*TL/, 'Must NOT show 0 TL');
    assert.doesNotMatch(output, /grid grid-cols-3/, 'Must NOT show 3-column KPI grid');
});

test('Scenario F: Canonical Finance Metric Semantics (getDersOzet provides collected total)', () => {
    const students = [
        { id: 's-emir', adSoyad: 'Muhammed Emir', dersUcreti: 1500, sinif: '8' }
    ];
    const lessons = {
        's-emir': [
            { id: 'l1', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l2', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l3', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l4', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l5', katilimDurumu: 'yapildi', odendi: false }
        ]
    };
    setupMockData(students, lessons);

    const dersUcreti = 1500;
    const ozet = storeModule.getDersOzet('s-emir', dersUcreti);
    
    // Validate canonical calculation
    assert.equal(ozet.toplamDers, 5, 'Total lessons must be 5');
    assert.equal(ozet.odenenDersSayisi, 4, 'Paid count must be 4');
    assert.equal(ozet.toplamOdeme, 6000, 'Collected total must be 6000');

    // UI renders canonical label 'Tahsil 6000 TL'
    renderDersKayitlari();
    const output = document.getElementById('dynamic-content').innerHTML;
    assert.ok(output.includes('Tahsil 6000 TL'), 'UI label must match canonical collected payment metric');
    assert.doesNotMatch(output, />Toplam\s*6000\s*TL</, 'Should not ambiguously label collected payment as Toplam');
});

test('Scenario G: Color semantics for payment status', () => {
    // 1. All Paid -> Emerald
    setupMockData(
        [{ id: 's-all-paid', adSoyad: 'Tamamlanan Öğrenci', dersUcreti: 1000 }],
        { 's-all-paid': [{ id: 'lp1', katilimDurumu: 'yapildi', odendi: true }] }
    );
    renderDersKayitlari();
    let output = document.getElementById('dynamic-content').innerHTML;
    assert.match(output, /text-emerald-600/, 'Fully paid lessons must have emerald status');

    // 2. Unpaid -> Rose
    setupMockData(
        [{ id: 's-unpaid', adSoyad: 'Ödenmemiş Öğrenci', dersUcreti: 1000 }],
        { 's-unpaid': [{ id: 'lu1', katilimDurumu: 'yapildi', odendi: false }] }
    );
    renderDersKayitlari();
    output = document.getElementById('dynamic-content').innerHTML;
    assert.match(output, /text-rose-600/, 'Zero paid lessons must have rose status');
});

test('Scenario H: Navigation & Chevron Affordance', () => {
    setupMockData(
        [{ id: 's-nav', adSoyad: 'Test Navigasyon', dersUcreti: 1200 }],
        { 's-nav': [{ id: 'ln1', katilimDurumu: 'yapildi', odendi: true }] }
    );
    renderDersKayitlari();
    const output = document.getElementById('dynamic-content').innerHTML;

    // Card click triggers renderDersDetay
    assert.ok(output.includes("renderDersDetay('s-nav')"), 'Card must trigger renderDersDetay with student ID');
    // Chevron icon present
    assert.ok(output.includes('fa-chevron-right'), 'Chevron right icon must be present');
    assert.ok(output.includes('min-w-[44px] min-h-[44px]'), 'Chevron affordance must satisfy min 44px touch target');
});

test('Scenario I: Empty state when 0 students exist', () => {
    setupMockData([]);
    renderDersKayitlari();
    const output = document.getElementById('dynamic-content').innerHTML;

    assert.ok(output.includes('Henüz Öğrenci Kaydı Bulunmuyor'), 'Must render polite empty state when no students exist');
    assert.ok(output.includes('showAddStudentModal()'), 'Must provide add student button in empty state');
});

test('Scenario J: Missing fee + lesson (dersUcreti = undefined) shows Ücret tanımlı değil without Tahsil 0 TL', () => {
    setupMockData(
        [{ id: 's-undef', adSoyad: 'Şimal Güler', sinif: '8' }], // dersUcreti is undefined
        { 's-undef': [{ id: 'lu1', ders: 'Fen Bilimleri', katilimDurumu: 'yapildi', odendi: false }] }
    );
    renderDersKayitlari();
    const output = document.getElementById('dynamic-content').innerHTML;

    assert.ok(output.includes('Şimal Güler'), 'Must show student name');
    assert.match(output, /1\s*ders/, 'Must show 1 ders');
    assert.match(output, /0\s*ödendi/, 'Must show 0 ödendi');
    assert.ok(output.includes('Ücret tanımlı değil'), 'Must show Ücret tanımlı değil');
    assert.match(output, /text-amber-600/, 'Missing fee badge must have amber warning styling');
    assert.doesNotMatch(output, /Tahsil\s*0\s*TL/, 'Must NOT show Tahsil 0 TL');
    assert.doesNotMatch(output, /Ders ücreti:\s*0\s*TL/, 'Must NOT show Ders ücreti: 0 TL');
});

test('Scenario K: Null fee + lesson (dersUcreti = null) safe behavior', () => {
    setupMockData(
        [{ id: 's-null', adSoyad: 'Null Fee Student', dersUcreti: null, sinif: '8' }],
        { 's-null': [{ id: 'lu2', ders: 'Matematik', katilimDurumu: 'yapildi', odendi: false }] }
    );
    renderDersKayitlari();
    const output = document.getElementById('dynamic-content').innerHTML;

    assert.ok(output.includes('Null Fee Student'), 'Must show student name');
    assert.ok(output.includes('Ücret tanımlı değil'), 'Must show Ücret tanımlı değil');
    assert.doesNotMatch(output, /Tahsil\s*0\s*TL/, 'Must NOT show Tahsil 0 TL');
    assert.doesNotMatch(output, /Ders ücreti:\s*0\s*TL/, 'Must NOT show Ders ücreti: 0 TL');
});

test('Scenario L: Explicit zero fee + lesson (dersUcreti = 0) safe behavior', () => {
    setupMockData(
        [{ id: 's-zero', adSoyad: 'Zero Fee Student', dersUcreti: 0, sinif: '8' }],
        { 's-zero': [{ id: 'lu3', ders: 'Türkçe', katilimDurumu: 'yapildi', odendi: false }] }
    );
    renderDersKayitlari();
    const output = document.getElementById('dynamic-content').innerHTML;

    assert.ok(output.includes('Zero Fee Student'), 'Must show student name');
    assert.ok(output.includes('Ücret tanımlı değil'), 'Must show Ücret tanımlı değil');
    assert.doesNotMatch(output, /Tahsil\s*0\s*TL/, 'Must NOT show Tahsil 0 TL');
    assert.doesNotMatch(output, /Ders ücreti:\s*0\s*TL/, 'Must NOT show Ders ücreti: 0 TL');
});

test('Scenario M: Normal fee + lessons (dersUcreti = 1500, 5 lessons, 4 paid)', () => {
    setupMockData(
        [{ id: 's-normal', adSoyad: 'Normal Fee Student', dersUcreti: 1500, sinif: '8' }],
        {
            's-normal': [
                { id: 'nl1', katilimDurumu: 'yapildi', odendi: true },
                { id: 'nl2', katilimDurumu: 'yapildi', odendi: true },
                { id: 'nl3', katilimDurumu: 'yapildi', odendi: true },
                { id: 'nl4', katilimDurumu: 'yapildi', odendi: true },
                { id: 'nl5', katilimDurumu: 'yapildi', odendi: false }
            ]
        }
    );
    renderDersKayitlari();
    const output = document.getElementById('dynamic-content').innerHTML;

    assert.ok(output.includes('Ders ücreti: 1500 TL'), 'Must show Ders ücreti: 1500 TL');
    assert.match(output, /5\s*ders/, 'Must show 5 ders');
    assert.match(output, /4\s*ödendi/, 'Must show 4 ödendi');
    assert.match(output, /Tahsil\s*6000\s*TL/, 'Must show Tahsil 6000 TL');
});

test('Scenario N: Zero lesson with fee (dersUcreti = 1000, 0 lessons)', () => {
    setupMockData(
        [{ id: 's-zeroles', adSoyad: 'Yusuf Tuğra Var', dersUcreti: 1000, sinif: '8' }],
        { 's-zeroles': [] }
    );
    renderDersKayitlari();
    const output = document.getElementById('dynamic-content').innerHTML;

    assert.ok(output.includes('Ders ücreti: 1000 TL'), 'Must show Ders ücreti: 1000 TL');
    assert.ok(output.includes('Henüz ders kaydı yok'), 'Must show Henüz ders kaydı yok');
    assert.doesNotMatch(output, /Tahsil\s*0\s*TL/, 'Must NOT show Tahsil 0 TL');
    assert.doesNotMatch(output, /0\/0/, 'Must NOT show 0/0');
});
