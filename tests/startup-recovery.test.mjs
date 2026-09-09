import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
    shouldRenderInitialView, 
    markStartupUserNavigation, 
    resetStartupUserNavigation,
    isStartupNavigationElement,
    userHasNavigatedDuringStartup 
} from '../ui-helpers.js';

function readProjectFile(relativePath) {
    return readFile(resolve(process.cwd(), relativePath), 'utf8');
}

// Mock DOM Element helper for unit testing isStartupNavigationElement
function createMockElement(id, classList = [], attributes = {}) {
    return {
        id,
        classList: {
            contains: (c) => classList.includes(c)
        },
        getAttribute: (attr) => attributes[attr] || null,
        closest: function(selector) {
            const selectors = selector.split(',').map(s => s.trim());
            for (const s of selectors) {
                if (s === '[data-app-nav="true"]' && attributes['data-app-nav'] === 'true') return this;
                if (s.startsWith('#') && s.slice(1) === id) return this;
                if (s.startsWith('.') && classList.includes(s.slice(1))) return this;
            }
            return null;
        }
    };
}

test('HOTFIX-01.4 Scenario A: Theme Toggle is NOT a navigation element (no false positive)', () => {
    const themeButton = createMockElement('themeBtn', ['sidebar-btn', 'cf-nav-item'], {});
    assert.equal(isStartupNavigationElement(themeButton), false, 'Theme toggle must not be treated as navigation element');
});

test('HOTFIX-01.4 Scenario B: Deneme Ata Modal is NOT a navigation element (no false positive)', () => {
    const denemeAtaButton = createMockElement('denemeAtaBtn', ['sidebar-btn', 'cf-nav-item'], {});
    assert.equal(isStartupNavigationElement(denemeAtaButton), false, 'Deneme Ata modal button must not be treated as navigation element');
});

test('HOTFIX-01.4 Scenario C: Students button IS a navigation element (true positive)', () => {
    const studentsButton = createMockElement('sidebar-nav-home', ['sidebar-btn'], { 'data-app-nav': 'true' });
    assert.equal(isStartupNavigationElement(studentsButton), true);
});

test('HOTFIX-01.4 Scenario D: Guidance button IS a navigation element (true positive)', () => {
    const guidanceButton = createMockElement('sidebar-nav-guidance', ['sidebar-btn'], { 'data-app-nav': 'true' });
    assert.equal(isStartupNavigationElement(guidanceButton), true);
});

test('HOTFIX-01.4 Scenario E: Ana Sayfa button IS a navigation element (true positive)', () => {
    const homeButton = createMockElement('sidebar-nav-reminders', ['sidebar-btn'], { 'data-app-nav': 'true' });
    assert.equal(isStartupNavigationElement(homeButton), true);
});

test('HOTFIX-01.4 Scenario F: Theme click during startup allows late Firestore sync to render dashboard', () => {
    resetStartupUserNavigation();
    const themeButton = createMockElement('themeBtn', ['sidebar-btn'], {});
    
    // Clicking theme button does not mark navigation
    if (isStartupNavigationElement(themeButton)) {
        markStartupUserNavigation();
    }
    
    // When Firestore completes later:
    const canRender = shouldRenderInitialView({ initialViewRendered: false, userHasNavigatedDuringStartup: userHasNavigatedDuringStartup });
    assert.equal(canRender, true, 'Dashboard must render even if user clicked dark mode during startup');
});

test('HOTFIX-01.4 Scenario G: HTML source audit - data-app-nav="true" only on route items', async () => {
    const index = await readProjectFile('index.html');
    
    // Confirmed route buttons have data-app-nav="true"
    assert.match(index, /id="sidebar-nav-reminders"\s+data-app-nav="true"/);
    assert.match(index, /id="sidebar-nav-home"\s+data-app-nav="true"/);
    assert.match(index, /id="sidebar-nav-lessons"\s+data-app-nav="true"/);
    assert.match(index, /id="sidebar-nav-homework"\s+data-app-nav="true"/);
    assert.match(index, /id="sidebar-nav-guidance"\s+data-app-nav="true"/);
    assert.match(index, /id="topbar-nav-general"\s+data-app-nav="true"/);

    // Non-route action buttons do NOT have data-app-nav="true"
    assert.doesNotMatch(index, /onclick="toggleTheme\(\)"\s+data-app-nav="true"/);
    assert.doesNotMatch(index, /onclick="showDenemeAtaModal\(\)"\s+data-app-nav="true"/);
});

test('HOTFIX-01.4 Scenario H: Explicit State - shouldRenderInitialView returns true when neither rendered nor navigated', () => {
    assert.equal(
        shouldRenderInitialView({ initialViewRendered: false, userHasNavigatedDuringStartup: false }),
        true,
        'Should render initial view on normal cold/login startup'
    );
});

test('HOTFIX-01.4 Scenario I: Explicit User Navigation - shouldRenderInitialView returns false when user navigated during startup', () => {
    assert.equal(
        shouldRenderInitialView({ initialViewRendered: false, userHasNavigatedDuringStartup: true }),
        false,
        'Should not overwrite view if user interacted with navigation'
    );
});

test('HOTFIX-01.4 Scenario J: Idempotency - shouldRenderInitialView returns false once initialViewRendered is true', () => {
    assert.equal(
        shouldRenderInitialView({ initialViewRendered: true, userHasNavigatedDuringStartup: false }),
        false,
        'Should not re-render if initial view was already rendered'
    );
});

test('HOTFIX-01.4 Scenario K: Login Success & Firestore Reject - renders dashboard when user has not navigated', () => {
    assert.equal(shouldRenderInitialView({ initialViewRendered: false, userHasNavigatedDuringStartup: false }), true);
});

test('HOTFIX-01.4 Scenario L: URL ?page=odevler - index.html preserves intended initial route', async () => {
    const index = await readProjectFile('index.html');
    assert.match(index, /const page = urlParams\.get\('page'\);/);
    assert.match(index, /if \(page === 'odevler' && window\.renderOdevTakibi\)/);
    assert.match(index, /window\.renderOdevTakibi\(\);/);
    assert.match(index, /else if \(window\.renderReminderHome\)/);
    assert.match(index, /window\.renderReminderHome\(\);/);
});

test('HOTFIX-01.4 Scenario M: Core startup excludes eager report and PDF modules', async () => {
    const [index, guidance] = await Promise.all([
        readProjectFile('index.html'),
        readProjectFile('guidance.js')
    ]);
    assert.doesNotMatch(index, /import '\.\/guidance-report-insights\.js'/);
    assert.doesNotMatch(index, /import '\.\/guidance-report-pdf\.js'/);
    const guidanceHeader = guidance.slice(0, guidance.indexOf('export function renderGuidancePage'));
    assert.doesNotMatch(guidanceHeader, /import\s+.*guidance-report-insights/);
    assert.doesNotMatch(guidanceHeader, /import\s+.*guidance-report-pdf/);
});

test('HOTFIX-01.4 Scenario N: Guidance Report Lazy Load with retry reset and user feedback', async () => {
    const guidance = await readProjectFile('guidance.js');
    assert.match(guidance, /export async function getGuidanceReportModules\(\)/);
    assert.match(guidance, /_reportModulesPromise = null;/);
    assert.match(guidance, /Rehberlik raporlama modülü yüklenemedi/);
});

test('HOTFIX-01.4 Scenario O: Boot Idempotency & single DOMContentLoaded strategy', async () => {
    const index = await readProjectFile('index.html');
    assert.match(index, /let isAppBooted = false;/);
    assert.match(index, /if \(isAppBooted\) return;\s*isAppBooted = true;/);
    assert.match(index, /document\.addEventListener\('DOMContentLoaded', bootApp, \{ once: true \}\);/);
});

test('HOTFIX-01.5 Scenario P: All root javascript modules pass node --check syntax validation', async () => {
    const rootDir = fileURLToPath(new URL('..', import.meta.url));
    const allFiles = await readdir(rootDir);
    const files = allFiles.filter(f => f.endsWith('.js') && !f.startsWith('.'));

    const { execFileSync } = await import('node:child_process');
    for (const f of files) {
        const filePath = resolve(rootDir, f);
        assert.doesNotThrow(() => {
            execFileSync(process.execPath, ['--check', filePath], { stdio: 'pipe' });
        }, `Syntax error in ${f}`);
    }
});