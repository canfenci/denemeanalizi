import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const readProjectFile = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('UX-IA-02 Scenario A: Desktop sidebar has exactly 5 main navigation items', () => {
    const indexHtml = readProjectFile('index.html');
    const navMatch = indexHtml.match(/<nav[^>]*aria-label="Sayfa Navigasyonu"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(navMatch, 'Sayfa Navigasyonu nav block must exist');

    const navContent = navMatch[1];
    const buttonMatches = [...navContent.matchAll(/<button[^>]*id="(sidebar-nav-[^"]+)"[^>]*>/g)];
    assert.equal(buttonMatches.length, 5, 'Desktop sidebar must have exactly 5 nav buttons');

    const buttonIds = buttonMatches.map(m => m[1]);
    assert.deepEqual(buttonIds, [
        'sidebar-nav-reminders',
        'sidebar-nav-home',
        'sidebar-nav-lessons',
        'sidebar-nav-homework',
        'sidebar-nav-guidance'
    ], 'Desktop sidebar buttons must be in exact canonical order');
});

test('UX-IA-02 Scenario B: Mobile bottom bar has exactly 5 main navigation items with touch targets >= 44px', () => {
    const indexHtml = readProjectFile('index.html');
    const mobileNavMatch = indexHtml.match(/<div[^>]*class="[^"]*mobile-nav-bar[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(mobileNavMatch, 'Mobile nav bar container must exist');

    const mobileContent = mobileNavMatch[1];
    const buttonMatches = [...mobileContent.matchAll(/<button[^>]*id="(mobile-nav-[^"]+)"[^>]*>/g)];
    assert.equal(buttonMatches.length, 5, 'Mobile bottom bar must have exactly 5 nav buttons');

    const buttonIds = buttonMatches.map(m => m[1]);
    assert.deepEqual(buttonIds, [
        'mobile-nav-reminders',
        'mobile-nav-home',
        'mobile-nav-lessons',
        'mobile-nav-homework',
        'mobile-nav-guidance'
    ], 'Mobile bottom bar buttons must be in exact canonical order');

    // Verify touch target >= 44px (min-h-[48px] is used)
    const buttons = [...mobileContent.matchAll(/<button[\s\S]*?<\/button>/g)].map(m => m[0]);
    buttons.forEach(btnHtml => {
        assert.match(btnHtml, /min-h-\[(?:4[4-9]|[5-9]\d)px\]/, 'Each mobile nav button must enforce touch target >= 44px');
    });
});

test('UX-IA-02 Scenario C: Desktop and mobile share the exact same 5 domains with clear labels', () => {
    const indexHtml = readProjectFile('index.html');
    
    // Desktop labels
    assert.match(indexHtml, /sidebar-nav-reminders[^>]*>[\s\S]*?<span>Bugün<\/span>/);
    assert.match(indexHtml, /sidebar-nav-home[^>]*>[\s\S]*?<span>Öğrenciler<\/span>/);
    assert.match(indexHtml, /sidebar-nav-lessons[^>]*>[\s\S]*?<span>Dersler<\/span>/);
    assert.match(indexHtml, /sidebar-nav-homework[^>]*>[\s\S]*?<span>Ödevler<\/span>/);
    assert.match(indexHtml, /sidebar-nav-guidance[^>]*>[\s\S]*?<span>Rehberlik<\/span>/);

    // Mobile labels
    assert.match(indexHtml, /mobile-nav-reminders[^>]*>[\s\S]*?<span>Bugün<\/span>/);
    assert.match(indexHtml, /mobile-nav-home[^>]*>[\s\S]*?<span>Öğrenciler<\/span>/);
    assert.match(indexHtml, /mobile-nav-lessons[^>]*>[\s\S]*?<span>Dersler<\/span>/);
    assert.match(indexHtml, /mobile-nav-homework[^>]*>[\s\S]*?<span>Ödevler<\/span>/);
    assert.match(indexHtml, /mobile-nav-guidance[^>]*>[\s\S]*?<span>Rehberlik<\/span>/);
});

test('UX-IA-02 Scenario D: Sidebar Deneme Ata action button is removed', () => {
    const indexHtml = readProjectFile('index.html');
    const navMatch = indexHtml.match(/<nav[^>]*aria-label="Sayfa Navigasyonu"[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.doesNotMatch(navMatch, /showDenemeAtaModal/, 'Sidebar must not contain showDenemeAtaModal button');
    assert.doesNotMatch(navMatch, /Deneme Ata/, 'Sidebar must not contain Deneme Ata text');
});

test('UX-IA-02 Scenario E: Sidebar Koyu Mod toggle is removed', () => {
    const indexHtml = readProjectFile('index.html');
    const navMatch = indexHtml.match(/<nav[^>]*aria-label="Sayfa Navigasyonu"[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.doesNotMatch(navMatch, /toggleTheme/, 'Sidebar must not contain toggleTheme button');
    assert.doesNotMatch(navMatch, /Koyu Mod/, 'Sidebar must not contain Koyu Mod text');
});

test('UX-IA-02 Scenario F: Sidebar Ayarlar button is removed', () => {
    const indexHtml = readProjectFile('index.html');
    const navMatch = indexHtml.match(/<nav[^>]*aria-label="Sayfa Navigasyonu"[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.doesNotMatch(navMatch, /id="sidebar-nav-general"/, 'Sidebar must not contain sidebar-nav-general');
    assert.doesNotMatch(navMatch, /Ayarlar/, 'Sidebar must not contain Ayarlar');
});

test('UX-IA-02 Scenario G: Topbar provides persistent Settings access on desktop and mobile', () => {
    const indexHtml = readProjectFile('index.html');
    assert.match(indexHtml, /id="topbar-nav-general"[^>]*data-app-nav="true"[^>]*onclick="renderGenelIslemler\(\)"/, 'Topbar must have settings button with data-app-nav="true"');
});

test('UX-IA-02 Scenario H: Topbar provides canonical Theme toggle', () => {
    const indexHtml = readProjectFile('index.html');
    assert.match(indexHtml, /id="themeToggleBtn"[^>]*onclick="toggleTheme\(\)"/, 'Topbar must contain canonical themeToggleBtn');
});

test('UX-IA-02 Scenario I: Groups is accessible under Students via tab bar', () => {
    const studentsJs = readProjectFile('students.js');
    const groupsJs = readProjectFile('groups.js');
    
    assert.match(studentsJs, /export function renderStudentsTabBarHtml/, 'students.js must export renderStudentsTabBarHtml');
    assert.match(studentsJs, /renderHomeScreen\('students'\)/, 'students tab must link to renderHomeScreen students');
    assert.match(studentsJs, /renderHomeScreen\('groups'\)/, 'groups tab must link to renderHomeScreen groups');
    assert.match(groupsJs, /renderStudentsTabBarHtml\('groups'\)/, 'groups page must display renderStudentsTabBarHtml with groups active');
    assert.match(groupsJs, /updateMobileNavActive\(["']mobile-nav-home["']\)/, 'groups page must activate Students nav item');
});

test('UX-IA-02 Scenario J: Dersler unified module provides 3 sub-tabs (Schedule, Lessons, Finance)', () => {
    const financeJs = readProjectFile('finance.js');
    assert.match(financeJs, /export function renderDerslerTabBarHtml/, 'finance.js must export renderDerslerTabBarHtml');
    assert.match(financeJs, /renderDerslerPage\('schedule'\)/, 'Tab bar must link to schedule tab');
    assert.match(financeJs, /renderDerslerPage\('lessons'\)/, 'Tab bar must link to lessons tab');
    assert.match(financeJs, /renderDerslerPage\('finance'\)/, 'Tab bar must link to finance tab');
    assert.match(financeJs, /Haftalık Program/, 'Tab bar must include Haftalık Program');
    assert.match(financeJs, /Ders Kayıtları/, 'Tab bar must include Ders Kayıtları');
    assert.match(financeJs, /Finans & Ödemeler/, 'Tab bar must include Finans & Ödemeler');
});

test('UX-IA-02 Scenario K: Haftalık Program reuses renderSchedulePage', () => {
    const financeJs = readProjectFile('finance.js');
    const scheduleJs = readProjectFile('schedule.js');
    assert.match(financeJs, /if\s*\(tab === ['"]schedule['"]\)/, 'renderDerslerPage must route schedule tab');
    assert.match(financeJs, /window\.renderSchedulePage/, 'renderDerslerPage must invoke window.renderSchedulePage');
    assert.match(scheduleJs, /renderDerslerTabBarHtml\(['"]schedule['"]\)/, 'schedule.js must render tab bar with schedule active');
});

test('UX-IA-02 Scenario L: Ders Kayıtları reuses renderDersKayitlari', () => {
    const financeJs = readProjectFile('finance.js');
    assert.match(financeJs, /renderDersKayitlari\(\)/, 'renderDerslerPage must call renderDersKayitlari');
    assert.match(financeJs, /renderDerslerTabBarHtml\(['"]lessons['"]\)/, 'renderDersKayitlari must render tab bar with lessons active');
});

test('UX-IA-02 Scenario M: Finans & Ödemeler reuses renderFinanceReport', () => {
    const financeJs = readProjectFile('finance.js');
    assert.match(financeJs, /if\s*\(tab === ['"]finance['"]\)\s*\{\s*renderFinanceReport\(\);/s, 'renderDerslerPage must call renderFinanceReport');
    assert.match(financeJs, /renderDerslerTabBarHtml\(['"]finance['"]\)/, 'renderFinanceReport must render tab bar with finance active');
});

test('UX-IA-02 Scenario N: Legacy render functions remain accessible and functional', () => {
    const financeJs = readProjectFile('finance.js');
    const scheduleJs = readProjectFile('schedule.js');
    const studentsJs = readProjectFile('students.js');
    const groupsJs = readProjectFile('groups.js');

    assert.match(scheduleJs, /export function renderSchedulePage/, 'renderSchedulePage must be exported');
    assert.match(financeJs, /export function renderDersKayitlari/, 'renderDersKayitlari must be exported');
    assert.match(financeJs, /export function renderFinanceReport/, 'renderFinanceReport must be exported');
    assert.match(groupsJs, /export function renderGroupsPage/, 'renderGroupsPage must be exported');
    assert.match(studentsJs, /export function renderGenelIslemler/, 'renderGenelIslemler must be exported');
});

test('UX-IA-02 Scenario O: Active navigation state activates Dersler for all 3 sub-views', () => {
    const financeJs = readProjectFile('finance.js');
    const scheduleJs = readProjectFile('schedule.js');
    const authJs = readProjectFile('auth.js');

    assert.match(financeJs, /renderFinanceReport[\s\S]*?updateMobileNavActive\(['"]mobile-nav-lessons['"]\)/, 'renderFinanceReport must activate mobile-nav-lessons');
    assert.match(financeJs, /renderDersKayitlari[\s\S]*?updateMobileNavActive\(['"]mobile-nav-lessons['"]\)/, 'renderDersKayitlari must activate mobile-nav-lessons');
    assert.match(scheduleJs, /renderSchedulePage[\s\S]*?updateMobileNavActive\(['"]mobile-nav-lessons['"]\)/, 'renderSchedulePage must activate mobile-nav-lessons');
    assert.match(authJs, /mobile-nav-schedule[\s\S]*?mobile-nav-lessons/, 'auth.js must alias legacy schedule nav to mobile-nav-lessons');
});

test('UX-IA-02 Scenario P: No data/schema changes made to store.js', () => {
    const storeJs = readProjectFile('store.js');
    assert.match(storeJs, /export const store/);
    assert.match(storeJs, /export function loadStudentsData/);
    assert.match(storeJs, /export (async )?function saveStudentsData/);
    assert.match(storeJs, /export function loadGroupsData/);
    assert.match(storeJs, /export function loadDersKayitlari/);
    assert.match(storeJs, /export function loadSchedule/);
});
