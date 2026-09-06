import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const uiHelpersJs = fs.readFileSync(path.join(ROOT, 'ui-helpers.js'), 'utf8');
const guidanceJs = fs.readFileSync(path.join(ROOT, 'guidance.js'), 'utf8');
const studentsJs = fs.readFileSync(path.join(ROOT, 'students.js'), 'utf8');
const financeJs = fs.readFileSync(path.join(ROOT, 'finance.js'), 'utf8');
const homeworkJs = fs.readFileSync(path.join(ROOT, 'homework.js'), 'utf8');
const scheduleJs = fs.readFileSync(path.join(ROOT, 'schedule.js'), 'utf8');

test('UX-07 Mobile Navigation: Includes Guidance module with correct ID and icon', () => {
    assert.match(indexHtml, /id="mobile-nav-guidance"/, 'index.html must include #mobile-nav-guidance');
    assert.match(indexHtml, /renderGuidancePage\(\)/, 'mobile-nav-guidance must trigger renderGuidancePage');
    assert.match(indexHtml, /fa-compass/, 'mobile guidance nav button must use compass icon');
});

test('UX-07 Mobile Navigation: ui-helpers recognizes #mobile-nav-guidance', () => {
    assert.match(uiHelpersJs, /mobile-nav-guidance/, 'ui-helpers.js startup check must recognize mobile-nav-guidance');
});

test('UX-07 Modal System: .app-modal-card and .app-modal-actions CSS defined and styled', () => {
    assert.match(indexHtml, /\.app-modal-card\s*\{/, 'CSS must define .app-modal-card');
    assert.match(indexHtml, /\.app-modal-actions\s*\{/, 'CSS must define .app-modal-actions');
    assert.match(indexHtml, /\.dark\s+\.app-modal-card/, 'Dark mode must override .app-modal-card background and border');
});

test('UX-07 Empty State System: .cf-empty-state tokens defined', () => {
    assert.match(indexHtml, /\.cf-empty-state\s*\{/, 'CSS must define .cf-empty-state container');
    assert.match(indexHtml, /\.cf-empty-state-icon\s*\{/, 'CSS must define .cf-empty-state-icon');
    assert.match(indexHtml, /\.cf-empty-state-title\s*\{/, 'CSS must define .cf-empty-state-title');
    assert.match(indexHtml, /\.cf-empty-state-description\s*\{/, 'CSS must define .cf-empty-state-description');
});

test('UX-07 Sidebar: .sidebar-btn width is fixed to 100%', () => {
    assert.match(indexHtml, /\.sidebar-btn\s*\{[^}]*width:\s*100%/, 'sidebar-btn must be 100% wide');
    assert.doesNotMatch(indexHtml, /\.sidebar-btn\s*\{[^}]*width:\s*105%/, 'sidebar-btn must not have 105% width overflow bug');
});

test('UX-07 Guidance Records Modals: Uses standard app-modal structure', () => {
    assert.match(guidanceJs, /class="app-modal\s+max-w-lg/, 'Guidance records modals must include standard app-modal class');
    assert.match(guidanceJs, /class="app-modal-body/, 'Guidance records modals must include app-modal-body class');
});

test('UX-07 Guidance Performance Center: Uses CanFenci blue tokens and mobile table scroll', () => {
    assert.match(guidanceJs, /bg-blue-600 text-white/, 'Performance center subject/range selectors must use brand blue');
    assert.match(guidanceJs, /min-w-\[620px\]/, 'Exam performance table must enforce min-w-620px inside overflow-x-auto');
    assert.match(guidanceJs, /Son 5/, 'Performance center must have range filters');
    assert.match(guidanceJs, /min-h-\[44px\]/, 'Performance center tabs must have min-h 44px');
});

test('UX-07 Empty States: Students, Finance, and Homework adopt .cf-empty-state', () => {
    assert.match(studentsJs, /cf-empty-state/, 'students.js must implement cf-empty-state');
    assert.match(financeJs, /cf-empty-state/, 'finance.js must implement cf-empty-state');
    assert.match(homeworkJs, /cf-empty-state/, 'homework.js must implement cf-empty-state');
});

test('UX-07 Typography: Micro 9px text removed from schedule badges', () => {
    assert.doesNotMatch(scheduleJs, /text-\[9px\]/, 'schedule.js must not contain sub-10px micro-fonts');
});
