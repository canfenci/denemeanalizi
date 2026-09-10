// Öğrenci Kokpiti için yalnızca görüntüleme/selector hesapları.
// Veri yazma, Firebase ve mevcut analiz motorları bu modülün dışında tutulur.

import { normalizeHomeworkErrorAnalysis, normalizeHataNedeniLabel, normalizeHataNedeniKey } from './homework-error-topics.js';

const number = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function getStudentInitials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1) return `${parts[0][0]}${parts.at(-1)[0]}`.toLocaleUpperCase('tr-TR');
    return (parts[0] || 'Ö').slice(0, 2).toLocaleUpperCase('tr-TR');
}

export function formatCockpitNet(value) {
    return Number.isFinite(Number(value))
        ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value))
        : '—';
}

export function classifyCockpitTrend(changeNet) {
    if (changeNet === null || changeNet === undefined || !Number.isFinite(Number(changeNet))) {
        return null;
    }
    const delta = Number(changeNet);
    if (delta >= 1.0) {
        return {
            label: 'Yükseliş',
            direction: 'up',
            tone: 'positive',
            badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
            icon: 'fa-arrow-trend-up',
            prefix: '+'
        };
    }
    if (delta <= -1.0) {
        return {
            label: 'Düşüş',
            direction: 'down',
            tone: 'critical',
            badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
            icon: 'fa-arrow-trend-down',
            prefix: ''
        };
    }
    return {
        label: 'Yatay',
        direction: 'flat',
        tone: 'neutral',
        badgeClass: 'bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        icon: 'fa-arrow-right',
        prefix: delta > 0 ? '+' : ''
    };
}

export function getExamTotalQuestions(exam) {
    if (!exam) return 0;
    const direct = Number(exam.toplamSoru ?? exam.soruSayisi);
    if (Number.isFinite(direct) && direct > 0) return direct;
    if (Array.isArray(exam.sorular) && exam.sorular.length > 0) return exam.sorular.length;
    if (Array.isArray(exam.dersBilgileri) && exam.dersBilgileri.length > 0) {
        const sum = exam.dersBilgileri.reduce((acc, d) => acc + (Number(d.adet) || 0), 0);
        if (sum > 0) return sum;
    }
    return 0;
}

export function getCockpitExamComparabilityKey(exam, student = null) {
    if (!exam || exam.tip !== 'genel') return null;
    if (!exam.tarih || !Number.isFinite(Number(exam.toplamNet))) return null;

    const totalQuestions = getExamTotalQuestions(exam);
    if (!totalQuestions || totalQuestions <= 0) return null;

    const parseGrade = (val) => {
        if (val === null || val === undefined) return null;
        const s = String(val).trim().toLocaleLowerCase('tr-TR');
        if (/^8(\b|\D)/.test(s) || s === '8' || s.includes('lgs')) return '8';
        if (/^7(\b|\D)/.test(s) || s === '7') return '7';
        if (/^6(\b|\D)/.test(s) || s === '6') return '6';
        if (/^5(\b|\D)/.test(s) || s === '5') return '5';
        return null;
    };

    // 1. Explicit grade on exam itself (highest priority)
    let grade = parseGrade(exam.sinif) || parseGrade(exam.sinifSeviyesi);

    // 2. Exam title cues
    if (!grade) {
        const title = String(exam.denemeAdi || exam.ad || '').trim().toLocaleLowerCase('tr-TR');
        if (title.includes('lgs') || /(?<!\d)8\s*\.?\s*s[ıi]n[ıi]f/i.test(title)) grade = '8';
        else if (/(?<!\d)7\s*\.?\s*s[ıi]n[ıi]f/i.test(title)) grade = '7';
        else if (/(?<!\d)6\s*\.?\s*s[ıi]n[ıi]f/i.test(title)) grade = '6';
        else if (/(?<!\d)5\s*\.?\s*s[ıi]n[ıi]f/i.test(title)) grade = '5';
    }

    // 3. 90-Question LGS curriculum signature
    // In Turkish secondary curriculum, 90 questions is uniquely the 6-subject Grade 8 LGS format.
    // If student is recorded as 8 or unspecified, and totalQuestions === 90, grade is 8.
    // If student is explicitly non-8 (5, 6, 7), it should not be forced into grade 8.
    if (!grade && totalQuestions === 90) {
        const studentGrade = student ? (parseGrade(student.sinif) || parseGrade(student.grup)) : null;
        if (!studentGrade || studentGrade === '8') {
            grade = '8';
        }
    }

    // 4. Safe fallback: If grade is still unknown (e.g. 60-question exam with no grade metadata,
    // even if student is currently in grade 8):
    // Historical metadata yoksa tahmin üretme.
    if (!grade) return null;

    return `grade${grade}-general-${totalQuestions}`;
}

export function getCockpitData({ student, homeworks = [], summary = {}, analysis = {}, timeline = [] }) {
    const rawGeneralExams = (student.denemeler || [])
        .filter(exam => exam.tip === 'genel' && exam.tarih && Number.isFinite(Number(exam.toplamNet)))
        .sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)));
    const withKeys = rawGeneralExams.map(exam => ({
        exam,
        key: getCockpitExamComparabilityKey(exam, student)
    }));
    const latestComparable = [...withKeys].reverse().find(item => item.key !== null);
    const targetKey = latestComparable ? latestComparable.key : null;
    const comparableExams = targetKey
        ? withKeys.filter(item => item.key === targetKey).map(item => item.exam)
        : [];
    const recentExams = comparableExams.slice(-5);
    const averageWindow = recentExams;
    const averageNet = averageWindow.length
        ? round(averageWindow.reduce((sum, exam) => sum + number(exam.toplamNet), 0) / averageWindow.length)
        : null;
    const targetNet = Number(student.hedefNet);
    const targetGap = summary.latestNet !== null && Number.isFinite(targetNet) && targetNet > 0
        ? round(targetNet - summary.latestNet)
        : null;
    const pendingHomeworks = homeworks
        .filter(homework => homework.durum !== 'tamamlandi' && homework.bitisTarihi)
        .sort((a, b) => String(a.bitisTarihi).localeCompare(String(b.bitisTarihi)));
    const strongest = analysis.strongestSubject?.successRate !== null ? analysis.strongestSubject : null;
    const weakest = analysis.weakestSubject?.successRate !== null ? analysis.weakestSubject : null;
    const criticalTopic = analysis.priorityTopics?.[0] || null;
    const errorCountsByKey = {};
    (student.denemeler || []).forEach(exam => (exam.sorular || []).forEach(question => {
        if (!question.hataKodu || question.durum === 'dogru') return;
        const key = normalizeHataNedeniKey(question.hataKodu);
        if (key) {
            errorCountsByKey[key] = (errorCountsByKey[key] || 0) + 1;
        }
    }));
    (student.odevler || homeworks || []).forEach(hw => {
        const errorList = normalizeHomeworkErrorAnalysis(hw);
        errorList.forEach(err => {
            (err.hataNedenleriKeys || []).forEach(key => {
                if (key) {
                    errorCountsByKey[key] = (errorCountsByKey[key] || 0) + (Number(err.adet) || 1);
                }
            });
        });
    });
    const errorCandidates = Object.entries(errorCountsByKey)
        .sort((a, b) => number(b[1]) - number(a[1]));
    const mostFrequentError = errorCandidates[0]
        ? { key: errorCandidates[0][0], label: normalizeHataNedeniLabel(errorCandidates[0][0]), count: number(errorCandidates[0][1]) }
        : null;
    const trendDelta = recentExams.length >= 2
        ? round(number(recentExams.at(-1).toplamNet) - number(recentExams[0].toplamNet))
        : null;
    const trendClassification = classifyCockpitTrend(trendDelta);
    const lastThree = recentExams.slice(-3);
    const lastThreeDelta = lastThree.length === 3
        ? round(number(lastThree.at(-1).toplamNet) - number(lastThree[0].toplamNet))
        : null;
    const priorities = criticalTopic
        ? `${criticalTopic.topic} tekrarı + 2 konu testi`
        : null;

    return {
        generalExams: comparableExams,
        comparableExams,
        recentExams,
        comparabilityKey: targetKey,
        averageNet,
        averageCount: averageWindow.length,
        targetGap,
        pendingHomework: pendingHomeworks[0] || null,
        strongest,
        weakest,
        criticalTopic,
        mostFrequentError,
        priority: priorities,
        trendDelta,
        trendClassification,
        lastThreeDelta,
        timeline: timeline.slice(0, 7),
        upcomingLesson: summary.upcomingLesson || null,
        homeworkCompletionRate: summary.homeworkCompletionRate,
        homeworkCount: summary.homeworkCount,
        completedHomeworkCount: summary.completedHomeworkCount
    };
}

export function buildCockpitStatusItems(data) {
    const items = [];
    if (data.lastThreeDelta !== null) {
        items.push({
            tone: data.lastThreeDelta >= 0 ? 'positive' : 'critical',
            icon: data.lastThreeDelta >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down',
            text: data.lastThreeDelta >= 0
                ? `Son 3 genel denemede ${formatCockpitNet(data.lastThreeDelta)} net artış var.`
                : `Son 3 genel denemede ${formatCockpitNet(Math.abs(data.lastThreeDelta))} net düşüş var.`
        });
    }
    if (data.criticalTopic) items.push({ tone: 'warning', icon: 'fa-triangle-exclamation', text: `${data.criticalTopic.topic}, ${data.criticalTopic.errors} hatayla öncelikli konu.` });
    if (data.mostFrequentError) items.push({ tone: 'warning', icon: 'fa-magnifying-glass', text: `${data.mostFrequentError.label}, en sık görülen hata türü.` });
    if (data.homeworkCompletionRate !== null) items.push({ tone: data.homeworkCompletionRate >= 75 ? 'positive' : 'warning', icon: 'fa-list-check', text: `Ödev tamamlama oranı %${data.homeworkCompletionRate}.` });
    if (data.targetGap !== null) items.push({ tone: data.targetGap <= 0 ? 'positive' : 'neutral', icon: 'fa-bullseye', text: data.targetGap <= 0 ? 'Son deneme hedef nete ulaştı.' : `Hedef için ${formatCockpitNet(data.targetGap)} net daha gerekiyor.` });
    return items.slice(0, 4);
}

export const cockpitTimelineIcons = {
    exam: 'fa-file-lines',
    homework: 'fa-list-check',
    lesson: 'fa-book-open',
    growth: 'fa-chart-line'
};
