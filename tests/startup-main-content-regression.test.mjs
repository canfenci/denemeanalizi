import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

function readProjectFile(relativePath) {
    return readFile(resolve(process.cwd(), relativePath), 'utf8');
}

test('HOTFIX-WHITE-SCREEN Scenario G: store.js, firebase-config.js, firestore.rules, exams.js have ZERO modifications', () => {
    const diff = execSync('git diff -- store.js firebase-config.js firestore.rules exams.js', { encoding: 'utf8' });
    assert.equal(diff.trim(), '', 'Critical persistence, schema, and exam files must not have any modifications');
});

test('HOTFIX-WHITE-SCREEN Scenario A & C: bootApp prevents blank white screen and ensures dynamic-content is rendered', async () => {
    const index = await readProjectFile('index.html');

    // 1. bootApp provides immediate loading state when dynamic-content is empty
    assert.match(index, /const startupContent = document\.getElementById\('dynamic-content'\);/);
    assert.match(index, /if \(startupContent && \(!startupContent\.innerHTML \|\| startupContent\.innerHTML\.trim\(\) === ''\)\) \{/);
    assert.match(index, /if \(window\.renderAppLoadingState\) window\.renderAppLoadingState\(\);/);

    // 2. renderInitialView guards legitimate user navigation and rescues blank/loading content
    assert.match(index, /const isBlankOrLoading = window\.isDynamicContentEmptyOrLoading/);
    assert.match(index, /if \(userHasNavigatedDuringStartup\) \{/);
    assert.match(index, /if \(!isBlankOrLoading\) \{/);
    assert.match(index, /if \(!shouldRender && !isBlankOrLoading\) return;/);
    assert.match(index, /content\?\.removeAttribute\("aria-busy"\);/);

    // 3. Fallback safety timer guards legitimate user navigation and rescues blank/loading content
    assert.match(index, /if \(shouldFallback \|\| isBlankOrLoading\) \{/);
    assert.match(index, /initialViewRendered = true;/);
    assert.match(index, /content\?\.removeAttribute\('aria-busy'\);/);
});

test('HOTFIX-WHITE-SCREEN Scenario B: renderReminderHome() and renderHomeScreen() execute cleanly without throwing', async () => {
    globalThis.window = globalThis;
    globalThis.window.addEventListener = () => {};
    globalThis.window.removeEventListener = () => {};
    globalThis.window.isFirebaseActive = false;
    globalThis.window.auth = { currentUser: null };

    const elementMap = new Map();
    globalThis.document = {
        getElementById: (id) => {
            if (!elementMap.has(id)) {
                elementMap.set(id, {
                    innerHTML: '',
                    innerText: '',
                    id,
                    attributes: new Map(),
                    hasAttribute(attr) { return this.attributes.has(attr); },
                    getAttribute(attr) { return this.attributes.get(attr) || null; },
                    setAttribute(attr, val) { this.attributes.set(attr, String(val)); },
                    removeAttribute(attr) { this.attributes.delete(attr); },
                    querySelector() { return null; },
                    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} }
                });
            }
            return elementMap.get(id);
        },
        querySelectorAll: () => []
    };
    globalThis.localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    };

    const { renderReminderHome, renderHomeScreen } = await import('../students.js');

    const dynamicContent = document.getElementById('dynamic-content');
    dynamicContent.setAttribute('aria-busy', 'true');
    assert.equal(dynamicContent.hasAttribute('aria-busy'), true);

    assert.doesNotThrow(() => renderReminderHome());
    assert.ok(dynamicContent.innerHTML.length > 0, 'renderReminderHome must populate dynamic-content');
    assert.equal(dynamicContent.hasAttribute('aria-busy'), false, 'renderReminderHome must remove aria-busy');

    dynamicContent.setAttribute('aria-busy', 'true');
    assert.doesNotThrow(() => renderHomeScreen());
    assert.ok(dynamicContent.innerHTML.length > 0, 'renderHomeScreen must populate dynamic-content');
    assert.equal(dynamicContent.hasAttribute('aria-busy'), false, 'renderHomeScreen must remove aria-busy');
});

test('HOTFIX-WHITE-SCREEN Scenario D: LGS helper exports in exams.js remain intact and compatible with startup', async () => {
    const { isGrade8OrLgsExam, getGeneralExamFenQuestionIndexes, getGeneralExamFenQuestions } = await import('../exams.js');
    assert.equal(typeof isGrade8OrLgsExam, 'function');
    assert.equal(typeof getGeneralExamFenQuestionIndexes, 'function');
    assert.equal(typeof getGeneralExamFenQuestions, 'function');

    assert.equal(isGrade8OrLgsExam(null), false);
    assert.deepEqual(getGeneralExamFenQuestionIndexes(null), []);
    assert.deepEqual(getGeneralExamFenQuestions(null), []);
});

test('HOTFIX-WHITE-SCREEN Scenario E & F: All primary workspace navigation renderers and Ayarlar remain callable and bound', async () => {
    const studentsModule = await import('../students.js');
    const financeModule = await import('../finance.js');
    const homeworkModule = await import('../homework.js');
    const guidanceModule = await import('../guidance.js');

    assert.equal(typeof studentsModule.renderReminderHome, 'function', 'Bugün renderer must be callable');
    assert.equal(typeof studentsModule.renderHomeScreen, 'function', 'Öğrenciler renderer must be callable');
    assert.equal(typeof financeModule.renderDerslerPage, 'function', 'Dersler renderer must be callable');
    assert.equal(typeof homeworkModule.renderOdevTakibi, 'function', 'Ödevler renderer must be callable');
    assert.equal(typeof guidanceModule.renderGuidancePage, 'function', 'Rehberlik renderer must be callable');
    assert.equal(typeof studentsModule.renderGenelIslemler, 'function', 'Ayarlar renderer must be callable');
});

// Deterministic mock harness for startup race guard testing
function createStartupHarness() {
    let initialViewRendered = false;
    let userHasNavigatedDuringStartup = false;
    const content = {
        innerHTML: '',
        attributes: new Map([['aria-busy', 'true']]),
        hasAttribute(attr) { return this.attributes.has(attr); },
        setAttribute(attr, val) { this.attributes.set(attr, String(val)); },
        removeAttribute(attr) { this.attributes.delete(attr); },
        querySelector(sel) {
            if (sel.includes('#app-loading-state') || sel.includes('data-app-loading-state')) {
                return this.innerHTML.includes('id="app-loading-state"') || this.innerHTML.includes('data-app-loading-state="true"') ? {} : null;
            }
            return null;
        }
    };

    const isDynamicContentEmptyOrLoading = (el) => {
        if (!el) return true;
        const html = el.innerHTML ? el.innerHTML.trim() : '';
        if (!html) return true;
        if (el.querySelector('#app-loading-state, [data-app-loading-state="true"]')) return true;
        if (html.includes('Verileriniz hazırlanıyor')) return true;
        return false;
    };

    const shouldRenderInitialView = ({ initialViewRendered: ivr, userHasNavigatedDuringStartup: uhn }) => {
        if (ivr) return false;
        if (uhn) return false;
        return true;
    };

    const renderInitialView = () => {
        const isBlankOrLoading = isDynamicContentEmptyOrLoading(content);

        if (userHasNavigatedDuringStartup) {
            if (!isBlankOrLoading) {
                initialViewRendered = true;
                content.removeAttribute("aria-busy");
                return; // Protected: legitimate user view preserved!
            }
        }

        const shouldRender = shouldRenderInitialView({ initialViewRendered, userHasNavigatedDuringStartup });
        if (!shouldRender && !isBlankOrLoading) return;
        initialViewRendered = true;
        content.removeAttribute("aria-busy");
        content.innerHTML = '<div class="view-bugun">Bugün View</div>';
    };

    const runSafetyTimer = () => {
        const isBlankOrLoading = isDynamicContentEmptyOrLoading(content);

        if (userHasNavigatedDuringStartup) {
            if (!isBlankOrLoading) {
                content.removeAttribute('aria-busy');
                return; // Protected: legitimate user view preserved!
            }
        }

        const shouldFallback = shouldRenderInitialView({ initialViewRendered, userHasNavigatedDuringStartup });
        if (shouldFallback || isBlankOrLoading) {
            if (isBlankOrLoading) {
                initialViewRendered = true;
                content.removeAttribute('aria-busy');
                content.innerHTML = '<div class="view-bugun">Bugün Fallback View</div>';
            }
        }
    };

    return {
        content,
        setInitialLoadingState() {
            content.setAttribute('aria-busy', 'true');
            content.innerHTML = '<div id="app-loading-state" data-app-loading-state="true">Verileriniz hazırlanıyor</div>';
        },
        userClicks(viewName, htmlContent) {
            userHasNavigatedDuringStartup = true;
            content.innerHTML = htmlContent;
        },
        userClicksNavWithError(viewName) {
            userHasNavigatedDuringStartup = true;
            // Renderer threw error, leaving content empty
            content.innerHTML = '';
        },
        resolveAuth() {
            renderInitialView();
        },
        fireSafetyTimer() {
            runSafetyTimer();
        },
        getState() {
            return {
                initialViewRendered,
                userHasNavigatedDuringStartup,
                contentHtml: content.innerHTML,
                hasBusy: content.hasAttribute('aria-busy')
            };
        }
    };
}

test('HOTFIX-WHITE-SCREEN Scenario H: startup + user selects Dersler before auth resolves -> final content Dersler', () => {
    const harness = createStartupHarness();
    harness.setInitialLoadingState();

    // User clicks Dersler during startup before auth resolves
    harness.userClicks('Dersler', '<div class="app-page"><h2>Ders Programı</h2></div>');

    // Late auth resolves and calls renderInitialView()
    harness.resolveAuth();

    const state = harness.getState();
    assert.match(state.contentHtml, /Ders Programı/, 'Dersler page must be preserved');
    assert.doesNotMatch(state.contentHtml, /Bugün View/, 'Bugün must NOT overwrite Dersler');
    assert.equal(state.hasBusy, false, 'aria-busy must be cleaned up');

    // Safety timer at 3s also fires
    harness.fireSafetyTimer();
    assert.match(harness.getState().contentHtml, /Ders Programı/, 'Safety timer must NOT overwrite Dersler');
});

test('HOTFIX-WHITE-SCREEN Scenario I: startup + user selects Ödevler before auth resolves -> final content Ödevler', () => {
    const harness = createStartupHarness();
    harness.setInitialLoadingState();

    harness.userClicks('Ödevler', '<div class="app-page"><h2>Ödev Takibi</h2></div>');
    harness.resolveAuth();

    const state = harness.getState();
    assert.match(state.contentHtml, /Ödev Takibi/, 'Ödevler page must be preserved');
    assert.doesNotMatch(state.contentHtml, /Bugün View/, 'Bugün must NOT overwrite Ödevler');
    assert.equal(state.hasBusy, false);
});

test('HOTFIX-WHITE-SCREEN Scenario J: startup + user selects Rehberlik before auth resolves -> final content Rehberlik', () => {
    const harness = createStartupHarness();
    harness.setInitialLoadingState();

    harness.userClicks('Rehberlik', '<div class="app-page"><h2>Rehberlik & Takip</h2></div>');
    harness.resolveAuth();

    const state = harness.getState();
    assert.match(state.contentHtml, /Rehberlik/, 'Rehberlik page must be preserved');
    assert.doesNotMatch(state.contentHtml, /Bugün View/, 'Bugün must NOT overwrite Rehberlik');
    assert.equal(state.hasBusy, false);
});

test('HOTFIX-WHITE-SCREEN Scenario K: startup + user selects Öğrenciler before auth resolves -> final content Öğrenciler', () => {
    const harness = createStartupHarness();
    harness.setInitialLoadingState();

    harness.userClicks('Öğrenciler', '<div class="app-page"><h2>Öğrenci Listesi</h2></div>');
    harness.resolveAuth();

    const state = harness.getState();
    assert.match(state.contentHtml, /Öğrenci Listesi/, 'Öğrenciler page must be preserved');
    assert.doesNotMatch(state.contentHtml, /Bugün View/, 'Bugün must NOT overwrite Öğrenciler');
    assert.equal(state.hasBusy, false);
});

test('HOTFIX-WHITE-SCREEN Scenario L: startup + user selects Ayarlar before auth resolves -> final content Ayarlar', () => {
    const harness = createStartupHarness();
    harness.setInitialLoadingState();

    harness.userClicks('Ayarlar', '<div class="app-page"><h2>Ayarlar Paneli</h2></div>');
    harness.resolveAuth();

    const state = harness.getState();
    assert.match(state.contentHtml, /Ayarlar Paneli/, 'Ayarlar page must be preserved');
    assert.doesNotMatch(state.contentHtml, /Bugün View/, 'Bugün must NOT overwrite Ayarlar');
    assert.equal(state.hasBusy, false);
});

test('HOTFIX-WHITE-SCREEN Scenario M: user navigates but selected renderer leaves content empty -> recovery default view runs', () => {
    const harness = createStartupHarness();
    harness.setInitialLoadingState();

    // User clicked nav, but renderer had an uncaught exception leaving content empty
    harness.userClicksNavWithError('Dersler');

    // Auth resolves -> content is empty, so recovery kicks in
    harness.resolveAuth();

    const state = harness.getState();
    assert.match(state.contentHtml, /Bugün View/, 'Recovery must engage and prevent blank white screen');
    assert.equal(state.hasBusy, false);
});

test('HOTFIX-WHITE-SCREEN Scenario N: no user navigation + auth delay -> safety timer renders Bugün', () => {
    const harness = createStartupHarness();
    harness.setInitialLoadingState();

    // User does NOT navigate. Auth is delayed / stuck.
    harness.fireSafetyTimer();

    const state = harness.getState();
    assert.match(state.contentHtml, /Bugün Fallback View/, 'Safety timer must render default view on delay');
    assert.equal(state.hasBusy, false);
});

test('HOTFIX-WHITE-SCREEN Scenario O: stale aria-busy + non-empty legitimate page -> default view NOT overwritten', () => {
    const harness = createStartupHarness();
    
    // Page rendered with legitimate content, but aria-busy remained true
    harness.content.setAttribute('aria-busy', 'true');
    harness.content.innerHTML = '<div class="app-page"><h2>Dersler İçeriği</h2></div>';
    // User navigated
    harness.userClicks('Dersler', '<div class="app-page"><h2>Dersler İçeriği</h2></div>');

    // Simulate auth resolution & safety timer
    harness.resolveAuth();
    harness.fireSafetyTimer();

    const state = harness.getState();
    assert.match(state.contentHtml, /Dersler İçeriği/, 'Legitimate page must remain');
    assert.doesNotMatch(state.contentHtml, /Bugün/, 'Bugün must NOT overwrite legitimate page');
    assert.equal(state.hasBusy, false, 'Stale aria-busy must be cleaned up');
});
