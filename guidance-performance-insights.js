// ==================== GUIDANCE PERFORMANCE INSIGHTS MODULE ====================
// UX-08 Rehberlik Performans Merkezi
// Pure, deterministic, read-only analytics for:
// 1. Ödev Performansı (Averages, Net Trend, Unit+Topic Weakness, Error Reasons & Trend)
// 2. Okul Denemeleri (LGS General Exams, 6 Canonical Subjects, Total & Subject Net Trends, Last Exam Diff)
// NO Firestore writes. NO database mutations. NO fabricated AI narratives.

import { calculateWorkNet } from './work-performance-insights.js';
import {
    HATA_NEDENLERI,
    normalizeHomeworkErrorAnalysis,
    normalizeHataNedeniKey,
    normalizeHataNedeniLabel
} from './homework-error-topics.js';

// Canonical 6 LGS Subjects Specification
export const LGS_SUBJECTS = [
    {
        key: 'Türkçe',
        name: 'Türkçe',
        fullName: 'Türkçe',
        shortName: 'TÜR',
        questionCount: 20,
        color: '#3B82F6', // Blue
        matchPatterns: ['türkçe', 'turkce', 'turk']
    },
    {
        key: 'Matematik',
        name: 'Matematik',
        fullName: 'Matematik',
        shortName: 'MAT',
        questionCount: 20,
        color: '#EF4444', // Red
        matchPatterns: ['matematik', 'mat']
    },
    {
        key: 'Fen Bilimleri',
        name: 'Fen Bilimleri',
        fullName: 'Fen Bilimleri',
        shortName: 'FEN',
        questionCount: 20,
        color: '#10B981', // Emerald
        matchPatterns: ['fen bilimleri', 'fen', 'fen_bilimleri']
    },
    {
        key: 'İnkılap Tarihi',
        name: 'İnkılap Tarihi',
        fullName: 'T.C. İnkılap Tarihi ve Atatürkçülük',
        shortName: 'İNK',
        questionCount: 10,
        color: '#F59E0B', // Amber
        matchPatterns: ['inkılap', 'inkilap', 'sosyal bilgiler', 'sosyal', 'tc inkılap', 't.c. inkılap']
    },
    {
        key: 'Din Kültürü',
        name: 'Din Kültürü',
        fullName: 'Din Kültürü ve Ahlak Bilgisi',
        shortName: 'DİN',
        questionCount: 10,
        color: '#8B5CF6', // Purple
        matchPatterns: ['din kültürü', 'din kulturu', 'din', 'ahlak']
    },
    {
        key: 'İngilizce',
        name: 'İngilizce',
        fullName: 'Yabancı Dil (İngilizce)',
        shortName: 'İNG',
        questionCount: 10,
        color: '#06B6D4', // Cyan
        matchPatterns: ['ingilizce', 'yabancı dil', 'yabanci dil', 'ing']
    }
];

export const LGS_TOTAL_QUESTIONS = 90;


function safeNumber(val) {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function roundTwo(val) {
    if (val === null || val === undefined || !Number.isFinite(Number(val))) return 0;
    return Number(Number(val).toFixed(2));
}

export function formatActivityDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return '';
    const parts = dateString.slice(0, 10).split('-');
    if (parts.length !== 3) return dateString;
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(date);
}

/**
 * Normalizes any subject name variation to one of the 6 canonical LGS subject keys.
 */
export function normalizeLgsSubject(rawName) {
    if (!rawName) return null;
    const lower = String(rawName).trim().toLocaleLowerCase('tr-TR');
    for (const sub of LGS_SUBJECTS) {
        if (sub.key.toLocaleLowerCase('tr-TR') === lower || sub.name.toLocaleLowerCase('tr-TR') === lower) {
            return sub.key;
        }
        if (sub.fullName && sub.fullName.toLocaleLowerCase('tr-TR') === lower) {
            return sub.key;
        }
        for (const pattern of sub.matchPatterns) {
            if (lower === pattern || lower.includes(pattern)) {
                return sub.key;
            }
        }
    }
    return null;
}

/**
 * Extracts normalized correct, wrong, blank, net, and presence for each canonical subject from an exam.
 */
export function getExamSubjectResults(exam) {
    const results = {};
    for (const sub of LGS_SUBJECTS) {
        results[sub.key] = {
            dogru: 0,
            yanlis: 0,
            bos: sub.questionCount,
            net: 0,
            questionCount: sub.questionCount,
            hasData: false
        };
    }

    if (!exam || !exam.dersSonuclari || typeof exam.dersSonuclari !== 'object') {
        return results;
    }

    for (const [rawKey, val] of Object.entries(exam.dersSonuclari)) {
        const canonicalKey = normalizeLgsSubject(rawKey);
        if (canonicalKey && results[canonicalKey] && val && typeof val === 'object') {
            const dogru = safeNumber(val.dogru);
            const yanlis = safeNumber(val.yanlis);
            const totalSoru = results[canonicalKey].questionCount;
            const bos = (val.bos !== undefined && val.bos !== null && Number.isFinite(Number(val.bos)))
                ? safeNumber(val.bos)
                : Math.max(0, totalSoru - dogru - yanlis);
            const rawNet = dogru - (yanlis / 3);
            const net = roundTwo(rawNet);
            results[canonicalKey] = {
                dogru,
                yanlis,
                bos,
                net,
                questionCount: totalSoru,
                hasData: true
            };
        }
    }

    return results;
}

// ==================== TAB A: ÖDEV PERFORMANSI ====================

/**
 * Builds deterministic analytics for homework performance.
 *
 * @param {Object} student - Student data object
 * @param {Array} [homeworks] - Optional homeworks array (fallback to student.odevler)
 * @param {Object} [options] - Options (range: 'all' | 'last5' | 'last10')
 */
export function buildHomeworkPerformanceInsights(student, homeworks = null, options = {}) {
    const sourceHomeworks = Array.isArray(homeworks)
        ? homeworks
        : (Array.isArray(student?.odevler) ? student.odevler : []);

    const totalAssigned = sourceHomeworks.length;

    // Filter strictly completed homeworks with recorded scores or error analysis
    const completedRecords = sourceHomeworks
        .filter(hw => {
            if (!hw || hw.durum !== 'tamamlandi') return false;
            const hasScore = (hw.dogru !== null && hw.dogru !== undefined) || (hw.yanlis !== null && hw.yanlis !== undefined);
            const hasErrors = (Array.isArray(hw.yanlisAnalizi) && hw.yanlisAnalizi.length > 0) ||
                              (Array.isArray(hw.yanlisKonular) && hw.yanlisKonular.length > 0);
            return hasScore || hasErrors;
        })
        .map(hw => {
            const rawErrors = normalizeHomeworkErrorAnalysis(hw);
            const errorsSum = rawErrors.reduce((acc, err) => acc + (safeNumber(err.adet) || 1), 0);
            const hasExplicitCorrect = hw.dogru !== null && hw.dogru !== undefined;
            const hasExplicitWrong = hw.yanlis !== null && hw.yanlis !== undefined;

            const correct = hasExplicitCorrect ? safeNumber(hw.dogru) : 0;
            const wrong = hasExplicitWrong ? safeNumber(hw.yanlis) : errorsSum;
            const net = roundTwo(correct - (wrong / 3));
            const date = hw.bitisTarihi || hw.baslamaTarihi || hw.tarih || '';
            return {
                id: hw.id || '',
                date,
                formattedDate: formatActivityDate(date),
                title: hw.calismaDetayi || hw.konu || 'Ödev Çalışması',
                konu: hw.konu || '',
                unite: hw.unite || '',
                yayin: hw.yayin || '',
                tur: hw.tur || 'Ödev',
                correct,
                wrong,
                net,
                hasExplicitScore: hasExplicitCorrect,
                rawHomework: hw
            };
        })
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const count = completedRecords.length;

    // Summary KPIs
    const averageCorrect = count ? roundTwo(completedRecords.reduce((sum, r) => sum + r.correct, 0) / count) : null;
    const averageWrong = count ? roundTwo(completedRecords.reduce((sum, r) => sum + r.wrong, 0) / count) : null;
    const averageNet = count ? roundTwo(completedRecords.reduce((sum, r) => sum + r.net, 0) / count) : null;
    const latestNet = count ? completedRecords[count - 1].net : null;
    const previousNet = count >= 2 ? completedRecords[count - 2].net : null;
    const netChange = count >= 2 && latestNet !== null && previousNet !== null
        ? roundTwo(latestNet - previousNet)
        : null;

    let trendDirection = 'insufficient_data';
    if (count >= 2 && netChange !== null) {
        if (netChange >= 0.5) trendDirection = 'improving';
        else if (netChange <= -0.5) trendDirection = 'declining';
        else trendDirection = 'stable';
    }

    // Trend Series slices
    const trendSeries = completedRecords.map(r => ({
        id: r.id,
        date: r.date,
        formattedDate: r.formattedDate,
        title: r.title,
        konu: r.konu,
        unite: r.unite,
        yayin: r.yayin,
        tur: r.tur,
        correct: r.correct,
        wrong: r.wrong,
        net: r.net
    }));

    // Weak topics aggregation (Unit + Topic, NO kazanım)
    const topicMap = new Map();
    for (const record of completedRecords) {
        const errors = normalizeHomeworkErrorAnalysis(record.rawHomework);
        for (const item of errors) {
            const unite = String(item.unite || 'Genel').trim();
            const konu = String(item.konu || 'Genel').trim();
            const key = `${unite}:::${konu}`;
            const adet = Math.max(1, safeNumber(item.adet || 1));

            if (!topicMap.has(key)) {
                topicMap.set(key, {
                    unite,
                    konu,
                    errorCount: 0,
                    assignmentIds: new Set(),
                    lastSeenDate: record.date
                });
            }

            const entry = topicMap.get(key);
            entry.errorCount += adet;
            entry.assignmentIds.add(record.id);
            if (String(record.date).localeCompare(String(entry.lastSeenDate || '')) > 0) {
                entry.lastSeenDate = record.date;
            }
        }
    }

    const weakTopics = Array.from(topicMap.values())
        .map(entry => {
            const assignmentCount = entry.assignmentIds.size;
            let status = 'watch';
            if (assignmentCount >= 3 || entry.errorCount >= 5) {
                status = 'chronic';
            } else if (assignmentCount >= 2) {
                status = 'repeated';
            }
            return {
                unite: entry.unite,
                konu: entry.konu,
                errorCount: entry.errorCount,
                assignmentCount,
                lastSeenDate: entry.lastSeenDate,
                formattedLastSeenDate: formatActivityDate(entry.lastSeenDate),
                status
            };
        })
        .sort((a, b) => b.errorCount - a.errorCount || b.assignmentCount - a.assignmentCount);

    // Error Reasons aggregation (Canonical 7 keys)
    const errorCountMap = {
        bilgi_eksikligi: 0,
        dikkatsizlik: 0,
        yanlis_okuma: 0,
        sure_yetmedi: 0,
        islem_hatasi: 0,
        yorumlama_hatasi: 0,
        diger: 0
    };
    let totalErrorsCounted = 0;

    for (const record of completedRecords) {
        const errors = normalizeHomeworkErrorAnalysis(record.rawHomework);
        for (const item of errors) {
            const adet = Math.max(1, safeNumber(item.adet || 1));
            const keys = (item.hataNedenleriKeys && item.hataNedenleriKeys.length)
                ? item.hataNedenleriKeys
                : (item.hataNedenleri || []).map(normalizeHataNedeniKey);

            if (keys.length === 0) {
                errorCountMap.diger += adet;
                totalErrorsCounted += adet;
            } else {
                for (const k of keys) {
                    const canonicalKey = normalizeHataNedeniKey(k);
                    if (errorCountMap[canonicalKey] !== undefined) {
                        errorCountMap[canonicalKey] += adet;
                    } else {
                        errorCountMap.diger += adet;
                    }
                    totalErrorsCounted += adet;
                }
            }
        }
    }

    const errorReasons = HATA_NEDENLERI.map(item => {
        const count = errorCountMap[item.key] || 0;
        const percentage = totalErrorsCounted > 0 ? Math.round((count / totalErrorsCounted) * 100) : 0;
        return {
            key: item.key,
            label: item.label,
            shortKod: item.shortKod,
            color: item.color,
            count,
            percentage
        };
    }).sort((a, b) => b.count - a.count);

    const dominantErrorType = errorReasons.length && errorReasons[0].count > 0
        ? errorReasons[0]
        : null;

    // Error category breakdown (Conceptual vs Technique)
    const academicCount = (errorCountMap.bilgi_eksikligi || 0) + (errorCountMap.yorumlama_hatasi || 0);
    const techniqueCount = (errorCountMap.dikkatsizlik || 0) + (errorCountMap.yanlis_okuma || 0) + (errorCountMap.sure_yetmedi || 0) + (errorCountMap.islem_hatasi || 0);
    const otherCount = errorCountMap.diger || 0;

    const errorCategoryBreakdown = {
        academic: {
            label: 'Kavramsal / Bilgi (Bilgi + Yorumlama)',
            count: academicCount,
            percentage: totalErrorsCounted > 0 ? Math.round((academicCount / totalErrorsCounted) * 100) : 0
        },
        technique: {
            label: 'Sınav Tekniği (Dikkatsizlik + Soru Okuma + Süre + İşlem)',
            count: techniqueCount,
            percentage: totalErrorsCounted > 0 ? Math.round((techniqueCount / totalErrorsCounted) * 100) : 0
        },
        other: {
            label: 'Diğer',
            count: otherCount,
            percentage: totalErrorsCounted > 0 ? Math.round((otherCount / totalErrorsCounted) * 100) : 0
        }
    };

    // Deterministic Guidance Narrative (Rule-based, NO AI hallucination)
    let narrative = '';
    if (count === 0) {
        narrative = 'Değerlendirme için henüz tamamlanmış ödev verisi bulunmuyor.';
    } else if (count === 1) {
        narrative = `Öğrencinin 1 tamamlanmış ödevi bulunuyor (Net: ${latestNet}). Gelişim seyrini değerlendirmek için sonraki ödev sonuçları izlenmelidir.`;
    } else {
        const parts = [];

        // 1. Trend statement
        if (trendDirection === 'improving') {
            parts.push(`Ödev netlerinde son çalışmalarda yukarı yönlü pozitif bir ivme görülüyor (Son net: ${latestNet}, değişim: +${netChange}).`);
        } else if (trendDirection === 'declining') {
            parts.push(`Ödev netlerinde son çalışmalarda düşüş eğilimi gözleniyor (Son net: ${latestNet}, değişim: ${netChange}). Düzenli tekrar ve pekiştirme gereklidir.`);
        } else {
            parts.push(`Ödev netleri istikrarlı bir seyir izliyor (Ortalama: ${averageNet} net, son net: ${latestNet}).`);
        }

        // 2. Error reason root cause
        if (dominantErrorType) {
            if (dominantErrorType.key === 'bilgi_eksikligi') {
                parts.push(`Hataların %${dominantErrorType.percentage}'i temel bilgi ve kavram eksikliğinden kaynaklanıyor; konu özetli çalışma ve temel kazanım testleri önerilir.`);
            } else if (dominantErrorType.key === 'dikkatsizlik' || dominantErrorType.key === 'yanlis_okuma') {
                parts.push(`Hatalarda soru köklerini eksik okuma ve dikkatsizlik belirleyici faktör (%${dominantErrorType.percentage}); soru altını çizerek okuma ve son kontrol disiplini uygulanmalıdır.`);
            } else if (dominantErrorType.key === 'sure_yetmedi') {
                parts.push(`Hatalarda süre baskısı ve zaman yönetimi öne çıkıyor (%${dominantErrorType.percentage}); süreli mini testler ve turlama tekniği çalışılmalıdır.`);
            } else if (dominantErrorType.key === 'islem_hatasi') {
                parts.push(`İşlem basamaklarında hata yoğunluğu (%${dominantErrorType.percentage}) görülüyor; işlem adımlarını yazarak çözme alışkanlığı geliştirilmelidir.`);
            } else if (dominantErrorType.key === 'yorumlama_hatasi') {
                parts.push(`Yeni nesil yorumlama ve mantık çıkarımında zorlanma (%${dominantErrorType.percentage}) var; grafik ve tablo yorumlama sorularına ağırlık verilmelidir.`);
            }
        }

        // 3. Chronic or repeated topics
        const chronicTopics = weakTopics.filter(t => t.status === 'chronic');
        const repeatedTopics = weakTopics.filter(t => t.status === 'repeated');
        if (chronicTopics.length > 0) {
            const topicNames = chronicTopics.slice(0, 2).map(t => `${t.unite} - ${t.konu}`).join(', ');
            parts.push(`Özellikle ${topicNames} konularında hatalar kronikleşme eğiliminde olup birebir etüt veya hedefli ödevle müdahale gerektiriyor.`);
        } else if (repeatedTopics.length > 0) {
            const topicNames = repeatedTopics.slice(0, 2).map(t => `${t.unite} - ${t.konu}`).join(', ');
            parts.push(`Özellikle ${topicNames} konularındaki tekrarlayan hatalar yakın takibe alınmalıdır.`);
        }

        narrative = parts.join(' ');
    }

    return {
        summary: {
            totalCompleted: count,
            totalAssigned,
            averageCorrect,
            averageWrong,
            averageNet,
            latestNet,
            previousNet,
            netChange,
            trendDirection,
            dominantError: dominantErrorType
        },
        trendSeries,
        slices: {
            last5: trendSeries.slice(-5),
            last10: trendSeries.slice(-10),
            all: trendSeries
        },
        weakTopics,
        errorReasons,
        dominantErrorType,
        errorCategoryBreakdown,
        narrative
    };
}

// ==================== TAB B: OKUL DENEMELERİ (LGS Genel Denemeleri) ====================

/**
 * Builds deterministic analytics for school exams (LGS general exams).
 * Strictly excludes branch exams (tip === 'branş').
 *
 * @param {Object} student - Student data object
 * @param {Object} [options] - Options (range: 'all' | 'last5' | 'last10')
 */
export function buildSchoolExamPerformanceInsights(student, options = {}) {
    const rawExams = Array.isArray(student?.denemeler) ? student.denemeler : [];

    // STRICT FILTER: Only general school exams (tip === 'genel' without branch ders)
    const generalExams = rawExams
        .filter(exam => exam && typeof exam === 'object' && exam.tip === 'genel' && !exam.ders)
        .sort((a, b) => String(a.tarih || '').localeCompare(String(b.tarih || '')));

    const examCount = generalExams.length;

    // Process each exam
    const processedExams = generalExams.map(exam => {
        const subjectResults = getExamSubjectResults(exam);
        let calculatedTotalNet = 0;
        let calculatedTotalDogru = 0;
        let calculatedTotalYanlis = 0;
        let calculatedTotalBos = 0;

        for (const sub of LGS_SUBJECTS) {
            const sr = subjectResults[sub.key];
            if (sr.hasData) {
                calculatedTotalNet += sr.net;
                calculatedTotalDogru += sr.dogru;
                calculatedTotalYanlis += sr.yanlis;
                calculatedTotalBos += sr.bos;
            } else {
                calculatedTotalBos += sr.bos;
            }
        }

        const totalNet = (exam.toplamNet !== undefined && exam.toplamNet !== null && Number.isFinite(Number(exam.toplamNet)))
            ? roundTwo(exam.toplamNet)
            : roundTwo(calculatedTotalNet);

        const totalDogru = (exam.toplamDogru !== undefined && exam.toplamDogru !== null && Number.isFinite(Number(exam.toplamDogru)))
            ? safeNumber(exam.toplamDogru)
            : calculatedTotalDogru;

        const totalYanlis = (exam.toplamYanlis !== undefined && exam.toplamYanlis !== null && Number.isFinite(Number(exam.toplamYanlis)))
            ? safeNumber(exam.toplamYanlis)
            : calculatedTotalYanlis;

        const totalBos = (exam.toplamBos !== undefined && exam.toplamBos !== null && Number.isFinite(Number(exam.toplamBos)))
            ? safeNumber(exam.toplamBos)
            : calculatedTotalBos;

        return {
            id: exam.id || '',
            name: exam.denemeAdi || 'Genel Deneme',
            date: exam.tarih || '',
            formattedDate: formatActivityDate(exam.tarih),
            totalNet,
            totalDogru,
            totalYanlis,
            totalBos,
            subjectResults,
            rawExam: exam
        };
    });

    // Summary KPIs
    const latestExam = examCount ? processedExams[examCount - 1] : null;
    const previousExam = examCount >= 2 ? processedExams[examCount - 2] : null;
    const latestTotalNet = latestExam ? latestExam.totalNet : null;
    const previousTotalNet = previousExam ? previousExam.totalNet : null;
    const averageTotalNet = examCount
        ? roundTwo(processedExams.reduce((sum, e) => sum + e.totalNet, 0) / examCount)
        : null;

    const totalNetChange = examCount >= 2 && latestTotalNet !== null && previousTotalNet !== null
        ? roundTwo(latestTotalNet - previousTotalNet)
        : null;

    let trendDirection = 'insufficient_data';
    if (examCount >= 2 && totalNetChange !== null) {
        if (totalNetChange >= 1.5) trendDirection = 'improving';
        else if (totalNetChange <= -1.5) trendDirection = 'declining';
        else trendDirection = 'stable';
    }

    // Total Net Series
    const totalNetSeries = processedExams.map(e => ({
        id: e.id,
        name: e.name,
        date: e.date,
        formattedDate: e.formattedDate,
        totalNet: e.totalNet,
        totalDogru: e.totalDogru,
        totalYanlis: e.totalYanlis,
        totalBos: e.totalBos
    }));

    // Subject Performance Table (6 canonical LGS subjects)
    const subjectPerformance = LGS_SUBJECTS.map(sub => {
        let sumDogru = 0;
        let sumYanlis = 0;
        let sumNet = 0;
        let participatedExamCount = 0;

        for (const e of processedExams) {
            const sr = e.subjectResults[sub.key];
            if (sr && sr.hasData) {
                participatedExamCount++;
                sumDogru += sr.dogru;
                sumYanlis += sr.yanlis;
                sumNet += sr.net;
            }
        }

        const hasData = participatedExamCount > 0;
        const averageDogru = hasData ? roundTwo(sumDogru / participatedExamCount) : 0;
        const averageYanlis = hasData ? roundTwo(sumYanlis / participatedExamCount) : 0;
        const averageNet = hasData ? roundTwo(sumNet / participatedExamCount) : (examCount > 0 ? null : 0);
        const performanceRate = hasData ? roundTwo(averageNet / sub.questionCount) : null;
        const performancePercent = hasData ? roundTwo((averageNet / sub.questionCount) * 100) : null;

        const latestSub = (latestExam && latestExam.subjectResults[sub.key]?.hasData)
            ? latestExam.subjectResults[sub.key]
            : null;
        const prevSub = (previousExam && previousExam.subjectResults[sub.key]?.hasData)
            ? previousExam.subjectResults[sub.key]
            : null;

        const latestHasData = Boolean(latestSub);
        const latestDogru = latestSub ? latestSub.dogru : 0;
        const latestYanlis = latestSub ? latestSub.yanlis : 0;
        const latestBos = latestSub ? latestSub.bos : sub.questionCount;
        const latestNet = latestSub ? latestSub.net : 0;

        const previousNet = prevSub ? prevSub.net : null;
        const change = (latestSub && prevSub) ? roundTwo(latestSub.net - prevSub.net) : null;

        const successRate = latestHasData ? roundTwo((latestNet / sub.questionCount) * 100) : (hasData ? performancePercent : 0);
        let status = 'moderate';
        if (!hasData) {
            status = 'no_data';
        } else {
            const evalRate = (performancePercent !== null) ? performancePercent : successRate;
            if (evalRate >= 75) {
                status = 'strong';
            } else if (evalRate < 45) {
                status = 'needs_intervention';
            }
        }

        return {
            key: sub.key,
            name: sub.fullName || sub.name,
            shortName: sub.shortName,
            questionCount: sub.questionCount,
            color: sub.color,
            hasData,
            participatedExamCount,
            latestDogru,
            latestYanlis,
            latestBos,
            latestNet,
            averageDogru,
            averageYanlis,
            averageNet,
            previousNet,
            change,
            performanceRate,
            performancePercent,
            successRate,
            status
        };
    });

    // Determine strongest and weakest subjects (by normalized performanceRate across participated exams)
    const eligibleSubjects = subjectPerformance.filter(s => s.hasData && s.performanceRate !== null);
    let strongestSubject = null;
    let weakestSubject = null;

    if (eligibleSubjects.length > 0) {
        const sortedByPerformance = [...eligibleSubjects].sort((a, b) => {
            const diff = b.performanceRate - a.performanceRate;
            if (Math.abs(diff) > 0.00001) return diff;
            return b.averageNet - a.averageNet;
        });

        strongestSubject = sortedByPerformance[0] || null;
        if (sortedByPerformance.length > 1) {
            weakestSubject = sortedByPerformance[sortedByPerformance.length - 1] || null;
        } else {
            weakestSubject = null;
        }
    }

    // Subject Trend Series (for line chart per subject)
    const subjectTrendSeries = {};
    for (const sub of LGS_SUBJECTS) {
        subjectTrendSeries[sub.key] = processedExams.map(e => ({
            id: e.id,
            examName: e.name,
            date: e.date,
            formattedDate: e.formattedDate,
            net: e.subjectResults[sub.key].net,
            dogru: e.subjectResults[sub.key].dogru,
            yanlis: e.subjectResults[sub.key].yanlis,
            bos: e.subjectResults[sub.key].bos,
            hasData: e.subjectResults[sub.key].hasData
        }));
    }

    // Last Exam Comparison (Diff between latest and previous)
    let lastExamComparison = {
        hasComparison: false,
        latestExamName: latestExam ? latestExam.name : '',
        previousExamName: previousExam ? previousExam.name : '',
        totalDelta: 0,
        biggestGain: null,
        biggestLoss: null,
        subjectDeltas: []
    };

    if (examCount >= 2 && latestExam && previousExam) {
        const subjectDeltas = LGS_SUBJECTS.map(sub => {
            const lSub = latestExam.subjectResults[sub.key];
            const pSub = previousExam.subjectResults[sub.key];
            const hasDataInBoth = Boolean(lSub?.hasData && pSub?.hasData);
            const lNet = lSub?.hasData ? lSub.net : null;
            const pNet = pSub?.hasData ? pSub.net : null;
            const delta = hasDataInBoth ? roundTwo(lNet - pNet) : null;
            return {
                key: sub.key,
                name: sub.name,
                shortName: sub.shortName,
                delta,
                hasDataInBoth,
                latestNet: lNet,
                previousNet: pNet
            };
        }).filter(d => d.hasDataInBoth)
          .sort((a, b) => b.delta - a.delta);

        const positiveGains = subjectDeltas.filter(d => d.delta > 0);
        const negativeLosses = subjectDeltas.filter(d => d.delta < 0);

        lastExamComparison = {
            hasComparison: true,
            latestExamName: latestExam.name,
            previousExamName: previousExam.name,
            totalDelta: totalNetChange || 0,
            biggestGain: positiveGains.length ? positiveGains[0] : null,
            biggestLoss: negativeLosses.length ? negativeLosses[negativeLosses.length - 1] : null,
            subjectDeltas
        };
    }

    // Deterministic Guidance Narrative (Rule-based, NO AI hallucination)
    let narrative = '';
    if (examCount === 0) {
        narrative = 'Değerlendirme için henüz okul denemesi (genel deneme) kaydı bulunmuyor.';
    } else if (examCount === 1) {
        narrative = `Öğrencinin kayıtlı 1 genel denemesi bulunuyor (Toplam net: ${latestTotalNet}). Karşılaştırma ve gelişim seyrini görmek için ikinci deneme sonucu bekleniyor.`;
    } else {
        const parts = [];

        // 1. Total Net Trajectory
        if (totalNetChange !== null && totalNetChange >= 1.5) {
            parts.push(`Genel denemelerde son sınavda toplam net +${totalNetChange} artarak ${latestTotalNet} seviyesine ulaştı ve olumlu bir yükseliş ivmesi yakalandı.`);
        } else if (totalNetChange !== null && totalNetChange <= -1.5) {
            parts.push(`Son sınavda toplam net ${totalNetChange} düşüşle ${latestTotalNet} seviyesine geriledi; gerileyen derslere dönük telafi planlanmalıdır.`);
        } else {
            parts.push(`Genel deneme netleri dengeli bir seyir izliyor (Son sınav: ${latestTotalNet} net, ortalama: ${averageTotalNet} net).`);
        }

        // 2. Strongest & Weakest Subjects
        if (strongestSubject && weakestSubject && strongestSubject.key !== weakestSubject.key) {
            parts.push(`Öğrencinin en istikrarlı olduğu alan ${strongestSubject.name} (${strongestSubject.averageNet} ortalama net, %${Math.round(strongestSubject.performancePercent)}) iken, genel başarıyı en çok sınırlayan ders ${weakestSubject.name} (${weakestSubject.averageNet} ortalama net, %${Math.round(weakestSubject.performancePercent)}) olarak öne çıkıyor.`);
        }

        // 3. Last exam movers
        if (lastExamComparison.hasComparison) {
            if (lastExamComparison.biggestGain) {
                parts.push(`Son sınavda en belirgin sıçrama ${lastExamComparison.biggestGain.name} (+${lastExamComparison.biggestGain.delta} net) dersinde kaydedildi.`);
            }
            if (lastExamComparison.biggestLoss) {
                parts.push(`Buna karşın ${lastExamComparison.biggestLoss.name} (${lastExamComparison.biggestLoss.delta} net) dersindeki gerileme toplam net artışını kısıtladı.`);
            }
        }

        narrative = parts.join(' ');
    }

    return {
        summary: {
            examCount,
            latestTotalNet,
            previousTotalNet,
            averageTotalNet,
            totalNetChange,
            trendDirection,
            strongestSubject,
            weakestSubject,
            maxTotalNet: LGS_TOTAL_QUESTIONS,
            totalQuestions: LGS_TOTAL_QUESTIONS
        },
        totalNetSeries,
        slices: {
            last5: totalNetSeries.slice(-5),
            last10: totalNetSeries.slice(-10),
            all: totalNetSeries
        },
        subjectPerformance,
        subjectTrendSeries,
        lastExamComparison,
        narrative
    };
}
