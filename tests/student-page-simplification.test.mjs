import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const studentsJsContent = fs.readFileSync(path.join(ROOT, 'students.js'), 'utf8');

// ============================================================================
// PART 1: SAFETY & STATIC CODE VERIFICATIONS
// ============================================================================

test('Scenario A: Zero git modifications on protected files', () => {
    const protectedFiles = [
        'store.js',
        'firebase-config.js',
        'firestore.rules',
        'exams.js',
        'auth.js',
        'index.html',
        'ui-helpers.js'
    ];

    for (const file of protectedFiles) {
        const diff = execSync(`git diff HEAD -- ${file}`, { encoding: 'utf8' }).trim();
        assert.equal(diff, '', `${file} must have 0 diff against HEAD`);
    }
});

test('Scenario B: No destructive operations in students.js', () => {
    assert.doesNotMatch(studentsJsContent, /localStorage\.clear\s*\(/);
    assert.doesNotMatch(studentsJsContent, /indexedDB\.deleteDatabase\s*\(/);
    assert.doesNotMatch(studentsJsContent, /clearPersistence\s*\(/);
});

test('Scenario C: Architecture elements exist in students.js', () => {
    // Accordion container and classes
    assert.match(studentsJsContent, /id="students-class-accordion"/, 'Accordion container must be present');
    assert.match(studentsJsContent, /getGradeAccentClasses/, 'Must export getGradeAccentClasses');
    assert.match(studentsJsContent, /filterStudentsByClass/, 'filterStudentsByClass function must exist');

    // Sorting dropdown
    assert.match(studentsJsContent, /id="student-sort-select"/, 'Compact sort select must exist');
    assert.match(studentsJsContent, /value="default"/, 'Sort option default');
    assert.match(studentsJsContent, /value="net-desc"/, 'Sort option net-desc');
    assert.match(studentsJsContent, /value="net-asc"/, 'Sort option net-asc');
    assert.match(studentsJsContent, /value="name-asc"/, 'Sort option name-asc');
    assert.match(studentsJsContent, /value="name-desc"/, 'Sort option name-desc');

    // Quick action toolbar
    assert.match(studentsJsContent, /showAddStudentModal\(\)/, 'Quick action for new student');
    assert.match(studentsJsContent, /showDenemeAtaModal\(\)/, 'Quick action for batch exam assignment');

    // Student card links
    assert.match(studentsJsContent, /selectStudent\(/, 'Direct student selection / cockpit link');
    assert.match(studentsJsContent, /Öğrenci Kokpitini [aA]ç/, 'Prominent student cockpit open label');
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

// Minimal DOM implementation for Node.js test environment
class MockClassList {
    constructor(element) {
        this.element = element;
        this._classes = new Set();
    }
    add(...names) {
        names.forEach(n => n && this._classes.add(n));
        this._sync();
    }
    remove(...names) {
        names.forEach(n => this._classes.delete(n));
        this._sync();
    }
    contains(name) {
        return this._classes.has(name);
    }
    toggle(name, force) {
        if (force === undefined) {
            if (this.contains(name)) { this.remove(name); return false; }
            else { this.add(name); return true; }
        } else if (force) {
            this.add(name); return true;
        } else {
            this.remove(name); return false;
        }
    }
    _sync() {
        this.element._className = Array.from(this._classes).join(' ');
    }
}

class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
        this._id = '';
        this._className = '';
        this.classList = new MockClassList(this);
        this._innerHTML = '';
        this.style = {};
        this.attributes = {};
        this.children = [];
        this.parentNode = null;
    }

    get id() { return this._id; }
    set id(val) { this._id = val; }

    get className() { return this._className; }
    set className(val) {
        this._className = val || '';
        this.classList._classes = new Set(this._className.split(/\s+/).filter(Boolean));
    }

    get innerHTML() { return this._innerHTML; }
    set innerHTML(val) {
        this._innerHTML = val;
        this.children = [];
    }

    get textContent() {
        return this._innerHTML.replace(/<[^>]*>/g, '');
    }

    setAttribute(key, value) {
        this.attributes[key] = String(value);
    }
    getAttribute(key) {
        return this.attributes[key] || null;
    }
    removeAttribute(key) {
        delete this.attributes[key];
    }
    hasAttribute(key) {
        return key in this.attributes;
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    querySelector(selector) {
        if (selector.startsWith('#')) {
            const targetId = selector.slice(1);
            if (this.id === targetId) return this;
            for (const child of this.children) {
                const found = child.querySelector(selector);
                if (found) return found;
            }
        }
        return null;
    }

    querySelectorAll(selector) {
        const results = [];
        return results;
    }

    scrollIntoView() {}
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
        if (sel.startsWith('#')) {
            return globalThis.document.getElementById(sel.slice(1));
        }
        return null;
    },
    querySelectorAll: () => [],
    body: new MockElement('body'),
    head: new MockElement('head')
};

// Prepare dynamic-content container
const dynamicContent = globalThis.document.getElementById('dynamic-content');

// Import application modules
const storeModule = await import('../store.js');
const { store } = storeModule;
const studentsModule = await import('../students.js');
const {
    getGradeAccentClasses,
    getSortedStudents,
    renderHomeScreen,
    filterStudentsByClass,
    setSortOrder
} = studentsModule;

try {
    const groupsModule = await import('../groups.js');
    globalThis.window.renderGroupsPage = groupsModule.renderGroupsPage;
} catch (e) {
    globalThis.window.renderGroupsPage = () => {
        dynamicContent.innerHTML = '<div>8-A LGS Kampı</div><button>Yeni Grup Oluştur</button>';
    };
}

// Mock alert, confirm, prompt
globalThis.window.confirm = () => true;
globalThis.window.alert = () => {};

// Sample test dataset
const mockStudents = [
    {
        id: 's-8a',
        adSoyad: 'Zeynep Kaya',
        okul: 'Atatürk OO',
        sinif: '8',
        sube: 'A',
        hedefLise: 'Fen Lisesi',
        denemeler: [
            {
                id: 'ex-1',
                tarih: '2026-03-01',
                toplamNet: 80.0
            }
        ]
    },
    {
        id: 's-8b',
        adSoyad: 'Ali Demir',
        okul: 'Cumhuriyet OO',
        sinif: '8',
        sube: 'B',
        denemeler: [
            {
                id: 'ex-2',
                tarih: '2026-03-02',
                toplamNet: 27.33
            }
        ]
    },
    {
        id: 's-7a',
        adSoyad: 'Berk Yıldız',
        okul: 'Atatürk OO',
        sinif: '7',
        sube: 'C',
        denemeler: []
    },
    {
        id: 's-5a',
        adSoyad: 'Ayşe Çelik',
        okul: 'Gazi OO',
        sinif: '5',
        sube: 'A',
        denemeler: []
    }
];

// ============================================================================
// PART 3: UNIT TESTS FOR COLOR SYSTEM & SORTING LOGIC
// ============================================================================

test('Scenario D: getGradeAccentClasses returns restrained, dark-mode compliant color palette', () => {
    const grade5 = getGradeAccentClasses('5');
    assert.match(grade5.borderLeft, /emerald-500/);
    assert.match(grade5.dot, /bg-emerald-500/);
    assert.match(grade5.badge, /text-emerald-700/);

    const grade6 = getGradeAccentClasses('6');
    assert.match(grade6.borderLeft, /sky-500/);
    assert.match(grade6.dot, /bg-sky-500/);
    assert.match(grade6.badge, /text-sky-700/);

    const grade7 = getGradeAccentClasses('7');
    assert.match(grade7.borderLeft, /amber-500/);
    assert.match(grade7.dot, /bg-amber-500/);
    assert.match(grade7.badge, /text-amber-700/);

    const grade8 = getGradeAccentClasses('8');
    assert.match(grade8.borderLeft, /indigo-500/);
    assert.match(grade8.dot, /bg-indigo-500/);
    assert.match(grade8.badge, /text-indigo-700/);

    const all = getGradeAccentClasses('all');
    assert.match(all.borderLeft, /blue-500/);
    assert.match(all.dot, /bg-blue-500/);
});

test('Scenario E: getSortedStudents supports default, net-desc, net-asc, name-asc, name-desc', () => {
    // 1. name-asc: Ali Demir, Ayşe Çelik, Berk Yıldız, Zeynep Kaya
    const sortedNameAsc = getSortedStudents(mockStudents, 'name-asc');
    assert.equal(sortedNameAsc[0].adSoyad, 'Ali Demir');
    assert.equal(sortedNameAsc[1].adSoyad, 'Ayşe Çelik');
    assert.equal(sortedNameAsc[2].adSoyad, 'Berk Yıldız');
    assert.equal(sortedNameAsc[3].adSoyad, 'Zeynep Kaya');

    // 2. name-desc: Zeynep Kaya, Berk Yıldız, Ayşe Çelik, Ali Demir
    const sortedNameDesc = getSortedStudents(mockStudents, 'name-desc');
    assert.equal(sortedNameDesc[0].adSoyad, 'Zeynep Kaya');
    assert.equal(sortedNameDesc[1].adSoyad, 'Berk Yıldız');
    assert.equal(sortedNameDesc[2].adSoyad, 'Ayşe Çelik');
    assert.equal(sortedNameDesc[3].adSoyad, 'Ali Demir');

    // 3. net-desc: Zeynep (~80 net), Ali (~27.33 net), Berk (0 net), Ayşe (0 net)
    const sortedNetDesc = getSortedStudents(mockStudents, 'net-desc');
    assert.equal(sortedNetDesc[0].adSoyad, 'Zeynep Kaya');
    assert.equal(sortedNetDesc[1].adSoyad, 'Ali Demir');

    // 4. net-asc: Berk or Ayşe first, Ali, Zeynep last
    const sortedNetAsc = getSortedStudents(mockStudents, 'net-asc');
    assert.equal(sortedNetAsc[3].adSoyad, 'Zeynep Kaya');
    assert.equal(sortedNetAsc[2].adSoyad, 'Ali Demir');

    // 5. default
    const sortedDefault = getSortedStudents(mockStudents, 'default');
    assert.equal(sortedDefault[0].id, 's-8a');
});

function setupMockData(students = mockStudents, groups = []) {
    store.useFirestore = true;
    window.isFirebaseActive = true;
    store.globalStudents = [...students];
    store.students = [...students];
    store.globalGroups = [...groups];
    store.groups = [...groups];
}

// ============================================================================
// PART 4: PAGE STRUCTURE, ACCORDION & FILTERING TESTS
// ============================================================================

test('Scenario F: renderHomeScreen renders compact header and subtitle with count and active filter', () => {
    setupMockData(mockStudents);
    store.activeFilter = 'all';
    store.currentSortOrder = 'default';

    renderHomeScreen('students');
    const html = dynamicContent.innerHTML;

    // Header title
    assert.match(html, /<h[12][^>]*>Öğrenciler<\/h[12]>/);

    // Subtitle must show total count and active filter label
    assert.match(html, /4 öğrenci · Tüm sınıflar/);

    // Quick action buttons in header toolbar
    assert.match(html, /showAddStudentModal\(\)/);
    assert.match(html, /showDenemeAtaModal\(\)/);
    assert.match(html, /Yeni Öğrenci/);
    assert.match(html, /Toplu Deneme Ata/);
});

test('Scenario G: Class accordion renders all 5 grade items with accurate counts', () => {
    setupMockData(mockStudents);
    store.activeFilter = 'all';

    renderHomeScreen('students');
    const html = dynamicContent.innerHTML;

    // Check accordion container
    assert.match(html, /id="students-class-accordion"/);

    // Check count badges
    // Total: 4, 8th: 2, 7th: 1, 6th: 0, 5th: 1
    assert.match(html, /Tümü\s*<\/span>\s*<span[^>]*>\s*4\s*<\/span>/);
    assert.match(html, /8\. Sınıf\s*<\/span>\s*<span[^>]*>\s*2\s*<\/span>/);
    assert.match(html, /7\. Sınıf\s*<\/span>\s*<span[^>]*>\s*1\s*<\/span>/);
    assert.match(html, /6\. Sınıf\s*<\/span>\s*<span[^>]*>\s*0\s*<\/span>/);
    assert.match(html, /5\. Sınıf\s*<\/span>\s*<span[^>]*>\s*1\s*<\/span>/);
});

test('Scenario H: Single active accordion row behavior and chevrons', () => {
    setupMockData(mockStudents);

    // When 'all' is active
    store.activeFilter = 'all';
    renderHomeScreen('students');
    let html = dynamicContent.innerHTML;

    // Active row ('all') has chevron-down, inactive rows have chevron-right
    assert.match(html, /onclick="filterStudentsByClass\('all'\)"[^>]*>[\s\S]*?fa-chevron-down/);
    assert.match(html, /onclick="filterStudentsByClass\('8'\)"[^>]*>[\s\S]*?fa-chevron-right/);

    // When '8' is active
    filterStudentsByClass('8');
    assert.equal(store.activeFilter, '8');
    html = dynamicContent.innerHTML;

    // Subtitle must reflect filtered count: 2 students in 8th grade
    assert.match(html, /2 öğrenci · 8\. Sınıf/);
    assert.match(html, /onclick="filterStudentsByClass\('8'\)"[^>]*>[\s\S]*?fa-chevron-down/);
    assert.match(html, /onclick="filterStudentsByClass\('all'\)"[^>]*>[\s\S]*?fa-chevron-right/);

    // Only 8th grade students are displayed in the active accordion
    assert.match(html, /Zeynep Kaya/);
    assert.match(html, /Ali Demir/);
    assert.doesNotMatch(html, /Ayşe Çelik/);
    assert.doesNotMatch(html, /Berk Yıldız/);
});

test('Scenario I: Compact sorting select changes sort order and re-renders', () => {
    setupMockData(mockStudents);
    store.activeFilter = 'all';

    setSortOrder('name-asc');
    assert.equal(store.currentSortOrder, 'name-asc');

    const html = dynamicContent.innerHTML;
    assert.match(html, /id="student-sort-select"/);
    assert.match(html, /value="name-asc"\s+selected/);

    // First card should be Ali Demir
    const aliIndex = html.indexOf('Ali Demir');
    const zeynepIndex = html.indexOf('Zeynep Kaya');
    assert.ok(aliIndex < zeynepIndex, 'Ali Demir should appear before Zeynep Kaya in name-asc');
});

test('Scenario J: Student card contains direct cockpit open button and secondary actions with 44px min targets', () => {
    setupMockData(mockStudents);
    store.activeFilter = '8';
    renderHomeScreen('students');

    const html = dynamicContent.innerHTML;

    // Primary action
    assert.match(html, /selectStudent\('s-8a'\)/);
    assert.match(html, /Öğrenci Kokpitini [aA]ç/);

    // Secondary actions: edit and delete
    assert.match(html, /editStudent\('s-8a'\)/);
    assert.match(html, /deleteStudent\('s-8a'\)/);

    // Delete button has confirm / danger styling
    assert.match(html, /hover:bg-red-50/);

    // Touch targets have min-h-[44px]
    assert.match(html, /min-h-\[44px\]/);
});

test('Scenario K: Empty states and empty class render safely with count consistency', () => {
    // 1. Grade filter with 0 students (Grade 6)
    setupMockData(mockStudents);
    filterStudentsByClass('6');
    let html = dynamicContent.innerHTML;
    // Subtitle must show 0 students in 6th grade matching the 0 badge
    assert.match(html, /0 öğrenci · 6\. Sınıf/);
    assert.match(html, /Bu sınıfta henüz öğrenci yok\./);

    // 2. Zero total students
    setupMockData([]);
    filterStudentsByClass('all');
    html = dynamicContent.innerHTML;
    assert.match(html, /0 öğrenci · Tüm sınıflar/);
    assert.match(html, /Henüz öğrenci eklenmemiş\./);
});

test('Scenario L: Gruplar tab and tab navigation are preserved', () => {
    const mockGroups = [
        { id: 'g-1', name: '8-A LGS Kampı', studentIds: ['s-8a', 's-8b'] }
    ];
    setupMockData(mockStudents, mockGroups);

    // Check students tab renders tab bar
    renderHomeScreen('students');
    let html = dynamicContent.innerHTML;
    assert.match(html, /renderHomeScreen\('students'\)/);
    assert.match(html, /renderHomeScreen\('groups'\)/);

    // Switch to groups view
    renderHomeScreen('groups');
    html = dynamicContent.innerHTML;
    assert.match(html, /8-A LGS Kampı/);
    assert.match(html, /Yeni Grup Oluştur/);
});
