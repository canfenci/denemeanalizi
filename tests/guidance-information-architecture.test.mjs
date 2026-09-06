import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const guidanceJs = fs.readFileSync(path.join(ROOT, 'guidance.js'), 'utf8');

test('UX-11 Scenario A: Student detail defaults to overview tab', () => {
    // openGuidanceStudent must reset window._guidanceStudentTab to overview
    assert.match(guidanceJs, /function openGuidanceStudent\(studentId\)\s*\{\s*window\._guidanceStudentTab\s*=\s*['"]overview['"];/);
    // studentTab defaults to 'overview' if undefined
    assert.match(guidanceJs, /const studentTab = window\._guidanceStudentTab \|\| ['"]overview['"];/);
});

test('UX-11 Scenario B: Navigation tabs include Genel Bakış, Performans, Müdahaleler, Çalışma Planı, Rapor', () => {
    assert.match(guidanceJs, /\['overview',\s*'fa-id-card',\s*'Genel Bakış'\]/);
    assert.match(guidanceJs, /\['performance',\s*'fa-chart-line',\s*'Performans'\]/);
    assert.match(guidanceJs, /\['interventions',\s*'fa-clipboard-list',\s*'Müdahaleler'/);
    assert.match(guidanceJs, /\['study',\s*'fa-compass',\s*'Çalışma Planı'\]/);
    assert.match(guidanceJs, /\['report',\s*'fa-file-pdf',\s*'Rapor'\]/);
});

test('UX-11 Scenario C: Performance tab contains Homework Performance analytics', () => {
    assert.match(guidanceJs, /switchGuidancePerformanceTab\('\$\{studentId\}',\s*'homework'\)/);
    assert.match(guidanceJs, /Ödev Performansı/);
    assert.match(guidanceJs, /hwInsights\.errorReasons/);
    assert.match(guidanceJs, /hwInsights\.weakTopics/);
    assert.match(guidanceJs, /hwInsights\.errorCategoryBreakdown/);
});

test('UX-11 Scenario D: Performance tab contains School Exams analytics and canonical subjects', () => {
    assert.match(guidanceJs, /switchGuidancePerformanceTab\('\$\{studentId\}',\s*'exams'\)/);
    assert.match(guidanceJs, /Okul Denemeleri/);
    assert.match(guidanceJs, /examInsights\.subjectPerformance/);
    assert.match(guidanceJs, /examInsights\.summary/);
    assert.match(guidanceJs, /guidanceExamSubjectChart/);
});

test('UX-11 Scenario E: Interventions tab contains guidance record actions and records list', () => {
    assert.match(guidanceJs, /showGuidanceRecordModal\('\$\{studentId\}'\)/);
    assert.match(guidanceJs, /Kayıt Ekle/);
    assert.match(guidanceJs, /Rehberlik & Müdahale Kayıtları/);
    assert.match(guidanceJs, /showCompleteGuidanceRecordModal/);
    assert.match(guidanceJs, /confirmDeleteGuidanceRecord/);
});

test('UX-11 Scenario F: Study Plan tab contains study-plan CTA and content area', () => {
    assert.match(guidanceJs, /Çalışma Planı Etki Analizi/);
    assert.match(guidanceJs, /openStudentCockpitDirect\('\$\{studentId\}'\)/);
    assert.match(guidanceJs, /showStudyPlanSetup\('\$\{studentId\}'\)/);
    assert.match(guidanceJs, /detail\.activePlan/);
});

test('UX-11 Scenario G: Report tab contains Guidance Report preview, download and actions', () => {
    assert.match(guidanceJs, /openGuidanceReportModal\('\$\{studentId\}'\)/);
    assert.match(guidanceJs, /downloadGuidanceReportPdf\('\$\{studentId\}'\)/);
    assert.match(guidanceJs, /printGuidanceReportPdf\('\$\{studentId\}'\)/);
    assert.match(guidanceJs, /shareGuidanceReportPdf\('\$\{studentId\}'\)/);
    assert.match(guidanceJs, /Rehberlik Gelişim Raporu/);
});

test('UX-11 Scenario H: guidance.js performance-insights function imports remain intact', () => {
    assert.match(guidanceJs, /import\s*\{[\s\S]*?buildHomeworkPerformanceInsights[\s\S]*?\}\s*from\s*'\.\/guidance-performance-insights\.js'/);
    assert.match(guidanceJs, /import\s*\{[\s\S]*?buildSchoolExamPerformanceInsights[\s\S]*?\}\s*from\s*'\.\/guidance-performance-insights\.js'/);
    assert.match(guidanceJs, /import\s*\{[\s\S]*?LGS_SUBJECTS[\s\S]*?\}\s*from\s*'\.\/guidance-performance-insights\.js'/);
});

test('UX-11 Scenario I: Existing guidance record CRUD functions are preserved', () => {
    assert.match(guidanceJs, /export function showGuidanceRecordModal\(/);
    assert.match(guidanceJs, /export async function saveGuidanceRecordForm\(/);
    assert.match(guidanceJs, /export function showCompleteGuidanceRecordModal\(/);
    assert.match(guidanceJs, /export async function saveCompleteGuidanceRecordForm\(/);
    assert.match(guidanceJs, /export async function confirmDeleteGuidanceRecord\(/);
});

test('UX-11 Scenario J: store.js is completely untouched', () => {
    const gitDiffStore = execSync('git diff origin/main -- store.js', { encoding: 'utf8' });
    assert.equal(gitDiffStore.trim(), '', 'store.js must have zero diff against origin/main');
});

test('UX-11 Scenario K: Performance tab state variables and switches are preserved', () => {
    assert.match(guidanceJs, /window\._guidancePerformanceTab/);
    assert.match(guidanceJs, /window\._guidanceHwRange/);
    assert.match(guidanceJs, /window\._guidanceExamRange/);
    assert.match(guidanceJs, /window\._guidanceExamSelectedSubject/);
    assert.match(guidanceJs, /export function switchGuidancePerformanceTab/);
    assert.match(guidanceJs, /export function setGuidanceHomeworkRange/);
    assert.match(guidanceJs, /export function setGuidanceExamRange/);
    assert.match(guidanceJs, /export function setGuidanceExamSubject/);
    assert.match(guidanceJs, /export function switchGuidanceStudentTab/);
});

test('UX-11 Scenario L: Mobile tab controls satisfy minimum 44px touch target', () => {
    // Navigation tabs must include min-h-[44px]
    assert.match(guidanceJs, /aria-label="Öğrenci Rehberlik Sekmeleri"[\s\S]*?min-h-\[44px\]/);
    // Performance sub-tabs must include min-h-[44px]
    assert.match(guidanceJs, /switchGuidancePerformanceTab[\s\S]*?min-h-\[44px\]/);
});

test('UX-11 Scenario M: No duplicate separate old Performance Center rendered outside performance tab', () => {
    // There must be exactly one definition of performanceCenterHtml or #guidance-performance-center
    const matches = guidanceJs.match(/id="guidance-performance-center"/g) || [];
    assert.equal(matches.length, 1, 'Only one performance center container must exist');
    // It should only be assigned inside performance tab check
    assert.match(guidanceJs, /else\s+if\s*\(studentTab === 'performance'\)\s*\{\s*tabBodyHtml\s*=\s*`[\s\S]*?\$\{performanceCenterHtml\}/);
});

test('UX-11 Scenario N: renderGuidanceStudentDetail accepts studentId contract and is exported', () => {
    assert.match(guidanceJs, /export function renderGuidanceStudentDetail\(studentId\)/);
    assert.match(guidanceJs, /window\.renderGuidanceStudentDetail\s*=\s*renderGuidanceStudentDetail;/);
    assert.match(guidanceJs, /window\.switchGuidanceStudentTab\s*=\s*switchGuidanceStudentTab;/);
});
