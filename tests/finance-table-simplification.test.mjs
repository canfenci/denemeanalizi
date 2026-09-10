import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

// ============================================================================
// PART 1: STATIC CODE AUDIT & SAFETY CHECKS
// ============================================================================

const rootDir = resolve(process.cwd());
const financeJsPath = resolve(rootDir, 'finance.js');
const financeJsContent = readFileSync(financeJsPath, 'utf8');

test('Scenario A: Zero git modifications on protected files', () => {
    const protectedFiles = [
        'store.js',
        'firebase-config.js',
        'firestore.rules',
        'exams.js',
        'auth.js',
        'index.html',
        'ui-helpers.js',
        'students.js',
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

test('Scenario C: Static architecture elements of table & KPI simplification in finance.js', () => {
    // 4 KPI cards preserved
    assert.match(financeJsContent, /Aktif Ücretli Öğrenci/, 'Must include Aktif Ücretli Öğrenci KPI');
    assert.match(financeJsContent, /Yapılan Toplam Ders/, 'Must include Yapılan Toplam Ders KPI');
    assert.match(financeJsContent, /Tahsil Edilen Toplam Tutar/, 'Must include Tahsil Edilen Toplam Tutar KPI');
    assert.match(financeJsContent, /Ödeme Bekleyen Tutar/, 'Must include Ödeme Bekleyen Tutar KPI');

    // Semantic label for active paid students
    assert.match(financeJsContent, /\$\{activeFeeStudentsCount\}\s+aktif\s+\/\s+\$\{students\.length\}\s+toplam/, 'Active fee student semantic must be explicit (X aktif / Y toplam)');

    // Compact KPI card structure
    assert.match(financeJsContent, /cf-card\s+p-3\s+sm:p-3\.5/, 'KPI card must use compact padding (p-3 sm:p-3.5)');

    // Table headers: modern compact titles
    assert.match(financeJsContent, /<th[^>]*>Öğrenci<\/th>/, 'Table header must have Öğrenci');
    assert.match(financeJsContent, /<th[^>]*>Ders Ücreti<\/th>/, 'Table header must have Ders Ücreti');
    assert.match(financeJsContent, /<th[^>]*>Ders<\/th>/, 'Table header must have Ders (not Toplam Ders)');
    assert.match(financeJsContent, /<th[^>]*>Tahsil<\/th>/, 'Table header must have Tahsil (not Ödenen (Tutar))');
    assert.match(financeJsContent, /<th[^>]*>Bekleyen<\/th>/, 'Table header must have Bekleyen (not Bekleyen (Tutar))');
    assert.match(financeJsContent, /<th[^>]*>Toplam<\/th>/, 'Table header must have Toplam (not Genel Toplam)');
    assert.match(financeJsContent, /<th[^>]*>İşlem<\/th>/, 'Table header must have İşlem (not İşlemler)');

    // Old verbose table header labels must NOT appear in the table header
    assert.doesNotMatch(financeJsContent, /<th[^>]*>Toplam Ders<\/th>/, 'Old header Toplam Ders must be removed');
    assert.doesNotMatch(financeJsContent, /<th[^>]*>Ödenen \(Tutar\)<\/th>/, 'Old header Ödenen (Tutar) must be removed');
    assert.doesNotMatch(financeJsContent, /<th[^>]*>Bekleyen \(Tutar\)<\/th>/, 'Old header Bekleyen (Tutar) must be removed');
    assert.doesNotMatch(financeJsContent, /<th[^>]*>Genel Toplam<\/th>/, 'Old header Genel Toplam must be removed');
    assert.doesNotMatch(financeJsContent, /<th[^>]*>İşlemler<\/th>/, 'Old header İşlemler must be removed');

    // Row density: compact cell padding
    assert.match(financeJsContent, /py-2\.5\s+px-3\s+sm:py-3\s+sm:px-3\.5/, 'Cells must use compact padding (py-2.5 px-3 sm:py-3 sm:px-3.5)');

    // WhatsApp action button touch target >= 44px
    assert.match(financeJsContent, /min-h-\[44px\]/, 'Hatırlat action button must satisfy min-h-[44px]');
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
    remove(...cls) { cls.forEach(c => c && this._classes.delete(c)); }
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

// Dynamic import of modules
const storeModule = await import('../store.js');
const financeModule = await import('../finance.js');

const { store } = storeModule;
const { renderFinanceReport } = financeModule;

function setupMockFinanceData(students, lessonsMap = {}) {
    mockElements.clear();
    mockElements.set('dynamic-content', new MockElement('div'));

    globalThis.window.isFirebaseActive = true;
    store.useFirestore = true;
    store.globalStudents = students;
    store.globalLessons = lessonsMap;
}

// ============================================================================
// PART 3: 20-STUDENT STRESS FIXTURE & FUNCTIONAL SCENARIOS
// ============================================================================

test('Scenario D: 20-Student Stress Fixture — 20 rows, accurate KPI sums, compact scannable table', () => {
    // 20 distinct students with diverse combinations
    const students = Array.from({ length: 20 }, (_, i) => {
        const id = `s-${i + 1}`;
        // Give some students 0 fee, others various fees
        const fee = i === 18 ? 0 : (i === 19 ? undefined : 500 + (i % 5) * 250);
        return {
            id,
            adSoyad: `Öğrenci ${i + 1} Uzun Soyadıoğlu`,
            dersUcreti: fee,
            veliTel: `055512345${i < 10 ? '0' + i : i}`,
            sinif: '8'
        };
    });

    const lessonsMap = {};
    // S1 to S5: Full paid
    for (let i = 0; i < 5; i++) {
        const sid = `s-${i + 1}`;
        lessonsMap[sid] = [
            { id: `l-${sid}-1`, tarih: '2026-03-01', ders: 'Fen', katilimDurumu: 'yapildi', odendi: true },
            { id: `l-${sid}-2`, tarih: '2026-03-08', ders: 'Fen', katilimDurumu: 'yapildi', odendi: true }
        ];
    }
    // S6 to S10: Partial paid (3 lessons: 2 paid, 1 pending)
    for (let i = 5; i < 10; i++) {
        const sid = `s-${i + 1}`;
        lessonsMap[sid] = [
            { id: `l-${sid}-1`, tarih: '2026-03-01', ders: 'Matematik', katilimDurumu: 'yapildi', odendi: true },
            { id: `l-${sid}-2`, tarih: '2026-03-08', ders: 'Matematik', katilimDurumu: 'yapildi', odendi: true },
            { id: `l-${sid}-3`, tarih: '2026-03-15', ders: 'Matematik', katilimDurumu: 'yapildi', odendi: false }
        ];
    }
    // S11 to S14: Unpaid (2 lessons pending)
    for (let i = 10; i < 14; i++) {
        const sid = `s-${i + 1}`;
        lessonsMap[sid] = [
            { id: `l-${sid}-1`, tarih: '2026-03-01', ders: 'Türkçe', katilimDurumu: 'yapildi', odendi: false },
            { id: `l-${sid}-2`, tarih: '2026-03-08', ders: 'Türkçe', katilimDurumu: 'yapildi', odendi: false }
        ];
    }
    // S15: Planned + Non-billable lessons
    lessonsMap['s-15'] = [
        { id: 'l-s15-1', tarih: '2026-03-01', ders: 'Fen', katilimDurumu: 'yapildi', odendi: true },
        { id: 'l-s15-2', tarih: '2026-03-08', ders: 'Fen', katilimDurumu: 'iptal', odendi: false },
        { id: 'l-s15-3', tarih: '2026-03-15', ders: 'Fen', katilimDurumu: 'planlandi', odendi: false }
    ];
    // S16: Zero lessons
    lessonsMap['s-16'] = [];
    // S17 to S20: Empty lessons
    for (let i = 16; i < 20; i++) {
        lessonsMap[`s-${i + 1}`] = [];
    }

    setupMockFinanceData(students, lessonsMap);
    renderFinanceReport();

    const output = document.getElementById('dynamic-content').innerHTML;

    // 1. Verify all 20 students render in table rows
    for (let i = 0; i < 20; i++) {
        assert.ok(output.includes(`Öğrenci ${i + 1} Uzun Soyadıoğlu`), `Must render student ${i + 1}`);
    }

    // 2. Verify table headers
    assert.ok(output.includes('>Öğrenci<'), 'Must show Öğrenci header');
    assert.ok(output.includes('>Ders Ücreti<'), 'Must show Ders Ücreti header');
    assert.ok(output.includes('>Ders<'), 'Must show Ders header');
    assert.ok(output.includes('>Tahsil<'), 'Must show Tahsil header');
    assert.ok(output.includes('>Bekleyen<'), 'Must show Bekleyen header');
    assert.ok(output.includes('>Toplam<'), 'Must show Toplam header');
    assert.ok(output.includes('>İşlem<'), 'Must show İşlem header');

    // 3. Verify KPI card counts and explicit semantics
    // 18 students have fee > 0, 2 students have 0 or undefined fee
    assert.match(output, /18\s+aktif\s+\/\s+20\s+toplam/, 'Must show 18 aktif / 20 toplam');

    // 4. Verify Borç Yok state for students with 0 pending
    assert.match(output, /Borç Yok/, 'Must render Borç Yok for students without debt');

    // 5. Verify Hatırlat action for students with pending amount
    assert.match(output, /Hatırlat/, 'Must render Hatırlat for indebted students');
});

test('Scenario E: Zero secondary info test — when ucretDisi=0 and planlandi=0, secondary line is omitted', () => {
    const students = [
        { id: 's-clean', adSoyad: 'Ali Temiz', dersUcreti: 1000, veliTel: '05551112233' }
    ];
    const lessons = {
        's-clean': [
            { id: 'l1', tarih: '2026-03-01', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l2', tarih: '2026-03-08', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l3', tarih: '2026-03-15', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l4', tarih: '2026-03-22', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l5', tarih: '2026-03-29', katilimDurumu: 'yapildi', odendi: false }
        ]
    };

    setupMockFinanceData(students, lessons);
    renderFinanceReport();

    const output = document.getElementById('dynamic-content').innerHTML;

    // Must show main count 5
    assert.ok(output.includes('5'), 'Must render lesson count 5');

    // Must NOT show "0 ücret dışı" or "0 planlandı"
    assert.doesNotMatch(output, /0\s*ücret dışı/, 'Must NOT show 0 ücret dışı');
    assert.doesNotMatch(output, /0\s*planlandı/, 'Must NOT show 0 planlandı');
    assert.doesNotMatch(output, /0\s*planlı/, 'Must NOT show 0 planlı');
});

test('Scenario F: Positive secondary info test — positive ucretDisi and planlandi are rendered clearly', () => {
    // Case 1: Both ucretDisi and planlandi > 0
    const students = [
        { id: 's-mixed', adSoyad: 'Veli Karışık', dersUcreti: 1000, veliTel: '05551112233' }
    ];
    const lessons = {
        's-mixed': [
            { id: 'l1', tarih: '2026-03-01', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l2', tarih: '2026-03-08', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l3', tarih: '2026-03-15', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l4', tarih: '2026-03-22', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l5', tarih: '2026-03-29', katilimDurumu: 'yapildi', odendi: false },
            { id: 'l6', tarih: '2026-04-05', katilimDurumu: 'iptal', odendi: false }, // 1 ucretDisi
            { id: 'l7', tarih: '2026-04-12', katilimDurumu: 'planlandi', odendi: false }, // 1 planli
            { id: 'l8', tarih: '2026-04-19', katilimDurumu: 'planlandi', odendi: false }  // 2 planli
        ]
    };

    setupMockFinanceData(students, lessons);
    renderFinanceReport();

    const output = document.getElementById('dynamic-content').innerHTML;

    // Must show secondary info: 1 ücret dışı · 2 planlı
    assert.match(output, /1\s*ücret dışı\s*·\s*2\s*planlı/, 'Must render 1 ücret dışı · 2 planlı');
});

test('Scenario G: Single positive secondary info tests (only ucretDisi OR only planlandi)', () => {
    // Subcase 1: Only ucretDisi
    const students1 = [{ id: 's-only-ud', adSoyad: 'Sadece Ücret Dışı', dersUcreti: 1000 }];
    const lessons1 = {
        's-only-ud': [
            { id: 'l1', tarih: '2026-03-01', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l2', tarih: '2026-03-08', katilimDurumu: 'mazeretli', odendi: false }
        ]
    };
    setupMockFinanceData(students1, lessons1);
    renderFinanceReport();
    let output = document.getElementById('dynamic-content').innerHTML;
    assert.match(output, /1\s*ücret dışı/, 'Must show 1 ücret dışı');
    assert.doesNotMatch(output, /planlı/, 'Must NOT show planlı if 0');

    // Subcase 2: Only planlandi
    const students2 = [{ id: 's-only-pl', adSoyad: 'Sadece Planlı', dersUcreti: 1000 }];
    const lessons2 = {
        's-only-pl': [
            { id: 'l1', tarih: '2026-03-01', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l2', tarih: '2026-03-08', katilimDurumu: 'planlandi', odendi: false },
            { id: 'l3', tarih: '2026-03-15', katilimDurumu: 'planlandi', odendi: false }
        ]
    };
    setupMockFinanceData(students2, lessons2);
    renderFinanceReport();
    output = document.getElementById('dynamic-content').innerHTML;
    assert.match(output, /2\s*planlı/, 'Must show 2 planlı');
    assert.doesNotMatch(output, /ücret dışı/, 'Must NOT show ücret dışı if 0');
});

test('Scenario H: Zero lesson student — renders 0 with no secondary text', () => {
    const students = [
        { id: 's-zero', adSoyad: 'Sıfır Dersli', dersUcreti: 800 }
    ];
    const lessons = { 's-zero': [] };

    setupMockFinanceData(students, lessons);
    renderFinanceReport();

    const output = document.getElementById('dynamic-content').innerHTML;

    // Must show 0
    assert.ok(output.includes('>0<'), 'Must show 0 lessons');
    assert.doesNotMatch(output, /0\s*ücret dışı/, 'Must NOT show 0 ücret dışı');
    assert.doesNotMatch(output, /0\s*planlandı/, 'Must NOT show 0 planlandı');
    assert.doesNotMatch(output, /0\s*planlı/, 'Must NOT show 0 planlı');
});

test('Scenario I: Debt-Free State — renders Borç Yok badge and no Hatırlat button', () => {
    const students = [
        { id: 's-debt-free', adSoyad: 'Borçsuz Öğrenci', dersUcreti: 1200, veliTel: '05559998877' }
    ];
    const lessons = {
        's-debt-free': [
            { id: 'l1', tarih: '2026-03-01', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l2', tarih: '2026-03-08', katilimDurumu: 'yapildi', odendi: true }
        ]
    };

    setupMockFinanceData(students, lessons);
    renderFinanceReport();

    const output = document.getElementById('dynamic-content').innerHTML;

    assert.ok(output.includes('Borç Yok'), 'Must show Borç Yok');
    assert.doesNotMatch(output, /Hatırlat/, 'Must NOT show Hatırlat when no debt');
});

test('Scenario J: Indebted State — renders Hatırlat button with WhatsApp URI and >=44px touch target', () => {
    const students = [
        { id: 's-indebted', adSoyad: 'Borçlu Öğrenci', dersUcreti: 1500, veliTel: '05551234567' }
    ];
    const lessons = {
        's-indebted': [
            { id: 'l1', tarih: '2026-03-01', katilimDurumu: 'yapildi', odendi: false }
        ]
    };

    setupMockFinanceData(students, lessons);
    renderFinanceReport();

    const output = document.getElementById('dynamic-content').innerHTML;

    assert.ok(output.includes('Hatırlat'), 'Must show Hatırlat button');
    assert.ok(output.includes('api.whatsapp.com/send?phone=905551234567'), 'Must generate valid WhatsApp URL with Turkish country code');
    assert.match(output, /min-h-\[44px\]/, 'Must have min-h-[44px]');
    assert.doesNotMatch(output, /Borç Yok/, 'Must NOT show Borç Yok when indebted');
});

test('Scenario K: Color Semantics in Table Cells', () => {
    const students = [
        { id: 's-colors', adSoyad: 'Renk Test', dersUcreti: 1000 }
    ];
    const lessons = {
        's-colors': [
            { id: 'l1', tarih: '2026-03-01', katilimDurumu: 'yapildi', odendi: true },
            { id: 'l2', tarih: '2026-03-08', katilimDurumu: 'yapildi', odendi: false }
        ]
    };

    setupMockFinanceData(students, lessons);
    renderFinanceReport();

    const output = document.getElementById('dynamic-content').innerHTML;

    // Tahsil must be green/emerald
    assert.match(output, /text-emerald-600.*?>1\s*\(1000\s*TL\)<\/td>/, 'Paid amount must use emerald text');
    // Bekleyen must be amber
    assert.match(output, /text-amber-600.*?>1\s*\(1000\s*TL\)<\/td>/, 'Pending amount must use amber text');
    // Toplam must be indigo
    assert.match(output, /text-indigo-600.*?>2000\s*TL<\/td>/, 'Total amount must use indigo text');
});
