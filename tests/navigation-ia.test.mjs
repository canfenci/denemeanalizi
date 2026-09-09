import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const readProjectFile = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('UX-IA-02.1 Scenario A: Desktop sidebar preserves the 5 main workspace domains in workspace group', () => {
    const indexHtml = readProjectFile('index.html');
    const groupMatch = indexHtml.match(/<div[^>]*id="sidebar-workspace-group"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(groupMatch, 'sidebar-workspace-group must exist');

    const content = groupMatch[1];
    const buttonMatches = [...content.matchAll(/<button[^>]*id="(sidebar-nav-[^"]+)"[^>]*>/g)];
    assert.equal(buttonMatches.length, 5, 'Workspace group must have exactly 5 nav buttons');

    const buttonIds = buttonMatches.map(m => m[1]);
    assert.deepEqual(buttonIds, [
        'sidebar-nav-reminders',
        'sidebar-nav-home',
        'sidebar-nav-lessons',
        'sidebar-nav-homework',
        'sidebar-nav-guidance'
    ], 'Desktop workspace buttons must be in exact canonical order');
});

test('UX-IA-02.1 Scenario B: Desktop sidebar has visible Ayarlar management link in management group', () => {
    const indexHtml = readProjectFile('index.html');
    const groupMatch = indexHtml.match(/<div[^>]*id="sidebar-management-group"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(groupMatch, 'sidebar-management-group must exist');

    const content = groupMatch[1];
    assert.match(content, /id="sidebar-nav-general"[^>]*onclick="renderGenelIslemler\(\)"/, 'sidebar-nav-general must trigger renderGenelIslemler');
    assert.match(content, />\s*<i[^>]*class="[^"]*fa-cog[^"]*"[^>]*><\/i>\s*<span>Ayarlar<\/span>/, 'sidebar-nav-general must have cog icon and visible Ayarlar text');
});

test('UX-IA-02.1 Scenario C: Ayarlar is excluded from the 5 workspace items count', () => {
    const indexHtml = readProjectFile('index.html');
    const groupMatch = indexHtml.match(/<div[^>]*id="sidebar-workspace-group"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(groupMatch, 'sidebar-workspace-group must exist');

    const workspaceButtons = [...groupMatch[1].matchAll(/<button[^>]*id="([^"]+)"/g)].map(m => m[1]);
    assert.equal(workspaceButtons.length, 5, 'Workspace group must contain exactly 5 buttons');
    assert.ok(!workspaceButtons.includes('sidebar-nav-general'), 'sidebar-nav-general must NOT be in workspace group');
});

test('UX-IA-02.1 Scenario D: Mobile bottom bar has exactly 5 main navigation items with touch targets >= 44px', () => {
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

test('UX-IA-02.1 Scenario E: Mobile header topbar has visible Ayarlar button with text and icon', () => {
    const indexHtml = readProjectFile('index.html');
    assert.match(indexHtml, /id="topbar-nav-general"[^>]*data-app-nav="true"[^>]*onclick="renderGenelIslemler\(\)"/, 'Topbar must have settings button with data-app-nav="true"');
    assert.match(indexHtml, /id="topbar-nav-general"[\s\S]*?fa-cog[\s\S]*?<span>Ayarlar<\/span>/, 'Topbar settings button must contain icon and visible Ayarlar text');
});

test('UX-IA-02.1 Scenario F: Teacher profile fields accessible in Ayarlar', () => {
    const studentsJs = readProjectFile('students.js');
    assert.match(studentsJs, /id="teacherNameInput"/, 'teacherNameInput must exist in renderGenelIslemler');
    assert.match(studentsJs, /for="teacherNameInput"/, 'label for teacherNameInput must exist');
    assert.match(studentsJs, /Öğretmen ve Kurum Bilgileri/, 'Öğretmen ve Kurum Bilgileri heading must exist');
});

test('UX-IA-02.1 Scenario G: School/institution field accessible in Ayarlar', () => {
    const studentsJs = readProjectFile('students.js');
    assert.match(studentsJs, /id="teacherSchoolInput"/, 'teacherSchoolInput must exist in renderGenelIslemler');
    assert.match(studentsJs, /for="teacherSchoolInput"/, 'label for teacherSchoolInput must exist');
});

test('UX-IA-02.1 Scenario H: Branch/subject selection accessible in Ayarlar', () => {
    const studentsJs = readProjectFile('students.js');
    assert.match(studentsJs, /name="settingsTeacherBranch"/, 'settingsTeacherBranch checkboxes must exist');
    assert.match(studentsJs, /saveTeacherProfileFromSettings\(\)/, 'saveTeacherProfileFromSettings button must exist');
    assert.match(studentsJs, /Verdiğiniz Dersler \/ Branşlar/, 'Branches section heading must exist');
});

test('UX-IA-02.1 Scenario I: Resource books management accessible in Ayarlar', () => {
    const studentsJs = readProjectFile('students.js');
    assert.match(studentsJs, /id="resourceGrade"/, 'resourceGrade select must exist');
    assert.match(studentsJs, /id="resourceSubject"/, 'resourceSubject select must exist');
    assert.match(studentsJs, /id="resourceName"/, 'resourceName input must exist');
    assert.match(studentsJs, /saveNewResourceBook\(\)/, 'saveNewResourceBook button must exist');
    assert.match(studentsJs, /removeResourceBook\(/, 'removeResourceBook button must exist');
});

test('UX-IA-02.1 Scenario J: Backup and restore accessible in Ayarlar', () => {
    const studentsJs = readProjectFile('students.js');
    assert.match(studentsJs, /exportBackup\(\)/, 'exportBackup button must exist');
    assert.match(studentsJs, /showImportModal\(\)/, 'showImportModal button must exist');
    assert.match(studentsJs, /Veri Yedekleme ve Geri Yükleme/, 'Backup section heading must exist');
});

test('UX-IA-02.1 Scenario K: Finans & Ödemeler visible under Dersler tabs', () => {
    const financeJs = readProjectFile('finance.js');
    assert.match(financeJs, /export function renderDerslerTabBarHtml/, 'finance.js must export renderDerslerTabBarHtml');
    assert.match(financeJs, /renderDerslerPage\('finance'\)/, 'Tab bar must link to finance tab');
    assert.match(financeJs, /Finans & Ödemeler/, 'Tab bar must include Finans & Ödemeler text');
});

test('UX-IA-02.1 Scenario L: Finans is not re-embedded in Ayarlar', () => {
    const studentsJs = readProjectFile('students.js');
    const genelIslemlerMatch = studentsJs.match(/export function renderGenelIslemler\(\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(genelIslemlerMatch, 'renderGenelIslemler function must exist');
    const genelIslemlerCode = genelIslemlerMatch[1];
    assert.doesNotMatch(genelIslemlerCode, /renderFinanceReport/, 'renderGenelIslemler must not embed renderFinanceReport');
    assert.doesNotMatch(genelIslemlerCode, /btn-finans-raporu/, 'renderGenelIslemler must not contain btn-finans-raporu');
});

test('UX-IA-02.1 Scenario M: Theme toggle remains topbar utility', () => {
    const indexHtml = readProjectFile('index.html');
    assert.match(indexHtml, /id="themeToggleBtn"[^>]*onclick="toggleTheme\(\)"/, 'Topbar must contain canonical themeToggleBtn');
    const navMatch = indexHtml.match(/<nav[^>]*aria-label="Sayfa Navigasyonu"[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.doesNotMatch(navMatch, /toggleTheme/, 'Sidebar must not contain toggleTheme button');
});

test('UX-IA-02.1 Scenario N: Zero data/schema changes made to store.js', () => {
    const storeJs = readProjectFile('store.js');
    assert.match(storeJs, /export const store/);
    assert.match(storeJs, /export function loadStudentsData/);
    assert.match(storeJs, /export (async )?function saveStudentsData/);
    assert.match(storeJs, /export function loadGroupsData/);
    assert.match(storeJs, /export function loadDersKayitlari/);
    assert.match(storeJs, /export function loadSchedule/);
});

test('UX-IA-02.1 Scenario O: Groups accessible under Students via tab bar', () => {
    const studentsJs = readProjectFile('students.js');
    const groupsJs = readProjectFile('groups.js');
    assert.match(studentsJs, /export function renderStudentsTabBarHtml/, 'students.js must export renderStudentsTabBarHtml');
    assert.match(studentsJs, /renderHomeScreen\('students'\)/, 'students tab must link to renderHomeScreen students');
    assert.match(studentsJs, /renderHomeScreen\('groups'\)/, 'groups tab must link to renderHomeScreen groups');
    assert.match(groupsJs, /renderStudentsTabBarHtml\('groups'\)/, 'groups page must display renderStudentsTabBarHtml with groups active');
    assert.match(groupsJs, /updateMobileNavActive\(["']mobile-nav-home["']\)/, 'groups page must activate Students nav item');
});

test('UX-IA-02.1 Scenario P: Active navigation state activates Dersler for all 3 sub-views and Ayarlar for settings', () => {
    const financeJs = readProjectFile('finance.js');
    const scheduleJs = readProjectFile('schedule.js');
    const authJs = readProjectFile('auth.js');

    assert.match(financeJs, /renderFinanceReport[\s\S]*?updateMobileNavActive\(['"]mobile-nav-lessons['"]\)/, 'renderFinanceReport must activate mobile-nav-lessons');
    assert.match(financeJs, /renderDersKayitlari[\s\S]*?updateMobileNavActive\(['"]mobile-nav-lessons['"]\)/, 'renderDersKayitlari must activate mobile-nav-lessons');
    assert.match(scheduleJs, /renderSchedulePage[\s\S]*?updateMobileNavActive\(['"]mobile-nav-lessons['"]\)/, 'renderSchedulePage must activate mobile-nav-lessons');
    assert.match(authJs, /topbar-nav-general[\s\S]*?sidebar-nav-general/, 'auth.js must handle topbar-nav-general and sidebar-nav-general active mapping');
});
