import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const scheduleJsContent = fs.readFileSync(path.join(ROOT, 'schedule.js'), 'utf8');

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
        'students.js',
        'homework.js'
    ];

    for (const file of protectedFiles) {
        const diff = execSync(`git diff HEAD -- ${file}`, { encoding: 'utf8' }).trim();
        assert.equal(diff, '', `${file} must have 0 diff against HEAD`);
    }
});

test('Scenario B: No destructive database operations in schedule.js', () => {
    assert.doesNotMatch(scheduleJsContent, /localStorage\.clear\s*\(/);
    assert.doesNotMatch(scheduleJsContent, /indexedDB\.deleteDatabase\s*\(/);
    assert.doesNotMatch(scheduleJsContent, /clearPersistence\s*\(/);
    assert.doesNotMatch(scheduleJsContent, /deleteDoc\s*\(/);
    assert.doesNotMatch(scheduleJsContent, /setDoc\s*\(/);
});

test('Scenario C: Architecture elements exist in schedule.js', () => {
    // Compact summary container
    assert.match(scheduleJsContent, /id="schedule-compact-summary"/, 'Compact summary bar must be present');
    // Compact student filter dropdown
    assert.match(scheduleJsContent, /id="scheduleStudentSelect"/, 'Student filter select must be present');
    // Day column class
    assert.match(scheduleJsContent, /cf-day-column/, 'cf-day-column class must exist');
    // Helper exports
    assert.match(scheduleJsContent, /getScheduleBranchTagClasses/, 'getScheduleBranchTagClasses must be defined');
    assert.match(scheduleJsContent, /getScheduleGradeBadgeClasses/, 'getScheduleGradeBadgeClasses must be defined');
    assert.match(scheduleJsContent, /getScheduleBranchShortLabel/, 'getScheduleBranchShortLabel must be defined');
    // Dersler sub-tab bar preserved
    assert.match(scheduleJsContent, /renderDerslerTabBarHtml\('schedule'\)/, 'Dersler tab bar must be preserved');
    // 4 large KPI cards grid removed
    assert.doesNotMatch(scheduleJsContent, /grid-cols-2\s+lg:grid-cols-4\s+gap-3\s+md:gap-4\s+mb-5/, 'Large 4-card grid must be removed');
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
    set innerHTML(val) {
        this._innerHTML = val;
    }
    addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }
    dispatchEvent(event) {
        const fns = this.listeners[event.type] || [];
        fns.forEach(fn => fn(event));
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
}

const elementsById = new Map();

globalThis.document = {
    getElementById: (id) => {
        if (!elementsById.has(id)) {
            const el = new MockElement();
            el.id = id;
            elementsById.set(id, el);
        }
        return elementsById.get(id);
    },
    createElement: (tag) => new MockElement(tag),
    querySelector: (sel) => {
        if (sel.startsWith('#')) return globalThis.document.getElementById(sel.slice(1));
        return null;
    },
    querySelectorAll: () => [],
    body: new MockElement('body'),
    head: new MockElement('head')
};

// Dynamic imports
const storeModule = await import('../store.js');
const { store } = storeModule;
const scheduleModule = await import('../schedule.js');
const {
    getScheduleBranchTagClasses,
    getScheduleGradeBadgeClasses,
    getScheduleBranchShortLabel,
    renderSchedulePage
} = scheduleModule;

// ============================================================================
// PART 3: HELPER FUNCTIONS UNIT TESTS
// ============================================================================

test('Scenario D: getScheduleBranchTagClasses returns pastel high-contrast classes per branch', () => {
    // Fen
    const fen = getScheduleBranchTagClasses('Fen Bilimleri');
    assert.match(fen, /cyan/, 'Fen must use cyan palette');
    assert.match(fen, /dark:text-cyan-300/, 'Fen must support dark mode text');

    // Matematik
    const mat = getScheduleBranchTagClasses('Matematik');
    assert.match(mat, /purple/, 'Matematik must use purple/violet palette');

    // Türkçe
    const turk = getScheduleBranchTagClasses('Türkçe');
    assert.match(turk, /rose/, 'Türkçe must use rose/red palette');

    // İngilizce
    const ing = getScheduleBranchTagClasses('İngilizce');
    assert.match(ing, /emerald/, 'İngilizce must use emerald/green palette');

    // Sosyal / İnkılap
    const sos = getScheduleBranchTagClasses('Sosyal Bilgiler');
    assert.match(sos, /amber/, 'Sosyal Bilgiler must use amber/orange palette');
    const ink = getScheduleBranchTagClasses('İnkılap Tarihi');
    assert.match(ink, /amber/, 'İnkılap Tarihi must use amber/orange palette');

    // Din Kültürü
    const din = getScheduleBranchTagClasses('Din Kültürü');
    assert.match(din, /indigo/, 'Din Kültürü must use indigo palette');

    // Unknown / Other fallback
    const unknown = getScheduleBranchTagClasses('Bilinmeyen Ders');
    assert.match(unknown, /slate/, 'Unknown branch must use safe slate/gray neutral fallback');
    const empty = getScheduleBranchTagClasses('');
    assert.match(empty, /slate/, 'Empty branch must use safe slate/gray neutral fallback');
});

test('Scenario E: getScheduleGradeBadgeClasses returns grade palette matching students page', () => {
    // 5th grade -> emerald
    assert.match(getScheduleGradeBadgeClasses('5'), /emerald/);
    assert.match(getScheduleGradeBadgeClasses('5. Sınıf'), /emerald/);

    // 6th grade -> sky
    assert.match(getScheduleGradeBadgeClasses('6'), /sky/);
    assert.match(getScheduleGradeBadgeClasses('6. Sınıf'), /sky/);

    // 7th grade -> amber
    assert.match(getScheduleGradeBadgeClasses('7'), /amber/);
    assert.match(getScheduleGradeBadgeClasses('7. Sınıf'), /amber/);

    // 8th grade -> indigo
    assert.match(getScheduleGradeBadgeClasses('8'), /indigo/);
    assert.match(getScheduleGradeBadgeClasses('8. Sınıf'), /indigo/);

    // Fallback
    assert.match(getScheduleGradeBadgeClasses(''), /gray/);
    assert.match(getScheduleGradeBadgeClasses(null), /gray/);
});

test('Scenario F: getScheduleBranchShortLabel formats branch names concisely', () => {
    assert.equal(getScheduleBranchShortLabel('Fen Bilimleri'), 'Fen');
    assert.equal(getScheduleBranchShortLabel('Sosyal Bilgiler'), 'Sosyal');
    assert.equal(getScheduleBranchShortLabel('İnkılap Tarihi'), 'İnkılap');
    assert.equal(getScheduleBranchShortLabel('Matematik'), 'Matematik');
    assert.equal(getScheduleBranchShortLabel('Türkçe'), 'Türkçe');
    assert.equal(getScheduleBranchShortLabel(''), 'Ders');
});

// ============================================================================
// PART 4: RUNTIME RENDER TESTS
// ============================================================================

function setupMockData(students, schedules = {}) {
    store.useFirestore = true;
    window.isFirebaseActive = true;
    store.globalStudents = [...students];
    store.students = [...students];
    store.globalSchedules = { ...schedules };
}

test('Scenario G: Summary metrics calculation with 2 lessons, 2 students, 5 empty days', () => {
    setupMockData(
        [
            { id: 's1', adSoyad: 'Ali Kaya', sinif: '8' },
            { id: 's2', adSoyad: 'Ayşe Demir', sinif: '7' }
        ],
        {
            's1': [{ gun: 'Pazartesi', saat: '16:00', dersAdi: 'Fen Bilimleri', aktif: true }],
            's2': [{ gun: 'Salı', saat: '17:00', dersAdi: 'Matematik', aktif: true }]
        }
    );
    window._scheduleSelectedStudentId = 'all';

    renderSchedulePage();

    const output = document.getElementById('dynamic-content').innerHTML;

    // Check compact summary bar exists
    assert.ok(output.includes('id="schedule-compact-summary"'), 'Summary bar must exist');
    // Total lessons: 2
    assert.match(output, />2<\/[^>]*>\s*Ders/, 'Must show 2 Ders');
    // Students count: 2
    assert.match(output, />2<\/[^>]*>\s*Öğrenci/, 'Must show 2 Öğrenci');
    // Empty days: 5 (Pazartesi and Salı have lessons, 5 days are empty)
    assert.match(output, /5 Boş Gün/, 'Must show 5 Boş Gün');
});

test('Scenario H: Day columns and compact empty day rendering (Pazartesi=1, Salı=1, other 5=0)', () => {
    setupMockData(
        [
            { id: 's1', adSoyad: 'Ali Kaya', sinif: '8' },
            { id: 's2', adSoyad: 'Ayşe Demir', sinif: '7' }
        ],
        {
            's1': [{ gun: 'Pazartesi', saat: '16:00', dersAdi: 'Fen Bilimleri', aktif: true }],
            's2': [{ gun: 'Salı', saat: '17:00', dersAdi: 'Matematik', aktif: true }]
        }
    );
    window._scheduleSelectedStudentId = 'all';

    renderSchedulePage();

    const output = document.getElementById('dynamic-content').innerHTML;

    // Check all 7 days rendered
    const days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    for (const d of days) {
        assert.ok(output.includes(d), `Column for ${d} must be present`);
    }

    // Empty days must show compact "0 ders"
    assert.match(output, /0 ders/, 'Empty days must render compact 0 ders');
    // Must NOT have large "Ders planlanmadı" blocks
    assert.doesNotMatch(output, /Ders planlanmadı/, 'Must not show large placeholder Ders planlanmadı');
});

test('Scenario I: Lesson card structure contains Saat, Student, Branch tag, Class badge, Edit, Delete', () => {
    setupMockData(
        [
            { id: 's1', adSoyad: 'Şimal Güler', sinif: '8' }
        ],
        {
            's1': [{ gun: 'Pazartesi', saat: '16:00', dersAdi: 'Fen Bilimleri', aktif: true }]
        }
    );
    window._scheduleSelectedStudentId = 'all';
    window._activeScheduleDay = 'Pazartesi';

    renderSchedulePage();

    const output = document.getElementById('dynamic-content').innerHTML;

    // Time: 16:00
    assert.ok(output.includes('16:00'), 'Card must show 16:00');
    // Student Name: Şimal Güler
    assert.ok(output.includes('Şimal Güler'), 'Card must show student name');
    // Branch tag: Fen
    assert.ok(output.includes('Fen'), 'Card must show branch tag');
    // Class badge: 8. Sınıf
    assert.ok(output.includes('8. Sınıf'), 'Card must show 8. Sınıf');
    // Actions: Edit and Delete
    assert.ok(output.includes('editScheduleLesson'), 'Card must have edit button');
    assert.ok(output.includes('deleteScheduleLesson'), 'Card must have delete button');
    assert.ok(output.includes('event.stopPropagation()'), 'Action buttons must stop propagation');
    // Mobile touch target >= 44px
    assert.match(output, /min-h-\[44px\]\s+min-w-\[44px\]/, 'Mobile actions must satisfy >=44px touch targets');
});

test('Scenario J: Student filter selects single student and filters day counts', () => {
    setupMockData(
        [
            { id: 's1', adSoyad: 'Ali Kaya', sinif: '8' },
            { id: 's2', adSoyad: 'Ayşe Demir', sinif: '7' }
        ],
        {
            's1': [{ gun: 'Pazartesi', saat: '16:00', dersAdi: 'Fen Bilimleri', aktif: true }],
            's2': [{ gun: 'Salı', saat: '17:00', dersAdi: 'Matematik', aktif: true }]
        }
    );

    // Filter to s1
    window._scheduleSelectedStudentId = 's1';
    renderSchedulePage();

    const output = document.getElementById('dynamic-content').innerHTML;

    // Must show 1 lesson in summary
    assert.match(output, />1<\/[^>]*>\s*Ders/, 'Filtered summary must show 1 Ders');
    assert.match(output, />1<\/[^>]*>\s*Öğrenci/, 'Filtered summary must show 1 Öğrenci');
    // Ali Kaya visible
    assert.ok(output.includes('Ali Kaya'), 'Ali Kaya must be visible');
    // Ayşe Demir not in cards
    assert.ok(!output.includes('Ayşe Demir</div>'), 'Ayşe Demir card must not be rendered when filtered to Ali');

    // Reset filter
    window._scheduleSelectedStudentId = 'all';
});

test('Scenario K: Action functions are defined and safely callable', () => {
    assert.equal(typeof window.showAddScheduleModal, 'function');
    assert.equal(typeof window.showEditScheduleModal, 'function');
    assert.equal(typeof window.deleteScheduleLesson, 'function');
    assert.equal(typeof window.editScheduleLesson, 'function');
    assert.equal(typeof window.setScheduleActiveDay, 'function');
});

test('Scenario L: Empty week scenario (0 lessons) displays quiet empty indicator without breaking', () => {
    setupMockData(
        [
            { id: 's1', adSoyad: 'Ali Kaya', sinif: '8' }
        ],
        {
            's1': []
        }
    );
    window._scheduleSelectedStudentId = 'all';

    renderSchedulePage();

    const output = document.getElementById('dynamic-content').innerHTML;
    assert.ok(output.includes('Bu hafta planlanmış ders yok.'), 'Should show calm empty week message');
    assert.match(output, />0<\/[^>]*>\s*Ders/, 'Must show 0 Ders in summary');
    assert.match(output, /7 Boş Gün/, 'Must show 7 Boş Gün');
});

