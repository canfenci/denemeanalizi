import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildHomeworkPerformanceInsights,
    buildSchoolExamPerformanceInsights,
    normalizeLgsSubject,
    getExamSubjectResults,
    LGS_SUBJECTS,
    LGS_TOTAL_QUESTIONS
} from '../guidance-performance-insights.js';

// ==================== TAB A: ÖDEV PERFORMANSI TESTLERİ ====================

test('UX-08 Scenario A: Gracefully handles student with no homework data', () => {
    const student = { id: 's1', adSoyad: 'Test Öğrenci', odevler: [] };
    const insights = buildHomeworkPerformanceInsights(student);

    assert.equal(insights.summary.totalCompleted, 0);
    assert.equal(insights.summary.totalAssigned, 0);
    assert.equal(insights.summary.averageCorrect, null);
    assert.equal(insights.summary.averageWrong, null);
    assert.equal(insights.summary.averageNet, null);
    assert.equal(insights.summary.latestNet, null);
    assert.equal(insights.summary.previousNet, null);
    assert.equal(insights.summary.netChange, null);
    assert.equal(insights.summary.trendDirection, 'insufficient_data');
    assert.equal(insights.summary.dominantError, null);
    assert.equal(insights.trendSeries.length, 0);
    assert.equal(insights.weakTopics.length, 0);
    assert.equal(insights.errorReasons.length, 7); // 7 canonical reasons with 0 count
    assert.equal(insights.dominantErrorType, null);
    assert.ok(insights.narrative.includes('Değerlendirme için henüz tamamlanmış ödev verisi bulunmuyor'));
});

test('UX-08 Scenario B: Ignores pending/incomplete homeworks and only uses completed homeworks with scores', () => {
    const student = {
        id: 's2',
        odevler: [
            { id: 'hw1', durum: 'bekliyor', konu: 'Hücre', dogru: 10, yanlis: 2 },
            { id: 'hw2', durum: 'tamamlandi', konu: 'Mitoz', dogru: 18, yanlis: 3, bitisTarihi: '2026-08-01' },
            { id: 'hw3', durum: 'verildi', konu: 'Mayoz' }
        ]
    };

    const insights = buildHomeworkPerformanceInsights(student);
    assert.equal(insights.summary.totalAssigned, 3);
    assert.equal(insights.summary.totalCompleted, 1);
    assert.equal(insights.summary.latestNet, 17); // 18 - (3 / 3) = 17
    assert.equal(insights.summary.averageNet, 17);
    assert.equal(insights.summary.trendDirection, 'insufficient_data'); // only 1 completed
});

test('UX-08 Scenario C: Calculates accurate KPIs across completed homeworks using calculateWorkNet', () => {
    const student = {
        id: 's3',
        odevler: [
            { id: 'hw1', durum: 'tamamlandi', dogru: 15, yanlis: 3, bitisTarihi: '2026-08-01' }, // Net: 14.0
            { id: 'hw2', durum: 'tamamlandi', dogru: 18, yanlis: 3, bitisTarihi: '2026-08-05' }, // Net: 17.0
            { id: 'hw3', durum: 'tamamlandi', dogru: 20, yanlis: 0, bitisTarihi: '2026-08-10' }  // Net: 20.0
        ]
    };

    const insights = buildHomeworkPerformanceInsights(student);
    assert.equal(insights.summary.totalCompleted, 3);
    assert.equal(insights.summary.averageCorrect, 17.67); // (15+18+20)/3 = 17.666... -> 17.67
    assert.equal(insights.summary.averageWrong, 2); // (3+3+0)/3 = 2
    assert.equal(insights.summary.averageNet, 17); // (14+17+20)/3 = 17
    assert.equal(insights.summary.latestNet, 20);
    assert.equal(insights.summary.previousNet, 17);
    assert.equal(insights.summary.netChange, 3); // 20 - 17 = +3
    assert.equal(insights.summary.trendDirection, 'improving');
});

test('UX-08 Scenario D: Sorts homeworks chronologically ascending for trend series and supports slices', () => {
    const student = {
        id: 's4',
        odevler: [
            { id: 'hw3', durum: 'tamamlandi', dogru: 10, yanlis: 0, bitisTarihi: '2026-08-20' },
            { id: 'hw1', durum: 'tamamlandi', dogru: 10, yanlis: 0, bitisTarihi: '2026-08-01' },
            { id: 'hw2', durum: 'tamamlandi', dogru: 10, yanlis: 0, bitisTarihi: '2026-08-10' }
        ]
    };

    const insights = buildHomeworkPerformanceInsights(student);
    assert.equal(insights.trendSeries[0].id, 'hw1');
    assert.equal(insights.trendSeries[1].id, 'hw2');
    assert.equal(insights.trendSeries[2].id, 'hw3');
    assert.equal(insights.slices.last5.length, 3);
});

test('UX-08 Scenario E: Detects declining and stable trend directions accurately', () => {
    const decliningStudent = {
        odevler: [
            { id: 'hw1', durum: 'tamamlandi', dogru: 20, yanlis: 0, bitisTarihi: '2026-08-01' }, // Net 20
            { id: 'hw2', durum: 'tamamlandi', dogru: 15, yanlis: 6, bitisTarihi: '2026-08-05' }  // Net 13 (-7)
        ]
    };
    const decInsights = buildHomeworkPerformanceInsights(decliningStudent);
    assert.equal(decInsights.summary.trendDirection, 'declining');
    assert.equal(decInsights.summary.netChange, -7);

    const stableStudent = {
        odevler: [
            { id: 'hw1', durum: 'tamamlandi', dogru: 18, yanlis: 3, bitisTarihi: '2026-08-01' }, // Net 17
            { id: 'hw2', durum: 'tamamlandi', dogru: 18, yanlis: 2, bitisTarihi: '2026-08-05' }  // Net 17.33 (+0.33)
        ]
    };
    const stableInsights = buildHomeworkPerformanceInsights(stableStudent);
    assert.equal(stableInsights.summary.trendDirection, 'stable');
});

test('UX-08 Scenario F: Aggregates weak topics by Unit + Topic (no kazanım) and classifies chronic vs repeated', () => {
    const student = {
        id: 's5',
        odevler: [
            {
                id: 'hw1',
                durum: 'tamamlandi',
                bitisTarihi: '2026-08-01',
                yanlisAnalizi: [
                    { unite: 'Basınç', konu: 'Katı Basıncı', adet: 3 },
                    { unite: 'Mevsimler', konu: 'İklim', adet: 2 }
                ]
            },
            {
                id: 'hw2',
                durum: 'tamamlandi',
                bitisTarihi: '2026-08-05',
                yanlisAnalizi: [
                    { unite: 'Basınç', konu: 'Katı Basıncı', adet: 3 } // Katı Basıncı total = 6 errors, 2 assignments -> chronic (>=5 errors)
                ]
            },
            {
                id: 'hw3',
                durum: 'tamamlandi',
                bitisTarihi: '2026-08-10',
                yanlisAnalizi: [
                    { unite: 'Mevsimler', konu: 'İklim', adet: 1 } // İklim total = 3 errors, 2 assignments -> repeated (>=2 assignments)
                ]
            }
        ]
    };

    const insights = buildHomeworkPerformanceInsights(student);
    assert.equal(insights.weakTopics.length, 2);

    const katiBasinci = insights.weakTopics.find(t => t.konu === 'Katı Basıncı');
    assert.ok(katiBasinci);
    assert.equal(katiBasinci.unite, 'Basınç');
    assert.equal(katiBasinci.errorCount, 6);
    assert.equal(katiBasinci.assignmentCount, 2);
    assert.equal(katiBasinci.status, 'chronic');

    const iklim = insights.weakTopics.find(t => t.konu === 'İklim');
    assert.ok(iklim);
    assert.equal(iklim.unite, 'Mevsimler');
    assert.equal(iklim.errorCount, 3);
    assert.equal(iklim.assignmentCount, 2);
    assert.equal(iklim.status, 'repeated');
});

test('UX-08 Scenario G: Aggregates error reasons across canonical 7 keys with accurate percentages', () => {
    const student = {
        odevler: [
            {
                id: 'hw1',
                durum: 'tamamlandi',
                yanlisAnalizi: [
                    { unite: 'Maddenin Halleri', konu: 'Isı Alışverişi', adet: 4, hataNedenleri: ['bilgi_eksikligi'] },
                    { unite: 'Maddenin Halleri', konu: 'Isı Alışverişi', adet: 1, hataNedenleri: ['dikkatsizlik'] }
                ]
            }
        ]
    };

    const insights = buildHomeworkPerformanceInsights(student);
    assert.equal(insights.errorReasons.length, 7);

    const bilgi = insights.errorReasons.find(r => r.key === 'bilgi_eksikligi');
    assert.equal(bilgi.count, 4);
    assert.equal(bilgi.percentage, 80);

    const dikkatsiz = insights.errorReasons.find(r => r.key === 'dikkatsizlik');
    assert.equal(dikkatsiz.count, 1);
    assert.equal(dikkatsiz.percentage, 20);

    assert.equal(insights.dominantErrorType.key, 'bilgi_eksikligi');
    assert.equal(insights.errorCategoryBreakdown.academic.percentage, 80);
    assert.equal(insights.errorCategoryBreakdown.technique.percentage, 20);
});

test('UX-08 Scenario H: Deterministic guidance narrative includes trend, dominant error, and chronic topics', () => {
    const student = {
        odevler: [
            {
                id: 'hw1',
                durum: 'tamamlandi',
                bitisTarihi: '2026-08-01',
                dogru: 14,
                yanlis: 6,
                yanlisAnalizi: [{ unite: 'Basınç', konu: 'Gaz Basıncı', adet: 5, hataNedenleri: ['bilgi_eksikligi'] }]
            },
            {
                id: 'hw2',
                durum: 'tamamlandi',
                bitisTarihi: '2026-08-10',
                dogru: 18,
                yanlis: 3,
                yanlisAnalizi: [{ unite: 'Basınç', konu: 'Gaz Basıncı', adet: 2, hataNedenleri: ['bilgi_eksikligi'] }]
            }
        ]
    };

    const insights = buildHomeworkPerformanceInsights(student);
    assert.ok(insights.narrative.includes('pozitif bir ivme') || insights.narrative.includes('yukarı yönlü'));
    assert.ok(insights.narrative.includes('bilgi ve kavram eksikliği'));
    assert.ok(insights.narrative.includes('Gaz Basıncı'));
});

// ==================== TAB B: OKUL DENEMELERİ TESTLERİ ====================

test('UX-08 Scenario I: Gracefully handles student with zero exams', () => {
    const student = { id: 's_no_exams', denemeler: [] };
    const insights = buildSchoolExamPerformanceInsights(student);

    assert.equal(insights.summary.examCount, 0);
    assert.equal(insights.summary.latestTotalNet, null);
    assert.equal(insights.summary.previousTotalNet, null);
    assert.equal(insights.summary.averageTotalNet, null);
    assert.equal(insights.summary.totalNetChange, null);
    assert.equal(insights.summary.trendDirection, 'insufficient_data');
    assert.equal(insights.summary.strongestSubject, null);
    assert.equal(insights.summary.weakestSubject, null);
    assert.equal(insights.totalNetSeries.length, 0);
    assert.equal(insights.subjectPerformance.length, 6);
    assert.equal(insights.lastExamComparison.hasComparison, false);
    assert.ok(insights.narrative.includes('Değerlendirme için henüz okul denemesi'));
});

test('UX-08 Scenario J: Strict domain separation - branch exams (tip === "branş") are completely excluded', () => {
    const student = {
        denemeler: [
            {
                id: 'branch1',
                tip: 'branş',
                denemeAdi: 'Fen Branş Denemesi',
                toplamNet: 18,
                ders: 'Fen Bilimleri'
            },
            {
                id: 'genel1',
                tip: 'genel',
                denemeAdi: '1. Okul LGS Denemesi',
                toplamNet: 65,
                tarih: '2026-08-01',
                dersSonuclari: {
                    'Türkçe': { dogru: 16, yanlis: 3 },
                    'Matematik': { dogru: 12, yanlis: 3 },
                    'Fen Bilimleri': { dogru: 17, yanlis: 2 },
                    'İnkılap Tarihi ve Sosyal Bilgiler': { dogru: 8, yanlis: 1 },
                    'Din Kültürü ve Ahlak Bilgisi': { dogru: 9, yanlis: 1 },
                    'Yabancı Dil (İngilizce)': { dogru: 7, yanlis: 2 }
                }
            }
        ]
    };

    const insights = buildSchoolExamPerformanceInsights(student);
    assert.equal(insights.summary.examCount, 1);
    assert.equal(insights.totalNetSeries.length, 1);
    assert.equal(insights.totalNetSeries[0].id, 'genel1');
    assert.equal(insights.totalNetSeries[0].totalNet, 65);
});

test('UX-08 Scenario K: Subject normalizer resolves diverse naming variations to canonical 6 LGS keys', () => {
    assert.equal(normalizeLgsSubject('Türkçe'), 'Türkçe');
    assert.equal(normalizeLgsSubject('turkce'), 'Türkçe');
    assert.equal(normalizeLgsSubject('Matematik'), 'Matematik');
    assert.equal(normalizeLgsSubject('Mat'), 'Matematik');
    assert.equal(normalizeLgsSubject('Fen Bilimleri'), 'Fen Bilimleri');
    assert.equal(normalizeLgsSubject('Fen'), 'Fen Bilimleri');
    assert.equal(normalizeLgsSubject('İnkılap Tarihi ve Sosyal Bilgiler'), 'İnkılap Tarihi');
    assert.equal(normalizeLgsSubject('İnkılap Tarihi / Sosyal Bilgiler'), 'İnkılap Tarihi');
    assert.equal(normalizeLgsSubject('Sosyal Bilgiler'), 'İnkılap Tarihi');
    assert.equal(normalizeLgsSubject('T.C. İnkılap Tarihi ve Atatürkçülük'), 'İnkılap Tarihi');
    assert.equal(normalizeLgsSubject('Din Kültürü ve Ahlak Bilgisi'), 'Din Kültürü');
    assert.equal(normalizeLgsSubject('Din'), 'Din Kültürü');
    assert.equal(normalizeLgsSubject('Yabancı Dil (İngilizce)'), 'İngilizce');
    assert.equal(normalizeLgsSubject('İngilizce'), 'İngilizce');
    assert.equal(normalizeLgsSubject('Yabancı Dil'), 'İngilizce');
});

test('UX-08 Scenario L: Correctly extracts subject results and calculates nets per subject', () => {
    const exam = {
        dersSonuclari: {
            'Türkçe': { dogru: 18, yanlis: 3, bos: 0 }, // net = 18 - 1 = 17
            'Matematik': { dogru: 15, yanlis: 3, bos: 2 }, // net = 15 - 1 = 14
            'Fen Bilimleri': { dogru: 20, yanlis: 0, bos: 0 }, // net = 20
            'İnkılap': { dogru: 9, yanlis: 0, bos: 1 }, // net = 9
            'Din': { dogru: 10, yanlis: 0, bos: 0 }, // net = 10
            'İngilizce': { dogru: 8, yanlis: 3, bos: 0 } // net = 8 - 1 = 7
        }
    };

    const results = getExamSubjectResults(exam);
    assert.equal(results['Türkçe'].net, 17);
    assert.equal(results['Matematik'].net, 14);
    assert.equal(results['Fen Bilimleri'].net, 20);
    assert.equal(results['İnkılap Tarihi'].net, 9);
    assert.equal(results['Din Kültürü'].net, 10);
    assert.equal(results['İngilizce'].net, 7);
});

test('UX-08 Scenario M: Calculates total net trajectory, strongest and weakest subjects across multiple general exams', () => {
    const student = {
        denemeler: [
            {
                id: 'e1',
                tip: 'genel',
                denemeAdi: '1. Deneme',
                tarih: '2026-08-01',
                toplamNet: 60,
                dersSonuclari: {
                    'Türkçe': { dogru: 15, yanlis: 3 }, // 14
                    'Matematik': { dogru: 10, yanlis: 3 }, // 9
                    'Fen Bilimleri': { dogru: 18, yanlis: 0 }, // 18
                    'İnkılap': { dogru: 8, yanlis: 0 }, // 8
                    'Din': { dogru: 9, yanlis: 0 }, // 9
                    'İngilizce': { dogru: 6, yanlis: 3 } // 5
                }
            },
            {
                id: 'e2',
                tip: 'genel',
                denemeAdi: '2. Deneme',
                tarih: '2026-08-15',
                toplamNet: 67,
                dersSonuclari: {
                    'Türkçe': { dogru: 18, yanlis: 0 }, // 18
                    'Matematik': { dogru: 12, yanlis: 3 }, // 11
                    'Fen Bilimleri': { dogru: 19, yanlis: 3 }, // 18
                    'İnkılap': { dogru: 9, yanlis: 0 }, // 9
                    'Din': { dogru: 10, yanlis: 0 }, // 10
                    'İngilizce': { dogru: 7, yanlis: 3 } // 6
                }
            }
        ]
    };

    const insights = buildSchoolExamPerformanceInsights(student);
    assert.equal(insights.summary.examCount, 2);
    assert.equal(insights.summary.latestTotalNet, 67);
    assert.equal(insights.summary.previousTotalNet, 60);
    assert.equal(insights.summary.totalNetChange, 7);
    assert.equal(insights.summary.trendDirection, 'improving');

    // Strongest: Fen (18 / 20 = 90%) or Din (9.5 / 10 = 95%)
    assert.ok(insights.summary.strongestSubject);
    assert.ok(['Din Kültürü', 'Fen Bilimleri'].includes(insights.summary.strongestSubject.key));

    // Weakest: Matematik (avg net 10 / 20 = 50%) or İngilizce (avg net 5.5 / 10 = 55%)
    assert.ok(insights.summary.weakestSubject);
    assert.ok(['Matematik', 'İngilizce'].includes(insights.summary.weakestSubject.key));
});

test('UX-08 Scenario N: Last exam comparison accurately identifies biggest gain and biggest loss', () => {
    const student = {
        denemeler: [
            {
                id: 'e1',
                tip: 'genel',
                denemeAdi: 'Deneme A',
                tarih: '2026-08-01',
                toplamNet: 60,
                dersSonuclari: {
                    'Türkçe': { dogru: 12, yanlis: 0 }, // 12
                    'Matematik': { dogru: 15, yanlis: 0 }, // 15
                    'Fen Bilimleri': { dogru: 15, yanlis: 0 } // 15
                }
            },
            {
                id: 'e2',
                tip: 'genel',
                denemeAdi: 'Deneme B',
                tarih: '2026-08-15',
                toplamNet: 63,
                dersSonuclari: {
                    'Türkçe': { dogru: 18, yanlis: 0 }, // 18 -> +6 gain
                    'Matematik': { dogru: 11, yanlis: 0 }, // 11 -> -4 loss
                    'Fen Bilimleri': { dogru: 16, yanlis: 0 } // 16 -> +1 gain
                }
            }
        ]
    };

    const insights = buildSchoolExamPerformanceInsights(student);
    const comp = insights.lastExamComparison;
    assert.equal(comp.hasComparison, true);
    assert.equal(comp.totalDelta, 3);
    assert.equal(comp.biggestGain.shortName, 'TÜR');
    assert.equal(comp.biggestGain.delta, 6);
    assert.equal(comp.biggestLoss.shortName, 'MAT');
    assert.equal(comp.biggestLoss.delta, -4);
});

test('UX-08 Scenario O: Builds per-subject trend series cleanly for charts', () => {
    const student = {
        denemeler: [
            {
                id: 'e1',
                tip: 'genel',
                denemeAdi: '1. Sınav',
                tarih: '2026-08-01',
                toplamNet: 50,
                dersSonuclari: { 'Matematik': { dogru: 10, yanlis: 3 } } // net = 9
            },
            {
                id: 'e2',
                tip: 'genel',
                denemeAdi: '2. Sınav',
                tarih: '2026-08-15',
                toplamNet: 55,
                dersSonuclari: { 'Matematik': { dogru: 13, yanlis: 3 } } // net = 12
            }
        ]
    };

    const insights = buildSchoolExamPerformanceInsights(student);
    assert.equal(insights.subjectTrendSeries['Matematik'].length, 2);
    assert.equal(insights.subjectTrendSeries['Matematik'][0].net, 9);
    assert.equal(insights.subjectTrendSeries['Matematik'][1].net, 12);
});

test('UX-08 Scenario P: Combined student object - no cross-contamination between homework and exam metrics', () => {
    const student = {
        id: 's_full',
        adSoyad: 'Ali Can',
        odevler: [
            {
                id: 'hw1',
                durum: 'tamamlandi',
                dogru: 20,
                yanlis: 0,
                yanlisAnalizi: [{ unite: 'Hücre', konu: 'Organeller', adet: 2, hataNedenleri: ['bilgi_eksikligi'] }]
            }
        ],
        denemeler: [
            {
                id: 'ex_branch',
                tip: 'branş',
                denemeAdi: 'Fen Branş',
                toplamNet: 19
            },
            {
                id: 'ex_genel',
                tip: 'genel',
                denemeAdi: 'LGS Okul 1',
                tarih: '2026-08-10',
                toplamNet: 72,
                dersSonuclari: {
                    'Türkçe': { dogru: 18, yanlis: 0 },
                    'Matematik': { dogru: 15, yanlis: 3 }
                }
            }
        ]
    };

    const hwInsights = buildHomeworkPerformanceInsights(student);
    const examInsights = buildSchoolExamPerformanceInsights(student);

    // Homework insights isolated
    assert.equal(hwInsights.summary.totalCompleted, 1);
    assert.equal(hwInsights.summary.latestNet, 20);
    assert.equal(hwInsights.weakTopics[0].konu, 'Organeller');

    // Exam insights isolated
    assert.equal(examInsights.summary.examCount, 1); // ignores branş
    assert.equal(examInsights.summary.latestTotalNet, 72);
    assert.equal(examInsights.subjectPerformance.find(s => s.key === 'Türkçe').latestNet, 18);
});

test('UX-08 Scenario Q: Single exam provides appropriate non-comparison narrative and null change', () => {
    const student = {
        denemeler: [
            { id: 'e1', tip: 'genel', denemeAdi: 'Tek Deneme', tarih: '2026-08-01', toplamNet: 55 }
        ]
    };

    const insights = buildSchoolExamPerformanceInsights(student);
    assert.equal(insights.summary.examCount, 1);
    assert.equal(insights.summary.latestTotalNet, 55);
    assert.equal(insights.summary.previousTotalNet, null);
    assert.equal(insights.summary.totalNetChange, null);
    assert.equal(insights.summary.trendDirection, 'insufficient_data');
    assert.equal(insights.lastExamComparison.hasComparison, false);
    assert.ok(insights.narrative.includes('1 genel denemesi bulunuyor'));
});

test('UX-08 Scenario R: Homework net preserves negative values without zero-clamping (1D 15Y => -4 net)', () => {
    const student = {
        odevler: [
            { id: 'hw_bad', durum: 'tamamlandi', dogru: 1, yanlis: 15 } // 1 - 5 = -4
        ]
    };

    const insights = buildHomeworkPerformanceInsights(student);
    assert.equal(insights.summary.latestNet, -4);
    assert.equal(insights.summary.averageNet, -4);
});

test('UX-08 Scenario S: Gracefully handles exam with malformed or missing dersSonuclari', () => {
    const student = {
        denemeler: [
            { id: 'e_malformed', tip: 'genel', denemeAdi: 'Bozuk Deneme', dersSonuclari: null }
        ]
    };

    const insights = buildSchoolExamPerformanceInsights(student);
    assert.equal(insights.summary.examCount, 1);
    assert.equal(insights.subjectPerformance.length, 6);
    assert.equal(insights.subjectPerformance[0].latestNet, 0);
    assert.equal(insights.subjectPerformance[0].latestDogru, 0);
});

test('UX-08 Scenario T: Homework with unmapped/unknown error reasons gracefully categorizes into Diğer', () => {
    const student = {
        odevler: [
            {
                id: 'hw_other',
                durum: 'tamamlandi',
                dogru: 10,
                yanlis: 2,
                yanlisAnalizi: [
                    { unite: 'Hücre', konu: 'Zar', adet: 2, hataNedenleri: ['bilinmeyen_neden_xyz'] }
                ]
            }
        ]
    };

    const insights = buildHomeworkPerformanceInsights(student);
    const diger = insights.errorReasons.find(r => r.key === 'diger');
    assert.ok(diger);
    assert.equal(diger.count, 2);
    assert.equal(diger.percentage, 100);
});

test('UX-08 Scenario U: School exam subject net preserves negative values without zero-clamping (0D 9Y => -3 net)', () => {
    const exam = {
        dersSonuclari: {
            'Türkçe': { dogru: 0, yanlis: 9 }
        }
    };
    const results = getExamSubjectResults(exam);
    assert.equal(results['Türkçe'].net, -3);
    assert.equal(results['Türkçe'].hasData, true);

    const student = {
        denemeler: [
            { id: 'e1', tip: 'genel', denemeAdi: 'Negatif Deneme', tarih: '2026-08-01', dersSonuclari: exam.dersSonuclari }
        ]
    };
    const insights = buildSchoolExamPerformanceInsights(student);
    const turkce = insights.subjectPerformance.find(s => s.key === 'Türkçe');
    assert.equal(turkce.latestNet, -3);
    assert.equal(turkce.averageNet, -3);
});

test('UX-08 Scenario V: Negative net contributes correctly to total LGS net without floor', () => {
    const student = {
        denemeler: [
            {
                id: 'e1',
                tip: 'genel',
                denemeAdi: 'Karışık Net Denemesi',
                tarih: '2026-08-01',
                dersSonuclari: {
                    'Türkçe': { dogru: 15, yanlis: 0 }, // +15
                    'Matematik': { dogru: 0, yanlis: 9 }  // -3
                }
            }
        ]
    };

    const insights = buildSchoolExamPerformanceInsights(student);
    assert.equal(insights.summary.latestTotalNet, 12); // 15 + (-3) = 12
    assert.equal(insights.summary.averageTotalNet, 12);
    assert.equal(insights.totalNetSeries[0].totalNet, 12);
});

test('UX-08 Scenario W: Strongest subject uses normalized performance instead of raw net (Fen 12/20 vs İngilizce 8/10)', () => {
    // Fen: 12 net / 20 = 60%
    // İngilizce: 8 net / 10 = 80%
    // Raw net: Fen (12) > İngilizce (8)
    // Normalized: İngilizce (80%) > Fen (60%) => Strongest MUST be İngilizce
    const student = {
        denemeler: [
            {
                id: 'e1',
                tip: 'genel',
                denemeAdi: 'Oran Denemesi',
                tarih: '2026-08-01',
                dersSonuclari: {
                    'Fen Bilimleri': { dogru: 12, yanlis: 0 }, // 12 net, 60%
                    'İngilizce': { dogru: 8, yanlis: 0 }        // 8 net, 80%
                }
            }
        ]
    };

    const insights = buildSchoolExamPerformanceInsights(student);
    assert.ok(insights.summary.strongestSubject);
    assert.equal(insights.summary.strongestSubject.key, 'İngilizce');
    assert.equal(insights.summary.strongestSubject.averageNet, 8);
    assert.equal(insights.summary.strongestSubject.performancePercent, 80);
});

test('UX-08 Scenario X: Weakest subject uses normalized performance instead of raw net', () => {
    // Matematik: 8 net / 20 = 40%
    // Din Kültürü: 5 net / 10 = 50%
    // Raw net: Din (5) < Matematik (8)
    // Normalized: Matematik (40%) < Din (50%) => Weakest MUST be Matematik
    const student = {
        denemeler: [
            {
                id: 'e1',
                tip: 'genel',
                denemeAdi: 'Zayıf Ders Oran Denemesi',
                tarih: '2026-08-01',
                dersSonuclari: {
                    'Matematik': { dogru: 8, yanlis: 0 },   // 8 net / 20 = 40%
                    'Din Kültürü': { dogru: 5, yanlis: 0 }  // 5 net / 10 = 50%
                }
            }
        ]
    };

    const insights = buildSchoolExamPerformanceInsights(student);
    assert.ok(insights.summary.weakestSubject);
    assert.equal(insights.summary.weakestSubject.key, 'Matematik');
    assert.equal(insights.summary.weakestSubject.averageNet, 8);
    assert.equal(insights.summary.weakestSubject.performancePercent, 40);
});

test('UX-08 Scenario Y: Missing subjects in partial exams are excluded from strongest/weakest determination', () => {
    // Student only took Türkçe (15 net / 20 = 75%), Matematik (10 net / 20 = 50%), Fen (16 net / 20 = 80%)
    // İnkılap, Din, İngilizce are missing (no data)
    const student = {
        denemeler: [
            {
                id: 'e_partial',
                tip: 'genel',
                denemeAdi: 'Kısmi Deneme (Yalnız Sayısal + Türkçe)',
                tarih: '2026-08-01',
                dersSonuclari: {
                    'Türkçe': { dogru: 15, yanlis: 0 },
                    'Matematik': { dogru: 10, yanlis: 0 },
                    'Fen Bilimleri': { dogru: 16, yanlis: 0 }
                }
            }
        ]
    };

    const insights = buildSchoolExamPerformanceInsights(student);
    assert.equal(insights.summary.strongestSubject.key, 'Fen Bilimleri');
    assert.equal(insights.summary.weakestSubject.key, 'Matematik'); // NOT İnkılap, Din or İngilizce!

    const inkilap = insights.subjectPerformance.find(s => s.key === 'İnkılap Tarihi');
    assert.equal(inkilap.hasData, false);
    assert.equal(inkilap.participatedExamCount, 0);
    assert.equal(inkilap.averageNet, null);
    assert.equal(inkilap.performanceRate, null);
});

test('UX-08 Scenario Z: LGS total question count equals 90 and matches sum of 6 canonical subjects', () => {
    assert.equal(LGS_TOTAL_QUESTIONS, 90);
    const sumQuestions = LGS_SUBJECTS.reduce((sum, s) => sum + s.questionCount, 0);
    assert.equal(sumQuestions, 90);

    const student = {
        denemeler: [
            { id: 'e1', tip: 'genel', denemeAdi: 'Deneme 1', tarih: '2026-08-01', toplamNet: 75 }
        ]
    };
    const insights = buildSchoolExamPerformanceInsights(student);
    assert.equal(insights.summary.maxTotalNet, 90);
    assert.equal(insights.summary.totalQuestions, 90);
});


