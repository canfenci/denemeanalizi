import { loadStudentsData, saveStudentsData, escapeHtml, store, getStudentOdevler, addStudentArrayRecord, updateStudentArrayRecord, deleteStudentArrayRecord } from './store.js';
import { updateMobileNavActive } from './auth.js';
import { buildGuidanceCenterDashboard, getStudentInitials, formatActivityDate } from './guidance-center-insights.js';
import { buildStudentGuidanceDetail } from './guidance-student-insights.js';
import {
    getStudentGuidanceRecords,
    isGuidanceRecordDue,
    createGuidanceRecord,
    updateGuidanceRecord,
    completeGuidanceRecord,
    deleteGuidanceRecord,
    buildSuggestedPrefill,
    GUIDANCE_RECORD_TYPES,
    GUIDANCE_RESULT_OPTIONS
} from './guidance-records.js';
import {
    classifyGuidanceFollowUps,
    getGuidanceFollowUpMetrics,
    formatFollowUpDisplayDate,
    getCalendarWeekRange
} from './guidance-followup-insights.js';
import {
    getWeeklyGuidanceAnalytics,
    compareGuidanceWeeks,
    shiftWeekRange,
    formatWeekDateRange
} from './guidance-weekly-insights.js';
import {
    buildHomeworkPerformanceInsights,
    buildSchoolExamPerformanceInsights,
    LGS_SUBJECTS
} from './guidance-performance-insights.js';

export function renderGuidancePage(options = {}) {
    store.currentPage = 'guidance';
    if (window.currentPage) window.currentPage = 'guidance';
    updateMobileNavActive('mobile-nav-guidance');

    const currentTab = typeof options === 'object' && options.tab ? options.tab : (window._guidanceFilters?.tab || 'decision');
    const selectedWeekOffset = typeof options === 'object' && options.selectedWeekOffset !== undefined ? options.selectedWeekOffset : (window._guidanceFilters?.selectedWeekOffset || 0);
    const query = typeof options === 'string' ? options : (options.query !== undefined ? options.query : (window._guidanceFilters?.query || ''));
    const priorityFilter = typeof options === 'object' && options.priority ? options.priority : (window._guidanceFilters?.priority || 'all');
    const gradeFilter = typeof options === 'object' && options.grade !== undefined ? options.grade : (window._guidanceFilters?.grade || '');
    const followUpCategory = typeof options === 'object' && options.followUpCategory ? options.followUpCategory : (window._guidanceFilters?.followUpCategory || 'all');
    const followUpStudentId = typeof options === 'object' && options.followUpStudentId ? options.followUpStudentId : (window._guidanceFilters?.followUpStudentId || 'all');

    window._guidanceFilters = {
        tab: currentTab,
        selectedWeekOffset,
        query,
        priority: priorityFilter,
        grade: gradeFilter,
        followUpCategory,
        followUpStudentId
    };

    const students = loadStudentsData();
    const dashboard = buildGuidanceCenterDashboard(students);
    const { studentPriorities, metrics, activeInterventions, recentActivities = [] } = dashboard;

    const followUpMetrics = getGuidanceFollowUpMetrics(students);
    const followUpData = classifyGuidanceFollowUps(students, {
        category: followUpCategory,
        studentId: followUpStudentId,
        query
    });

    // Weekly Analytics Calculation (UX-06.5)
    const baseWeekRange = getCalendarWeekRange(new Date());
    const selectedWeekRange = shiftWeekRange(baseWeekRange.monday, selectedWeekOffset);
    const prevWeekRange = shiftWeekRange(selectedWeekRange.monday, -1);
    const weeklyAnalytics = getWeeklyGuidanceAnalytics(students, { weekRange: selectedWeekRange });
    const prevWeeklyAnalytics = getWeeklyGuidanceAnalytics(students, { weekRange: prevWeekRange });
    const weeklyComparison = compareGuidanceWeeks(weeklyAnalytics, prevWeeklyAnalytics);

    const normalizedQuery = String(query || '').trim().toLocaleLowerCase('tr-TR');

    const filteredStudents = studentPriorities.filter(item => {
        const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
        const matchesGrade = !gradeFilter || String(item.sinif || '') === String(gradeFilter);
        const matchesQuery = !normalizedQuery || item.studentName.toLocaleLowerCase('tr-TR').includes(normalizedQuery);
        return matchesPriority && matchesGrade && matchesQuery;
    });

    // 4 Unified Top Operational Metrics
    const metricCards = [
        ['fa-calendar-day', 'Bugün', followUpMetrics.todayCount, 'Bugün takip edilecekler', 'agenda', 'text-indigo-600 dark:text-indigo-400'],
        ['fa-triangle-exclamation', 'Geciken', followUpMetrics.overdueCount, 'Tarihi geçmiş açık takipler', 'agenda', followUpMetrics.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-900 dark:text-white'],
        ['fa-calendar-week', 'Bu Hafta Kalan', followUpMetrics.thisWeekCount, 'Pazara kadar planlananlar', 'agenda', 'text-slate-900 dark:text-white'],
        ['fa-clipboard-list', 'Toplam Açık', followUpMetrics.totalOpenCount, 'Aktif takipteki tüm kayıtlar', 'agenda', 'text-slate-900 dark:text-white']
    ];

    const priorityBadgeStyles = {
        high: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/60',
        medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
        watch: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-gray-200 dark:border-gray-700'
    };

    const priorityDotStyles = {
        high: 'bg-rose-500',
        medium: 'bg-amber-500',
        watch: 'bg-slate-400'
    };

    const priorityFilters = [
        ['all', 'Tümü', metrics.totalStudents],
        ['high', 'Yüksek Öncelik', metrics.highPriority],
        ['medium', 'Orta Öncelik', metrics.mediumPriority],
        ['watch', 'İzle / Stabil', metrics.watchPriority]
    ];

    const followUpCategoryFilters = [
        ['all', 'Tümü'],
        ['academic', 'Akademik'],
        ['discipline', 'Ödev / Disiplin'],
        ['performance', 'Sınav / Performans'],
        ['general', 'Genel Takip']
    ];

    const studentCardsHtml = filteredStudents.length ? filteredStudents.map(item => `
        <article class="app-panel p-5 space-y-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition">
            <!-- Student Header -->
            <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-sm text-slate-700 dark:text-slate-200 shrink-0">
                        ${escapeHtml(getStudentInitials(item.studentName))}
                    </div>
                    <div>
                        <h3 class="font-black text-base text-gray-900 dark:text-white leading-tight">
                            ${escapeHtml(item.studentName)}
                        </h3>
                        <p class="text-xs text-gray-500 mt-0.5">
                            ${escapeHtml(item.sinif ? `${item.sinif}. Sınıf` : 'Sınıf yok')}${item.okul ? ` · ${escapeHtml(item.okul)}` : ''}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${priorityBadgeStyles[item.priority] || priorityBadgeStyles.watch}">
                    <span class="w-2 h-2 rounded-full ${priorityDotStyles[item.priority] || 'bg-gray-400'}"></span>
                    ${escapeHtml(item.priorityLabel)} Öncelik
                </div>
            </div>

            <!-- Neden? Alanı (Maksimum 3 Neden) -->
            <div class="space-y-1.5 pt-1">
                <p class="text-[11px] font-black uppercase tracking-wider text-gray-400">Neden müdahale gerekiyor?</p>
                <ul class="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                    ${item.reasons.map(r => `
                        <li class="flex items-start gap-2">
                            <span class="text-indigo-500 font-bold mt-0.5">•</span>
                            <span class="font-medium">${escapeHtml(r)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>

            <!-- Önerilen İlk Adım -->
            <div class="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-black text-indigo-900 dark:text-indigo-200">
                    <i class="fas fa-lightbulb text-indigo-600 dark:text-indigo-400"></i>
                    <span>Önerilen İlk Adım: ${escapeHtml(item.recommendation.title)}</span>
                </div>
                <p class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    ${escapeHtml(item.recommendation.action)}
                </p>
            </div>

            <!-- Aktif Çalışma Planı Bilgisi (Varsa) -->
            ${item.activePlan ? `
                <div class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5">
                    <i class="fas fa-circle-check"></i>
                    <span>Aktif Plan: ${escapeHtml(item.activePlan.subject)} (${item.activePlan.durationWeeks} haftalık) · Devam ediyor</span>
                </div>
            ` : ''}

            <!-- Aksiyon Butonları -->
            <div class="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 flex-wrap">
                <button onclick="openGuidanceStudent('${item.studentId}')" class="btn-primary min-h-[44px] sm:min-h-[40px] px-3.5 text-xs font-bold flex items-center gap-1.5">
                    <i class="fas fa-arrow-right"></i> Rehberlik Dosyasını Aç
                </button>
                <div class="flex items-center gap-1.5">
                    <button onclick="showStudyPlanSetup('${item.studentId}')" class="btn-secondary min-h-[44px] sm:min-h-[40px] px-3 text-xs font-semibold" title="Akıllı Çalışma Planı Oluştur">
                        <i class="fas fa-compass mr-1"></i> Çalışma Planı
                    </button>
                    <button onclick="openCockpitHomework('${item.studentId}')" class="btn-secondary min-h-[44px] sm:min-h-[40px] px-3 text-xs font-semibold" title="Ödev Ata">
                        <i class="fas fa-plus mr-1"></i> Ödev
                    </button>
                </div>
            </div>
        </article>
    `).join('') : `
        <div class="sm:col-span-2 app-panel p-12 text-center text-gray-500">
            <i class="fas fa-filter text-2xl text-gray-300 dark:text-gray-600 mb-2"></i>
            <p class="font-bold text-gray-800 dark:text-gray-200">Bu filtrelere uygun öğrenci bulunamadı.</p>
            <p class="text-xs text-gray-500 mt-1">Farklı bir öncelik veya arama kriteri seçebilirsiniz.</p>
        </div>
    `;

    const activeInterventionsHtml = activeInterventions.length ? activeInterventions.map(plan => `
        <div class="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200/60 dark:border-gray-800 flex items-center justify-between gap-3">
            <div>
                <p class="font-bold text-sm text-gray-900 dark:text-white">${escapeHtml(plan.studentName)}</p>
                <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(plan.subject)} · ${plan.durationWeeks || 1} haftalık program</p>
            </div>
            <div class="flex items-center gap-1.5">
                <button onclick="exportStudyPlanToPdf('${plan.studentId}')" class="px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 min-h-[44px] sm:min-h-[36px]" title="PDF İndir">
                    <i class="fas fa-file-pdf text-emerald-600 mr-1"></i> PDF
                </button>
                <button onclick="openGuidanceStudent('${plan.studentId}')" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 min-h-[44px] sm:min-h-[36px]">
                    İncele
                </button>
            </div>
        </div>
    `).join('') : `
        <div class="p-6 text-center text-gray-400 text-xs">
            <i class="fas fa-compass text-lg text-gray-300 dark:text-gray-600 mb-1"></i>
            <p>Henüz aktif çalışma planı tanımlanmış öğrenci yok.</p>
        </div>
    `;

    const recentActivitiesHtml = recentActivities.length ? recentActivities.map((act, index) => `
        <div class="relative flex items-start gap-3 ${index < recentActivities.length - 1 ? 'pb-3' : ''}">
            ${index < recentActivities.length - 1 ? '<span class="absolute left-3.5 top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></span>' : ''}
            <span class="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-[11px] text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <i class="fas ${act.icon || 'fa-circle-info'}"></i>
            </span>
            <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                    <p class="font-bold text-xs text-gray-900 dark:text-white truncate">
                        ${escapeHtml(act.studentName)}
                    </p>
                    <time class="shrink-0 text-[11px] text-gray-400 font-medium">${escapeHtml(act.formattedDate || act.date)}</time>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">${escapeHtml(act.detail)}</p>
            </div>
        </div>
    `).join('') : `
        <div class="p-4 text-center text-gray-400 text-xs">
            <p>Henüz yakın tarihli hareket bulunmuyor.</p>
        </div>
    `;

    // Render Follow-Up Card Helper
    const renderFollowUpCard = (item, isOverdue = false) => {
        const { studentId, studentName, sinif, record, daysOverdue } = item;
        return `
            <div class="p-4 bg-white dark:bg-gray-900/80 rounded-xl border ${isOverdue ? 'border-amber-300 dark:border-amber-800 shadow-sm' : 'border-gray-200/70 dark:border-gray-800'} space-y-2.5">
                <div class="flex items-start justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-black text-sm text-gray-900 dark:text-white">${escapeHtml(studentName)}</span>
                        <span class="text-xs text-gray-400">${sinif ? `${sinif}. Sınıf` : ''}</span>
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            ${escapeHtml(record.typeLabel)}
                        </span>
                        ${isOverdue ? `
                            <span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1 animate-pulse">
                                <i class="fas fa-clock text-[10px]"></i> ${daysOverdue} gün gecikti
                            </span>
                        ` : `
                            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                                Bugün
                            </span>
                        `}
                        ${record.result === 'pending' ? `
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Henüz Ölçülmedi · Takipte
                            </span>
                        ` : ''}
                    </div>
                    ${record.followUpDate ? `
                        <span class="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                            <i class="far fa-calendar text-indigo-500"></i> ${escapeHtml(formatFollowUpDisplayDate(record.followUpDate))}
                        </span>
                    ` : ''}
                </div>

                <div class="space-y-1 text-xs">
                    <p class="text-gray-800 dark:text-gray-200 leading-relaxed">
                        <span class="font-bold text-gray-900 dark:text-white">Sorun / Gözlem:</span> ${escapeHtml(record.issue)}
                    </p>
                    <p class="text-gray-800 dark:text-gray-200 leading-relaxed">
                        <span class="font-bold text-gray-900 dark:text-white">Planlanan / Uygulanan Müdahale:</span> ${escapeHtml(record.action)}
                    </p>
                    ${record.note ? `
                        <div class="text-[11px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/40 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                            ${escapeHtml(record.note)}
                        </div>
                    ` : ''}
                </div>

                <div class="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-2 flex-wrap">
                        <button onclick="showCompleteGuidanceRecordModal('${studentId}', '${record.id}')" class="btn-primary py-2 px-3 text-xs font-bold min-h-[44px] sm:min-h-[38px] flex items-center gap-1.5">
                            <i class="fas fa-clipboard-check"></i> Sonuç Gir
                        </button>
                        <button onclick="openGuidanceStudent('${studentId}')" class="btn-secondary py-2 px-3 text-xs font-semibold min-h-[44px] sm:min-h-[38px] flex items-center gap-1.5">
                            <i class="fas fa-folder-open"></i> Rehberlik Dosyası
                        </button>
                    </div>
                    <button onclick="showGuidanceRecordModal('${studentId}', '${record.id}')" class="p-2 text-gray-500 hover:text-indigo-600 rounded text-xs min-h-[44px] sm:min-h-[38px] flex items-center gap-1" title="Tarihi veya Notu Düzenle">
                        <i class="fas fa-calendar-pen"></i> <span class="hidden sm:inline">Tarihi Değiştir</span>
                    </button>
                </div>
            </div>
        `;
    };

    const todayCardsHtml = followUpData.today.length ? followUpData.today.map(item => renderFollowUpCard(item, false)).join('') : `
        <div class="p-8 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center text-gray-400 text-xs">
            <i class="far fa-calendar-check text-2xl text-gray-300 dark:text-gray-600 mb-2 block"></i>
            <p class="font-bold text-gray-700 dark:text-gray-300">Bugün için planlanmış rehberlik takibi yok.</p>
            <p class="text-[11px] text-gray-500 mt-0.5">Bugün tamamlanması gereken tüm takip işleri güncel.</p>
        </div>
    `;

    const overdueCardsHtml = followUpData.overdue.length ? followUpData.overdue.map(item => renderFollowUpCard(item, true)).join('') : `
        <div class="p-6 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center text-gray-400 text-xs">
            <i class="fas fa-check-circle text-xl text-emerald-500/70 mb-1.5 block"></i>
            <p class="font-bold text-gray-700 dark:text-gray-300">Geciken takip bulunmuyor.</p>
            <p class="text-[11px] text-gray-500 mt-0.5">Tüm takipler zamanında sonuçlandırılmış veya güncel.</p>
        </div>
    `;

    const thisWeekHtml = followUpData.thisWeek.length ? followUpData.thisWeek.map(item => `
        <div class="p-3 bg-white dark:bg-gray-900/80 rounded-xl border border-gray-200/70 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-black text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                        ${escapeHtml(formatFollowUpDisplayDate(item.record.followUpDate, true))}
                    </span>
                    <span class="font-bold text-xs text-gray-900 dark:text-white">${escapeHtml(item.studentName)}</span>
                    <span class="text-[11px] text-gray-400">${escapeHtml(item.record.typeLabel)}</span>
                </div>
                <p class="text-xs text-gray-600 dark:text-gray-300 truncate mt-1">${escapeHtml(item.record.issue)}</p>
            </div>
            <div class="flex items-center gap-1.5">
                <button onclick="showCompleteGuidanceRecordModal('${item.studentId}', '${item.record.id}')" class="btn-primary py-2 px-3 text-xs font-bold min-h-[44px] sm:min-h-[36px]">
                    Sonuç Gir
                </button>
                <button onclick="openGuidanceStudent('${item.studentId}')" class="btn-secondary py-2 px-3 text-xs font-semibold min-h-[44px] sm:min-h-[36px]">
                    Dosya
                </button>
            </div>
        </div>
    `).join('') : `
        <div class="p-6 text-center text-gray-400 text-xs">
            <p>Bu hafta için başka planlanmış takip bulunmuyor.</p>
        </div>
    `;

    const upcomingHtml = followUpData.upcoming.length ? followUpData.upcoming.map(item => `
        <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200/60 dark:border-gray-800 flex items-center justify-between gap-2 text-xs">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                    <span class="font-bold text-gray-500 dark:text-gray-400">${escapeHtml(formatFollowUpDisplayDate(item.record.followUpDate))}</span>
                    <span class="font-bold text-gray-900 dark:text-white truncate">${escapeHtml(item.studentName)}</span>
                </div>
                <p class="text-[11px] text-gray-500 truncate">${escapeHtml(item.record.issue)}</p>
            </div>
            <button onclick="openGuidanceStudent('${item.studentId}')" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline shrink-0 text-xs px-3 py-2 min-h-[44px] sm:min-h-[36px] flex items-center">
                İncele
            </button>
        </div>
    `).join('') : `
        <div class="p-4 text-center text-gray-400 text-xs">
            <p>Yaklaşan planlanmış takip yok.</p>
        </div>
    `;

    const undatedHtml = followUpData.undated.length ? followUpData.undated.map(item => `
        <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200/60 dark:border-gray-800 flex items-center justify-between gap-2 text-xs">
            <div class="min-w-0 flex-1">
                <span class="font-bold text-gray-900 dark:text-white">${escapeHtml(item.studentName)}</span>
                <p class="text-[11px] text-gray-500 truncate">${escapeHtml(item.record.issue)}</p>
            </div>
            <button onclick="showGuidanceRecordModal('${item.studentId}', '${item.record.id}')" class="text-xs text-indigo-600 font-bold hover:underline shrink-0 px-3 py-2 min-h-[44px] sm:min-h-[36px] flex items-center">
                Tarih Belirle
            </button>
        </div>
    `).join('') : '';

    document.getElementById('dynamic-content').innerHTML = `
        <div class="app-page pb-28 sm:pb-8">
            <!-- Header -->
            <header class="app-page-header">
                <div>
                    <span class="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Öğretmen Karar Destek & Takip</span>
                    <h2 class="app-page-title">Rehberlik</h2>
                    <p class="app-page-subtitle">Öğrenci önceliklendirme, müdahale günlüğü ve günlük takip takvimi</p>
                </div>
            </header>

            <!-- 4 Kompakt Üst Metrik (Takip Takvimine Doğrudan Kısayol) -->
            <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                ${metricCards.map(([icon, label, value, detail, targetTab, valueClass]) => `
                    <article onclick="updateGuidanceFilters({tab:'${targetTab}'})" class="app-panel p-4 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition">
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas ${icon} text-xs"></i>
                            <p class="text-[11px] font-black uppercase tracking-[.08em]">${label}</p>
                        </div>
                        <p class="mt-3 text-2xl font-black ${valueClass || 'text-slate-900 dark:text-white'}">${value}</p>
                        <p class="mt-1 text-xs text-gray-500">${detail}</p>
                    </article>
                `).join('')}
            </section>

            <!-- Segmented Control Tabs (Genel Bakış vs Takip Takvimi vs Haftalık Özet) -->
            <div class="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 mt-4 mb-3 overflow-x-auto">
                <button onclick="updateGuidanceFilters({tab:'decision'})" class="py-2.5 px-4 text-sm font-black border-b-2 flex items-center gap-2 transition min-h-[44px] whitespace-nowrap ${currentTab === 'decision' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}">
                    <i class="fas fa-brain"></i> Genel Bakış
                </button>
                <button onclick="updateGuidanceFilters({tab:'agenda'})" class="py-2.5 px-4 text-sm font-black border-b-2 flex items-center gap-2 transition min-h-[44px] whitespace-nowrap ${currentTab === 'agenda' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}">
                    <i class="fas fa-calendar-check"></i> Takip Takvimi
                    ${(followUpMetrics.todayCount + followUpMetrics.overdueCount) > 0 ? `
                        <span class="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            ${followUpMetrics.todayCount + followUpMetrics.overdueCount}
                        </span>
                    ` : ''}
                </button>
                <button onclick="updateGuidanceFilters({tab:'weekly'})" class="py-2.5 px-4 text-sm font-black border-b-2 flex items-center gap-2 transition min-h-[44px] whitespace-nowrap ${currentTab === 'weekly' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}">
                    <i class="fas fa-chart-pie"></i> Haftalık Özet
                </button>
            </div>

            ${currentTab === 'decision' ? `
                <!-- ==================== KARAR MERKEZİ (UX-06.1) ==================== -->
                <!-- Filtreler & Arama -->
                <section class="app-panel p-4 mt-1">
                    <div class="flex flex-wrap gap-2">
                        ${priorityFilters.map(([key, label, count]) => `
                            <button onclick="updateGuidanceFilters({priority:'${key}'})" class="min-h-[44px] sm:min-h-[38px] rounded-full border px-3 text-sm font-bold transition ${priorityFilter === key ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:border-indigo-300 dark:border-gray-700 dark:text-gray-300'}">
                                ${label}${count !== undefined ? ` <span class="ml-1 opacity-75">${count}</span>` : ''}
                            </button>
                        `).join('')}
                    </div>
                    <div class="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                        <label class="relative">
                            <span class="sr-only">Öğrenci ara</span>
                            <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                            <input id="guidanceSearchInput" value="${escapeHtml(query)}" oninput="updateGuidanceFilters({query:this.value})" class="student-form-input min-h-[44px] pl-10" placeholder="Öğrenci adıyla ara">
                        </label>
                        <select onchange="updateGuidanceFilters({grade:this.value})" class="student-form-input min-h-[44px]">
                            <option value="">Tüm sınıflar</option>
                            ${['5','6','7','8'].map(grade => `<option value="${grade}" ${gradeFilter === grade ? 'selected' : ''}>${grade}. Sınıf</option>`).join('')}
                        </select>
                    </div>
                </section>

                <!-- 2-Column Main Content -->
                <section class="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,.75fr)] mt-4">
                    <!-- Sol Kolon: Müdahale Gerektiren Öğrenciler -->
                    <div class="space-y-3">
                        <div class="flex items-center justify-between px-1">
                            <h3 class="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                                <span>Müdahale Gerektiren Öğrenciler</span>
                                <span class="text-xs font-bold text-gray-400">(${filteredStudents.length} öğrenci)</span>
                            </h3>
                        </div>
                        <div class="grid grid-cols-1 gap-3">
                            ${studentCardsHtml}
                        </div>
                    </div>

                    <!-- Sağ Kolon: Aktif Çalışma Planları, Son Öğrenci Hareketleri ve Karar İlkeleri -->
                    <div class="space-y-4">
                        <!-- Aktif Çalışma Planları -->
                        <article class="app-panel p-4 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <h4 class="font-black text-base text-gray-900 dark:text-white">Aktif Çalışma Planları</h4>
                                    <p class="text-xs text-gray-500 mt-0.5">${activeInterventions.length} öğrenci devam ediyor</p>
                                </div>
                                <span class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
                                    <i class="fas fa-compass"></i>
                                </span>
                            </div>
                            <div class="space-y-2">
                                ${activeInterventionsHtml}
                            </div>
                        </article>

                        <!-- Son Öğrenci Hareketleri -->
                        <article class="app-panel p-4 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <h4 class="font-black text-base text-gray-900 dark:text-white">Son Öğrenci Hareketleri</h4>
                                    <p class="text-xs text-gray-500 mt-0.5">${recentActivities.length} yakın etkinlik</p>
                                </div>
                                <span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
                                    <i class="fas fa-clock-rotate-left"></i>
                                </span>
                            </div>
                            <div class="pt-1">
                                ${recentActivitiesHtml}
                            </div>
                        </article>

                        <!-- Karar Destek İlkeleri -->
                        <article class="app-panel p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
                            <div class="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                <i class="fas fa-shield-halved"></i>
                                <span>Önceliklendirme İlkeleri</span>
                            </div>
                            <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-2 leading-relaxed">
                                <li class="flex items-start gap-2">
                                    <span class="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0"></span>
                                    <div><strong class="text-gray-900 dark:text-white">Yüksek:</strong> Belirgin net düşüşü, kronik zayıf konu veya düşük ödev disiplini.</div>
                                </li>
                                <li class="flex items-start gap-2">
                                    <span class="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0"></span>
                                    <div><strong class="text-gray-900 dark:text-white">Orta:</strong> Tekil konu eksikliği, dikkatsizlik veya süre yönetimi eksiği.</div>
                                </li>
                                <li class="flex items-start gap-2">
                                    <span class="w-2 h-2 rounded-full bg-slate-400 mt-1 shrink-0"></span>
                                    <div><strong class="text-gray-900 dark:text-white">İzle:</strong> Performansı hedeflerle uyumlu, stabil ilerleyen öğrenciler.</div>
                                </li>
                            </ul>
                        </article>
                    </div>
                </section>
            ` : currentTab === 'agenda' ? `
                <!-- ==================== TAKİP TAKVİMİ (UX-06.4) ==================== -->
                <!-- Filtreler & Arama -->
                <section class="app-panel p-4 mt-1 space-y-3">
                    <div class="flex flex-wrap gap-2">
                        ${followUpCategoryFilters.map(([key, label]) => `
                            <button onclick="updateGuidanceFilters({followUpCategory:'${key}'})" class="min-h-[44px] sm:min-h-[36px] rounded-full border px-3 text-xs font-bold transition ${followUpCategory === key ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:border-indigo-300 dark:border-gray-700 dark:text-gray-300'}">
                                ${label}
                            </button>
                        `).join('')}
                    </div>
                    <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
                        <label class="relative">
                            <span class="sr-only">Takip veya not ara</span>
                            <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                            <input id="guidanceSearchInput" value="${escapeHtml(query)}" oninput="updateGuidanceFilters({query:this.value})" class="student-form-input min-h-[44px] pl-10 text-xs" placeholder="Öğrenci adı, sorun veya müdahale ara...">
                        </label>
                        <select onchange="updateGuidanceFilters({followUpStudentId:this.value})" class="student-form-input min-h-[44px] text-xs">
                            <option value="all">Tüm Öğrenciler</option>
                            ${students.map(s => `
                                <option value="${s.id}" ${followUpStudentId === s.id ? 'selected' : ''}>${escapeHtml(s.adSoyad)}</option>
                            `).join('')}
                        </select>
                    </div>
                </section>

                ${followUpMetrics.isAllClear ? `
                    <div class="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 mt-4">
                        <i class="fas fa-circle-check text-emerald-600"></i>
                        <span>Bugünkü ve geciken tüm rehberlik takipleri güncel.</span>
                    </div>
                ` : ''}

                <!-- 2-Column Follow-Up Grid -->
                <section class="grid gap-4 lg:grid-cols-2 mt-4">
                    <!-- Sol Kolon: Bugün & Geciken Takipler -->
                    <div class="space-y-4">
                        <!-- Bugün Takip Edilecekler -->
                        <article class="app-panel p-5 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                                        <span>Bugün Takip Edilecekler</span>
                                        <span class="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                            ${followUpData.today.length}
                                        </span>
                                    </h3>
                                    <p class="text-xs text-gray-500 mt-0.5">Bugün sonuç veya ara kontrol bekleyen öğrenciler</p>
                                </div>
                                <span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
                                    <i class="fas fa-calendar-day"></i>
                                </span>
                            </div>
                            <div class="space-y-3">
                                ${todayCardsHtml}
                            </div>
                        </article>

                        <!-- Geciken Takipler -->
                        <article class="app-panel p-5 space-y-3 ${followUpData.overdue.length ? 'border-amber-200 dark:border-amber-900/60' : ''}">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                                        <span>Geciken Takipler</span>
                                        <span class="px-2 py-0.5 rounded-full text-xs font-black ${followUpData.overdue.length ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}">
                                            ${followUpData.overdue.length}
                                        </span>
                                    </h3>
                                    <p class="text-xs text-gray-500 mt-0.5">Takip tarihi geçmiş ancak henüz sonuçlandırılmamış kayıtlar</p>
                                </div>
                                <span class="w-8 h-8 rounded-lg ${followUpData.overdue.length ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'} flex items-center justify-center text-xs">
                                    <i class="fas fa-triangle-exclamation"></i>
                                </span>
                            </div>
                            <div class="space-y-3">
                                ${overdueCardsHtml}
                            </div>
                        </article>
                    </div>

                    <!-- Sağ Kolon: Bu Hafta & Yaklaşan Takipler -->
                    <div class="space-y-4">
                        <!-- Bu Hafta (Pazar'a kadar) -->
                        <article class="app-panel p-5 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                                        <span>Bu Hafta</span>
                                        <span class="px-2 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                            ${followUpData.thisWeek.length}
                                        </span>
                                    </h3>
                                    <p class="text-xs text-gray-500 mt-0.5">Hafta sonuna kadar planlanmış açık takipler</p>
                                </div>
                                <span class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center text-xs">
                                    <i class="fas fa-calendar-week"></i>
                                </span>
                            </div>
                            <div class="space-y-2">
                                ${thisWeekHtml}
                            </div>
                        </article>

                        <!-- Yaklaşan Takipler -->
                        <article class="app-panel p-5 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                                        <span>Yaklaşan Takipler</span>
                                        <p class="text-xs text-gray-500 mt-0.5">Sonraki haftalara planlanan takipler</p>
                                    </div>
                                </div>
                                <span class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center text-xs">
                                    <i class="fas fa-calendar"></i>
                                </span>
                            </div>
                            <div class="space-y-2">
                                ${upcomingHtml}
                            </div>
                        </article>

                        <!-- Tarih Belirlenmemiş Açık Kayıtlar (Varsa) -->
                        ${followUpData.undated.length ? `
                            <article class="app-panel p-5 space-y-3">
                                <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                    <div>
                                        <h3 class="font-black text-base text-gray-900 dark:text-white">Tarih Belirlenmemiş</h3>
                                        <p class="text-xs text-gray-500 mt-0.5">${followUpData.undated.length} açık takip tarihi bekliyor</p>
                                    </div>
                                    <span class="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-xs">
                                        <i class="fas fa-calendar-xmark"></i>
                                    </span>
                                </div>
                                <div class="space-y-2">
                                    ${undatedHtml}
                                </div>
                            </article>
                        ` : ''}
                    </div>
                </section>
            ` : `
                <!-- ==================== HAFTALIK ÖZET (UX-06.5) ==================== -->
                <!-- Hafta Seçici Bar -->
                <section class="app-panel p-4 mt-1 flex items-center justify-between gap-3 flex-wrap">
                    <div class="flex items-center gap-2">
                        <button onclick="updateGuidanceFilters({tab:'weekly', selectedWeekOffset:${selectedWeekOffset - 1}})" class="btn-secondary px-3 py-2 text-xs font-bold min-h-[44px] sm:min-h-[38px] flex items-center gap-1.5" title="Önceki Hafta">
                            <i class="fas fa-chevron-left"></i> <span class="hidden sm:inline">Önceki Hafta</span>
                        </button>
                        <button onclick="updateGuidanceFilters({tab:'weekly', selectedWeekOffset:${selectedWeekOffset + 1}})" class="btn-secondary px-3 py-2 text-xs font-bold min-h-[44px] sm:min-h-[38px] flex items-center gap-1.5" title="Sonraki Hafta">
                            <span class="hidden sm:inline">Sonraki Hafta</span> <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-900 text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                            <i class="far fa-calendar-alt text-indigo-600 dark:text-indigo-400"></i>
                            ${escapeHtml(formatWeekDateRange(selectedWeekRange.monday, selectedWeekRange.sunday))}
                            ${selectedWeekOffset === 0 ? '<span class="ml-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">(Bu Hafta)</span>' : ''}
                        </span>
                        ${selectedWeekOffset !== 0 ? `
                            <button onclick="updateGuidanceFilters({tab:'weekly', selectedWeekOffset:0})" class="btn-secondary px-3 py-1.5 text-xs font-bold min-h-[44px] sm:min-h-[36px] text-indigo-600">
                                Bu Haftaya Dön
                            </button>
                        ` : ''}
                    </div>
                </section>

                <!-- 5 Kompakt Haftalık Metrik Kartı -->
                <section class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
                    <article class="app-panel p-4">
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas fa-calendar-days text-xs"></i>
                            <p class="text-[11px] font-black uppercase tracking-[.08em]">Planlanan</p>
                        </div>
                        <p class="mt-2.5 text-2xl font-black text-slate-900 dark:text-white">${weeklyAnalytics.metrics.plannedCount}</p>
                        <p class="mt-1 text-xs text-gray-500">${weeklyAnalytics.isFutureWeek ? 'Gelecek takipler' : `${weeklyAnalytics.metrics.plannedCompletedCount} tamamlandı`}</p>
                    </article>

                    <article class="app-panel p-4">
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas fa-chart-pie text-xs text-indigo-600"></i>
                            <p class="text-[11px] font-black uppercase tracking-[.08em]">Planlanan Tamamlama</p>
                        </div>
                        <p class="mt-2.5 text-2xl font-black text-slate-900 dark:text-white">${weeklyAnalytics.metrics.plannedCompletionRate !== null ? `%${weeklyAnalytics.metrics.plannedCompletionRate}` : '—'}</p>
                        <p class="mt-1 text-xs text-gray-500">${weeklyAnalytics.isFutureWeek ? 'Henüz başlamadı' : `${weeklyAnalytics.metrics.plannedCompletedCount} / ${weeklyAnalytics.metrics.plannedCount} planlı`}</p>
                    </article>

                    <article class="app-panel p-4">
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas fa-clipboard-check text-xs text-emerald-600"></i>
                            <p class="text-[11px] font-black uppercase tracking-[.08em]">Sonuçlandırılan</p>
                        </div>
                        <p class="mt-2.5 text-2xl font-black text-slate-900 dark:text-white">${weeklyAnalytics.metrics.completedInWeekCount}</p>
                        <p class="mt-1 text-xs text-gray-500">${weeklyAnalytics.isFutureWeek ? 'Henüz başlamadı' : `${weeklyAnalytics.metrics.onTimeCount} zamanında`}</p>
                    </article>

                    <article class="app-panel p-4">
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas fa-triangle-exclamation text-xs ${weeklyAnalytics.metrics.overdueCount > 0 ? 'text-rose-500' : ''}"></i>
                            <p class="text-[11px] font-black uppercase tracking-[.08em]">${weeklyAnalytics.isPastWeek ? 'Devreden Açık' : (weeklyAnalytics.isFutureWeek ? 'Geciken' : 'Geciken / Açık')}</p>
                        </div>
                        <p class="mt-2.5 text-2xl font-black ${weeklyAnalytics.metrics.overdueCount > 0 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-900 dark:text-white'}">${weeklyAnalytics.metrics.overdueCount}</p>
                        <p class="mt-1 text-xs text-gray-500">${weeklyAnalytics.isPastWeek ? 'Hafta sonu devreden' : (weeklyAnalytics.isFutureWeek ? 'Planlanan dönemde' : 'Gecikmedeki takip')}</p>
                    </article>

                    <article class="app-panel p-4 col-span-2 md:col-span-1">
                        <div class="flex items-center gap-2 text-gray-400">
                            <i class="fas fa-face-smile text-xs text-amber-500"></i>
                            <p class="text-[11px] font-black uppercase tracking-[.08em]">Olumlu Sonuç</p>
                        </div>
                        <p class="mt-2.5 text-2xl font-black text-slate-900 dark:text-white">${weeklyAnalytics.metrics.positiveOutcomeCount}</p>
                        <p class="mt-1 text-xs text-gray-500">${weeklyAnalytics.isFutureWeek ? 'Henüz başlamadı' : (weeklyAnalytics.metrics.positiveRate !== null ? `%${weeklyAnalytics.metrics.positiveRate} olumlu oran` : 'Ölçüm yok')}</p>
                    </article>
                </section>

                <!-- Haftalık Durum Özeti & Karşılaştırma -->
                <section class="app-panel p-5 mt-4 space-y-3 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/30 dark:from-slate-900/60 dark:to-gray-900 border-indigo-100/70 dark:border-gray-800">
                    <div class="flex items-center justify-between gap-3 flex-wrap">
                        <div class="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                            <i class="fas ${weeklyAnalytics.isFutureWeek ? 'fa-calendar-plus' : 'fa-chart-line'} text-indigo-600 dark:text-indigo-400"></i>
                            <span>${weeklyAnalytics.isFutureWeek ? 'Gelecek Hafta Planlaması' : 'Haftalık Operasyon Durumu'}</span>
                        </div>
                        ${weeklyComparison.hasEnoughData ? `
                            <div class="flex items-center gap-2 text-xs font-bold flex-wrap">
                                <span class="text-gray-500">Geçen Haftaya Göre:</span>
                                ${weeklyComparison.diffCompRate !== null ? `
                                    <span class="px-2 py-0.5 rounded-md ${weeklyComparison.diffCompRate >= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}">
                                        Tamamlama ${weeklyComparison.diffCompRate >= 0 ? `+${weeklyComparison.diffCompRate}` : weeklyComparison.diffCompRate} puan
                                    </span>
                                ` : ''}
                                <span class="px-2 py-0.5 rounded-md ${weeklyComparison.diffOverdue <= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'}">
                                    Geciken ${weeklyComparison.diffOverdue > 0 ? `+${weeklyComparison.diffOverdue}` : weeklyComparison.diffOverdue}
                                </span>
                            </div>
                        ` : `
                            <span class="text-xs text-gray-400 italic">Karşılaştırma için önceki haftada yeterli kayıt yok.</span>
                        `}
                    </div>
                    <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">
                        ${escapeHtml(weeklyAnalytics.narrative)}
                    </p>
                </section>

                <!-- 2-Column Analytics Content -->
                <section class="grid gap-4 lg:grid-cols-2 mt-4">
                    <!-- Sol Kolon: Öğrenci Bazlı Takip ve Açık/Devreden Takipler -->
                    <div class="space-y-4">
                        <!-- Öğrenci Bazlı Takip Özeti -->
                        <article class="app-panel p-5 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white">Öğrenci Bazlı Takip Özeti</h3>
                                    <p class="text-xs text-gray-500 mt-0.5">${weeklyAnalytics.studentSummaries.length} öğrenci bu hafta kayıtlarda yer alıyor</p>
                                </div>
                                <span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
                                    <i class="fas fa-users"></i>
                                </span>
                            </div>

                            <div class="space-y-2">
                                ${weeklyAnalytics.studentSummaries.length ? weeklyAnalytics.studentSummaries.map(s => `
                                    <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200/60 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <span class="font-bold text-sm text-gray-900 dark:text-white">${escapeHtml(s.studentName)}</span>
                                                <span class="text-xs text-gray-400">${s.sinif ? `${s.sinif}. Sınıf` : ''}</span>
                                            </div>
                                            <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mt-1 flex-wrap">
                                                <span>Planlanan: <strong>${s.plannedCount}</strong></span>
                                                <span>•</span>
                                                <span>Tamamlanan: <strong class="text-emerald-600">${s.completedCount}</strong></span>
                                                ${s.overdueCount > 0 ? `
                                                    <span>•</span>
                                                    <span class="text-rose-600 font-bold">Geciken: ${s.overdueCount}</span>
                                                ` : ''}
                                                ${s.results.length ? `
                                                    <span>•</span>
                                                    <span class="text-indigo-600">${escapeHtml(s.results.join(', '))}</span>
                                                ` : ''}
                                            </div>
                                        </div>
                                        <button onclick="openGuidanceStudent('${s.studentId}')" class="btn-secondary py-1.5 px-3 text-xs font-semibold min-h-[44px] sm:min-h-[36px]">
                                            Dosya
                                        </button>
                                    </div>
                                `).join('') : `
                                    <div class="p-6 text-center text-gray-400 text-xs">
                                        <p>Bu hafta için öğrenci takip kaydı bulunmuyor.</p>
                                    </div>
                                `}
                            </div>
                        </article>

                        <!-- Açık / Devreden Takipler -->
                        <article class="app-panel p-5 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white">
                                        ${weeklyAnalytics.isPastWeek ? 'Devreden Açık Takipler' : 'Hâlâ Açık Takipler'}
                                    </h3>
                                    <p class="text-xs text-gray-500 mt-0.5">
                                        ${weeklyAnalytics.isPastWeek ? 'Haftanın sonunda açık kalan ve devreden takipler' : 'Bu haftada henüz sonuçlandırılmamış açık takipler'}
                                    </p>
                                </div>
                                <span class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center text-xs">
                                    <i class="fas fa-hourglass-half"></i>
                                </span>
                            </div>

                            <div class="space-y-2">
                                ${weeklyAnalytics.openInWeek.length ? weeklyAnalytics.openInWeek.map(item => `
                                    <div class="p-3 bg-white dark:bg-gray-900/80 rounded-xl border border-gray-200/70 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <span class="font-bold text-xs text-gray-900 dark:text-white">${escapeHtml(item.studentName)}</span>
                                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                    ${escapeHtml(item.record.type ? (GUIDANCE_RECORD_TYPES[item.record.type] || item.record.type) : 'Akademik')}
                                                </span>
                                                ${item.record.followUpDate ? `
                                                    <span class="text-[11px] text-gray-500">Takip: ${escapeHtml(formatFollowUpDisplayDate(item.record.followUpDate))}</span>
                                                ` : ''}
                                            </div>
                                            <p class="text-xs text-gray-600 dark:text-gray-300 truncate mt-1">${escapeHtml(item.record.issue)}</p>
                                        </div>
                                        <div class="flex items-center gap-1.5">
                                            <button onclick="showCompleteGuidanceRecordModal('${item.studentId}', '${item.record.id}')" class="btn-primary py-1.5 px-3 text-xs font-bold min-h-[44px] sm:min-h-[36px]">
                                                Sonuç Gir
                                            </button>
                                            <button onclick="openGuidanceStudent('${item.studentId}')" class="btn-secondary py-1.5 px-3 text-xs font-semibold min-h-[44px] sm:min-h-[36px]">
                                                Dosya
                                            </button>
                                        </div>
                                    </div>
                                `).join('') : `
                                    <div class="p-6 text-center text-gray-400 text-xs">
                                        <i class="fas fa-check-circle text-emerald-500 text-lg mb-1 block"></i>
                                        <p>Bu haftaya ait açık veya devreden takip bulunmuyor.</p>
                                    </div>
                                `}
                            </div>
                        </article>
                    </div>

                    <!-- Sağ Kolon: Sonuç Dağılımı, Kategori Dağılımı ve Tamamlananlar -->
                    <div class="space-y-4">
                        <!-- Sonuç Dağılımı & Takip Alanı -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <!-- Sonuç Dağılımı -->
                            <article class="app-panel p-4 space-y-3">
                                <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                                    <h4 class="font-black text-sm text-gray-900 dark:text-white">Sonuç Dağılımı</h4>
                                    <i class="fas fa-poll text-xs text-gray-400"></i>
                                </div>
                                <ul class="space-y-2 text-xs">
                                    <li class="flex items-center justify-between">
                                        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Olumlu</span>
                                        <strong class="text-emerald-700 dark:text-emerald-400">${weeklyAnalytics.outcomes.positive}</strong>
                                    </li>
                                    <li class="flex items-center justify-between">
                                        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-slate-400"></span> Değişim Yok</span>
                                        <strong>${weeklyAnalytics.outcomes.neutral}</strong>
                                    </li>
                                    <li class="flex items-center justify-between">
                                        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span> Gerileme</span>
                                        <strong class="text-rose-600">${weeklyAnalytics.outcomes.negative}</strong>
                                    </li>
                                    <li class="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500">
                                        <span>Henüz Ölçülmedi (Açık)</span>
                                        <span>${weeklyAnalytics.pendingOpenCount}</span>
                                    </li>
                                </ul>
                            </article>

                            <!-- Takip Alanı Dağılımı -->
                            <article class="app-panel p-4 space-y-3">
                                <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                                    <h4 class="font-black text-sm text-gray-900 dark:text-white">Rehberlik Türü</h4>
                                    <i class="fas fa-tags text-xs text-gray-400"></i>
                                </div>
                                <ul class="space-y-2 text-xs">
                                    <li class="flex items-center justify-between">
                                        <span>Akademik</span>
                                        <strong>${weeklyAnalytics.categories.academic}</strong>
                                    </li>
                                    <li class="flex items-center justify-between">
                                        <span>Ödev / Disiplin</span>
                                        <strong>${weeklyAnalytics.categories.discipline}</strong>
                                    </li>
                                    <li class="flex items-center justify-between">
                                        <span>Sınav / Performans</span>
                                        <strong>${weeklyAnalytics.categories.performance}</strong>
                                    </li>
                                    <li class="flex items-center justify-between">
                                        <span>Genel Takip</span>
                                        <strong>${weeklyAnalytics.categories.general}</strong>
                                    </li>
                                </ul>
                            </article>
                        </div>

                        <!-- Bu Hafta Tamamlanan Takipler -->
                        <article class="app-panel p-5 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white">Bu Hafta Tamamlananlar</h3>
                                    <p class="text-xs text-gray-500 mt-0.5">${weeklyAnalytics.completedInWeek.length} takip bu hafta sonuçlandırıldı</p>
                                </div>
                                <span class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
                                    <i class="fas fa-check-double"></i>
                                </span>
                            </div>

                            <div class="space-y-2">
                                ${weeklyAnalytics.completedInWeek.length ? weeklyAnalytics.completedInWeek.map(item => `
                                    <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200/60 dark:border-gray-800 flex items-center justify-between gap-2 text-xs flex-wrap">
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-center gap-1.5 flex-wrap">
                                                <span class="font-bold text-gray-900 dark:text-white">${escapeHtml(item.studentName)}</span>
                                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                    ${escapeHtml(GUIDANCE_RESULT_OPTIONS[item.record.result] || item.record.result || 'Tamamlandı')}
                                                </span>
                                            </div>
                                            <p class="text-gray-600 dark:text-gray-400 truncate mt-0.5">${escapeHtml(item.record.action || item.record.issue)}</p>
                                        </div>
                                        <div class="text-right shrink-0">
                                            <p class="text-[11px] text-gray-500 font-medium">
                                                ${escapeHtml(formatFollowUpDisplayDate(item.record.closedAt))}
                                            </p>
                                            ${item.record.followUpDate && item.record.closedAt && item.record.closedAt.slice(0,10) <= item.record.followUpDate.slice(0,10) ? `
                                                <span class="text-[10px] font-bold text-emerald-600">Zamanında</span>
                                            ` : item.record.followUpDate ? `
                                                <span class="text-[10px] font-bold text-amber-600">Geç tamamlandı</span>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('') : `
                                    <div class="p-6 text-center text-gray-400 text-xs">
                                        <p>Bu hafta henüz tamamlanmış takip bulunmuyor.</p>
                                    </div>
                                `}
                            </div>
                        </article>

                        <!-- Geç Tamamlanan Takipler (Varsa küçük operasyonel bilgi) -->
                        ${weeklyAnalytics.lateCompleted.length ? `
                            <article class="app-panel p-4 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-2">
                                <div class="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                                    <i class="fas fa-info-circle text-amber-600"></i>
                                    <span>Geç Tamamlanan Takipler (${weeklyAnalytics.lateCompleted.length})</span>
                                </div>
                                <ul class="space-y-1 text-xs text-amber-900 dark:text-amber-300">
                                    ${weeklyAnalytics.lateCompleted.map(item => `
                                        <li class="flex items-center justify-between">
                                            <span>${escapeHtml(item.studentName)}</span>
                                            <span class="text-[11px] opacity-80">${item.daysLate} gün sonra tamamlandı</span>
                                        </li>
                                    `).join('')}
                                </ul>
                            </article>
                        ` : ''}
                    </div>
                </section>
            `}
        </div>
    `;
}

/**
 * Renders dedicated deep guidance decision report for a single student.
 */
export function renderGuidanceStudentDetail(studentId) {
    store.currentPage = 'guidance-detail';
    if (window.currentPage) window.currentPage = 'guidance-detail';
    updateMobileNavActive('mobile-nav-guidance');

    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return renderGuidancePage();

    const detail = buildStudentGuidanceDetail(student);

    const priorityBadgeStyles = {
        high: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-900/60',
        medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
        watch: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-gray-200 dark:border-gray-700'
    };

    const impactBadgeStyles = {
        positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200',
        neutral: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-gray-200',
        negative: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200'
    };

    const topMetrics = [
        ['fa-file-lines', 'Son Net', detail.recentExams.length ? `${detail.recentExams[0].net.toFixed(2)} net` : '—', detail.recentExams[0]?.name || 'Genel deneme kaydı yok'],
        ['fa-bullseye', 'Hedef Durumu', detail.hedefNet ? `${detail.hedefNet} net` : '—', detail.targetGap !== null ? (detail.targetGap <= 0 ? 'Hedefe ulaşıldı' : `${detail.targetGap.toFixed(2)} net fark`) : 'Hedef belirlenmedi'],
        ['fa-list-check', 'Ödev Disiplini', detail.discipline ? `%${detail.discipline.completionRate}` : '—', detail.discipline ? `${detail.discipline.completed} / ${detail.discipline.total} tamamlandı (${detail.discipline.overdue} geciken)` : 'Ödev kaydı yok'],
        ['fa-magnifying-glass', 'Baskın Hata', detail.dominantError ? detail.dominantError.label : '—', detail.dominantError ? `${detail.dominantError.count} hata tespiti` : 'Hata analizi yok']
    ];

    // Weak topics HTML
    const weakTopicsHtml = detail.repeatedTopics.length ? detail.repeatedTopics.map(t => `
        <div class="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200/60 dark:border-gray-800 flex items-center justify-between gap-2">
            <div>
                <p class="font-bold text-xs text-gray-900 dark:text-white">${escapeHtml(t.topic)}</p>
                <p class="text-[11px] text-gray-500 mt-0.5">${t.unite ? `${escapeHtml(t.unite)} · ` : ''}${t.assignmentCount > 1 ? `${t.assignmentCount} çalışmada tekrar etti` : 'Tekil çalışma'}</p>
            </div>
            <span class="px-2 py-1 rounded-md text-[11px] font-bold ${t.isChronic ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'} shrink-0">
                ${t.errorCount} Hata
            </span>
        </div>
    `).join('') : '<p class="text-xs text-gray-400 py-3">Tekrarlayan zayıf konu bulunmuyor.</p>';

    // Error Reasons HTML
    const errorReasonsHtml = detail.errorReasons.length ? detail.errorReasons.map(r => `
        <div class="space-y-1">
            <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-gray-800 dark:text-gray-200">${escapeHtml(r.label)}</span>
                <span class="text-gray-500 font-medium">${r.count} kez (%${r.percentage})</span>
            </div>
            <div class="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500 rounded-full" style="width: ${r.percentage}%"></div>
            </div>
        </div>
    `).join('') : '<p class="text-xs text-gray-400 py-2">Kayıtlı hata nedeni bulunmuyor.</p>';

    // Recent Lessons HTML
    const recentLessonsHtml = detail.recentLessons.length ? detail.recentLessons.map(l => `
        <div class="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 flex items-start justify-between gap-2 text-xs">
            <div>
                <p class="font-bold text-gray-900 dark:text-white">${escapeHtml(l.konu)}</p>
                <p class="text-[11px] text-gray-500 mt-0.5">${l.notlar ? escapeHtml(l.notlar) : 'Birebir ders'}</p>
            </div>
            <time class="text-[11px] text-gray-400 shrink-0">${escapeHtml(l.formattedDate || l.date)}</time>
        </div>
    `).join('') : '<p class="text-xs text-gray-400 py-2">Ders kaydı bulunmuyor.</p>';

    // Timeline HTML
    const timelineHtml = detail.timeline.length ? detail.timeline.map((act, index) => `
        <div class="relative flex items-start gap-3 ${index < detail.timeline.length - 1 ? 'pb-3' : ''}">
            ${index < detail.timeline.length - 1 ? '<span class="absolute left-3 top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-700"></span>' : ''}
            <span class="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-[10px] text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <i class="fas ${act.icon || 'fa-circle-info'}"></i>
            </span>
            <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                    <p class="font-bold text-xs text-gray-900 dark:text-white truncate">
                        ${escapeHtml(act.typeLabel)}
                    </p>
                    <time class="shrink-0 text-[11px] text-gray-400">${escapeHtml(act.formattedDate || act.date)}</time>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">${escapeHtml(act.detail)}</p>
            </div>
        </div>
    `).join('') : '<p class="text-xs text-gray-400 py-4 text-center">Henüz aktivite kaydı yok.</p>';

    // Before / After Study Plan HTML
    let impactSectionHtml = '';
    const impact = detail.interventionImpact;
    if (impact.status === 'measured') {
        impactSectionHtml = `
            <div class="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-3">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-xs font-black uppercase tracking-wider text-gray-400">Çalışma Planı</p>
                        <p class="font-bold text-sm text-gray-900 dark:text-white mt-0.5">${escapeHtml(impact.planSubject)} (${escapeHtml(impact.formattedPlanDate)})</p>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-xs font-black border ${impactBadgeStyles[impact.impactStatus] || impactBadgeStyles.neutral}">
                        ${escapeHtml(impact.impactLabel)}
                    </span>
                </div>
                <div class="grid grid-cols-3 gap-2 pt-1 border-t border-gray-200 dark:border-gray-800 text-center">
                    <div>
                        <p class="text-[11px] text-gray-400 font-medium">Plan Öncesi</p>
                        <p class="text-base font-black text-gray-800 dark:text-gray-100 mt-0.5">${impact.beforeNet.toFixed(2)} net</p>
                    </div>
                    <div>
                        <p class="text-[11px] text-gray-400 font-medium">Plan Sonrası</p>
                        <p class="text-base font-black text-gray-800 dark:text-gray-100 mt-0.5">${impact.afterNet.toFixed(2)} net</p>
                    </div>
                    <div>
                        <p class="text-[11px] text-gray-400 font-medium">Net Değişimi</p>
                        <p class="text-base font-black ${impact.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} mt-0.5">
                            ${impact.delta >= 0 ? `+${impact.delta.toFixed(2)}` : impact.delta.toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>
        `;
    } else if (impact.status === 'pending_measurement') {
        impactSectionHtml = `
            <div class="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/40 flex items-start gap-2.5">
                <i class="fas fa-hourglass-half text-amber-600 mt-0.5"></i>
                <div>
                    <p class="font-bold text-xs text-amber-900 dark:text-amber-200">${escapeHtml(impact.planSubject)} (${escapeHtml(impact.formattedPlanDate)})</p>
                    <p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">${escapeHtml(impact.message)}</p>
                </div>
            </div>
        `;
    } else {
        impactSectionHtml = `
            <div class="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 text-center text-xs text-gray-400">
                <p>Henüz aktif veya tamamlanmış bir çalışma planı kaydı bulunmuyor.</p>
            </div>
        `;
    }

    // Guidance Records HTML
    const guidanceRecords = detail.guidanceRecords || [];
    const guidanceRecordsHtml = guidanceRecords.length ? guidanceRecords.map(rec => {
        const isDue = isGuidanceRecordDue(rec);
        let statusBadge = '';
        if (rec.status === 'completed') {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-1"><i class="fas fa-check-circle text-[10px]"></i> Tamamlandı</span>`;
        } else if (rec.result === 'pending') {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">Henüz Ölçülmedi · Takipte</span>`;
        } else if (isDue) {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1 animate-pulse"><i class="fas fa-clock text-[10px]"></i> Takip Bekliyor</span>`;
        } else {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">Takipte</span>`;
        }

        return `
            <div class="p-3.5 bg-white dark:bg-gray-900/80 rounded-xl border ${isDue ? 'border-amber-300 dark:border-amber-800 shadow-sm' : 'border-gray-200/70 dark:border-gray-800'} space-y-2">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-bold text-gray-500">${escapeHtml(rec.formattedDate || rec.date)}</span>
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            ${escapeHtml(rec.typeLabel)}
                        </span>
                        ${statusBadge}
                    </div>
                    <div class="flex items-center gap-1">
                        ${rec.status === 'open' ? `
                            <button onclick="showCompleteGuidanceRecordModal('${studentId}', '${rec.id}')" class="btn-primary py-1 px-2.5 text-[11px] font-bold min-h-[30px] flex items-center gap-1" title="Sonuç Değerlendirmesi Gir">
                                <i class="fas fa-clipboard-check"></i> Sonuç Gir
                            </button>
                        ` : ''}
                        <button onclick="showGuidanceRecordModal('${studentId}', '${rec.id}')" class="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded min-h-[30px]" title="Düzenle">
                            <i class="fas fa-pen text-xs"></i>
                        </button>
                        <button onclick="confirmDeleteGuidanceRecord('${studentId}', '${rec.id}')" class="p-1.5 text-gray-400 hover:text-rose-600 rounded min-h-[30px]" title="Sil">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>

                <div class="space-y-1 text-xs">
                    <p class="text-gray-800 dark:text-gray-200 leading-relaxed">
                        <span class="font-bold text-gray-900 dark:text-white">Sorun / Gözlem:</span> ${escapeHtml(rec.issue)}
                    </p>
                    <p class="text-gray-800 dark:text-gray-200 leading-relaxed">
                        <span class="font-bold text-gray-900 dark:text-white">Planlanan / Uygulanan Müdahale:</span> ${escapeHtml(rec.action)}
                    </p>
                    ${rec.followUpDate ? `
                        <p class="text-[11px] text-gray-500 dark:text-gray-400 pt-0.5 flex items-center gap-1">
                            <i class="far fa-calendar-check text-indigo-500"></i> Takip Tarihi: <span class="font-semibold text-gray-700 dark:text-gray-300">${escapeHtml(rec.formattedFollowUpDate || rec.followUpDate)}</span>
                        </p>
                    ` : ''}
                    ${rec.note ? `
                        <div class="text-[11px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/40 p-2 rounded-lg border border-gray-100 dark:border-gray-800 mt-1">
                            ${escapeHtml(rec.note)}
                        </div>
                    ` : ''}
                    ${rec.result && rec.result !== 'pending' ? `
                        <div class="mt-2 p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-gray-800 dark:text-gray-200">Öğretmen Değerlendirmesi:</span>
                                <span class="font-black ${rec.result === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : (rec.result === 'negative' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300')}">
                                    ${escapeHtml(rec.resultLabel || 'Değerlendirildi')}
                                </span>
                            </div>
                            ${rec.resultNote ? `<p class="text-[11px] text-gray-600 dark:text-gray-400 mt-1 italic">${escapeHtml(rec.resultNote)}</p>` : ''}
                        </div>
                    ` : (rec.result === 'pending' && rec.resultNote ? `
                        <div class="mt-2 p-2 bg-amber-50/60 dark:bg-amber-950/30 rounded-lg border border-amber-200/60 dark:border-amber-900/40 text-xs">
                            <p class="font-bold text-amber-900 dark:text-amber-200">Ön Değerlendirme (Takipte):</p>
                            <p class="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 italic">${escapeHtml(rec.resultNote)}</p>
                        </div>
                    ` : '')}
                </div>
            </div>
        `;
    }).join('') : `
        <div class="p-6 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800 text-center space-y-2.5">
            <div class="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center text-sm">
                <i class="fas fa-clipboard-list"></i>
            </div>
            <div>
                <p class="font-bold text-xs text-gray-800 dark:text-gray-200">Henüz rehberlik kaydı bulunmuyor.</p>
                <p class="text-xs text-gray-500 mt-0.5">İlk kaydı oluşturarak öğrencinin gelişim sürecini takip etmeye başlayabilirsiniz.</p>
            </div>
            <button onclick="showGuidanceRecordModal('${studentId}')" class="btn-primary py-2 px-4 text-xs font-bold min-h-[40px] inline-flex items-center gap-1.5">
                <i class="fas fa-plus"></i> Rehberlik Kaydı Ekle
            </button>
        </div>
    `;

    // ==================== PERFORMANS MERKEZİ (UX-08) ====================
    const studentHomeworks = getStudentOdevler(student) || student.odevler || [];
    const hwInsights = buildHomeworkPerformanceInsights(student, studentHomeworks);
    const examInsights = buildSchoolExamPerformanceInsights(student);


    const perfTab = window._guidancePerformanceTab || 'homework';
    const hwRange = window._guidanceHwRange || 'all';
    const examRange = window._guidanceExamRange || 'all';
    const selectedExamSubject = window._guidanceExamSelectedSubject || 'Matematik';

    const hwFilteredSeries = hwRange === 'last5'
        ? hwInsights.slices.last5
        : (hwRange === 'last10' ? hwInsights.slices.last10 : hwInsights.slices.all);

    const examFilteredSeries = examRange === 'last5'
        ? examInsights.slices.last5
        : (examRange === 'last10' ? examInsights.slices.last10 : examInsights.slices.all);

    let hwTrendBadge = '';
    if (hwInsights.summary.trendDirection === 'improving') {
        hwTrendBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200"><i class="fas fa-arrow-up text-[9px] mr-0.5"></i> Yükseliş</span>';
    } else if (hwInsights.summary.trendDirection === 'declining') {
        hwTrendBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200"><i class="fas fa-arrow-down text-[9px] mr-0.5"></i> Düşüş</span>';
    } else if (hwInsights.summary.trendDirection === 'stable') {
        hwTrendBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200">İstikrarlı</span>';
    }

    let examTrendBadge = '';
    if (examInsights.summary.trendDirection === 'improving') {
        examTrendBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200"><i class="fas fa-arrow-up text-[9px] mr-0.5"></i> Yükseliş</span>';
    } else if (examInsights.summary.trendDirection === 'declining') {
        examTrendBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200"><i class="fas fa-arrow-down text-[9px] mr-0.5"></i> Düşüş</span>';
    } else if (examInsights.summary.trendDirection === 'stable') {
        examTrendBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-gray-200">İstikrarlı</span>';
    }

    const homeworkTabHtml = `
        <div class="space-y-4">
            <!-- 6 Kompakt Üst KPI Kartı -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">Ortalama Doğru</p>
                    <p class="text-lg font-black text-gray-900 dark:text-white mt-1">${hwInsights.summary.averageCorrect !== null ? hwInsights.summary.averageCorrect : '—'}</p>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">Ortalama Yanlış</p>
                    <p class="text-lg font-black text-gray-900 dark:text-white mt-1">${hwInsights.summary.averageWrong !== null ? hwInsights.summary.averageWrong : '—'}</p>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">Ortalama Net</p>
                    <p class="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1">${hwInsights.summary.averageNet !== null ? `${hwInsights.summary.averageNet} net` : '—'}</p>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">Son Ödev Neti</p>
                    <p class="text-lg font-black text-gray-900 dark:text-white mt-1">${hwInsights.summary.latestNet !== null ? `${hwInsights.summary.latestNet} net` : '—'}</p>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">Net Değişimi</p>
                    <div class="flex items-center gap-1 mt-1">
                        <p class="text-lg font-black ${hwInsights.summary.netChange > 0 ? 'text-emerald-600' : (hwInsights.summary.netChange < 0 ? 'text-rose-600' : 'text-gray-700 dark:text-gray-300')}">
                            ${hwInsights.summary.netChange !== null ? (hwInsights.summary.netChange > 0 ? `+${hwInsights.summary.netChange}` : hwInsights.summary.netChange) : '—'}
                        </p>
                        ${hwTrendBadge}
                    </div>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">Tamamlanan Ödev</p>
                    <p class="text-lg font-black text-gray-900 dark:text-white mt-1">${hwInsights.summary.totalCompleted} / ${hwInsights.summary.totalAssigned}</p>
                </div>
            </div>

            <!-- Deterministik Rehberlik Yorumu (Ödev) -->
            <div class="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs shrink-0 mt-0.5">
                    <i class="fas fa-lightbulb"></i>
                </span>
                <div class="text-xs">
                    <p class="font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider text-[11px]">Rehberlik Değerlendirmesi & Karar Desteği</p>
                    <p class="text-gray-800 dark:text-gray-200 mt-0.5 font-medium leading-relaxed">${escapeHtml(hwInsights.narrative)}</p>
                </div>
            </div>

            <!-- Ödev Net Trend Grafiği -->
            <div class="p-4 bg-white dark:bg-gray-900/70 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h4 class="font-black text-sm text-gray-900 dark:text-white">Ödev Net Gelişim Trendi</h4>
                        <p class="text-[11px] text-gray-500">Tamamlanan ödevlerdeki net değişimi</p>
                    </div>
                    <div class="inline-flex p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold">
                        <button onclick="setGuidanceHomeworkRange('${studentId}', 'last5')" class="px-3 py-1.5 min-h-[40px] rounded-md transition-colors ${hwRange === 'last5' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}">Son 5</button>
                        <button onclick="setGuidanceHomeworkRange('${studentId}', 'last10')" class="px-3 py-1.5 min-h-[40px] rounded-md transition-colors ${hwRange === 'last10' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}">Son 10</button>
                        <button onclick="setGuidanceHomeworkRange('${studentId}', 'all')" class="px-3 py-1.5 min-h-[40px] rounded-md transition-colors ${hwRange === 'all' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}">Tümü</button>
                    </div>
                </div>
                <div class="relative w-full h-56">
                    ${hwFilteredSeries.length > 0 ? `
                        <canvas id="guidanceHomeworkNetChart"></canvas>
                    ` : `
                        <div class="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center p-4">
                            <i class="fas fa-chart-line text-2xl mb-2 opacity-40"></i>
                            <p>Grafik çizimi için henüz tamamlanmış ödev sonucu bulunmuyor.</p>
                        </div>
                    `}
                </div>
            </div>

            <!-- 2 Kolon: Zayıf Konular vs Hata Nedenleri -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <!-- Sol: Zayıf Konu / Hata Dağılımı (Ünite + Konu, no kazanım) -->
                <div class="p-4 bg-white dark:bg-gray-900/70 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-3">
                    <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                        <div>
                            <h4 class="font-black text-sm text-gray-900 dark:text-white">Ödevlerde Zorlanılan Konular</h4>
                            <p class="text-[11px] text-gray-500">Ünite ve konu bazında hata yoğunluğu</p>
                        </div>
                        <span class="text-xs font-bold text-gray-400">${hwInsights.weakTopics.length} konu</span>
                    </div>
                    <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
                        ${hwInsights.weakTopics.length ? hwInsights.weakTopics.map(topic => `
                            <div class="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                                <div class="min-w-0">
                                    <p class="font-bold text-xs text-gray-900 dark:text-white truncate">${escapeHtml(topic.konu)}</p>
                                    <p class="text-[11px] text-gray-500 truncate mt-0.5">${escapeHtml(topic.unite)} · ${topic.assignmentCount} ödevde tekrar etti</p>
                                </div>
                                <div class="flex items-center gap-1.5 shrink-0">
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        topic.status === 'chronic' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900' :
                                        (topic.status === 'repeated' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-900' :
                                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')
                                    }">
                                        ${topic.status === 'chronic' ? 'Kronik' : (topic.status === 'repeated' ? 'Tekrarlayan' : 'İzlenmeli')}
                                    </span>
                                    <span class="px-2 py-0.5 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                        ${topic.errorCount} hata
                                    </span>
                                </div>
                            </div>
                        `).join('') : '<p class="text-xs text-gray-400 py-4 text-center">Zayıf konu tespiti bulunmuyor.</p>'}
                    </div>
                </div>

                <!-- Sağ: Hata Nedenleri Dağılımı (7 Canonical Keys) -->
                <div class="p-4 bg-white dark:bg-gray-900/70 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-3">
                    <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                        <div>
                            <h4 class="font-black text-sm text-gray-900 dark:text-white">Hata Nedenleri Dağılımı</h4>
                            <p class="text-[11px] text-gray-500">Kavramsal eksiklik vs sınav tekniği analizi</p>
                        </div>
                        ${hwInsights.dominantErrorType ? `
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200">
                                Baskın: ${escapeHtml(hwInsights.dominantErrorType.label)}
                            </span>
                        ` : ''}
                    </div>
                    <!-- 7 Neden Bar Dağılımı -->
                    <div class="space-y-2">
                        ${hwInsights.errorReasons.map(r => `
                            <div class="space-y-1">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="font-bold text-gray-800 dark:text-gray-200">${escapeHtml(r.label)}</span>
                                    <span class="text-gray-500 font-semibold">${r.count} (%${r.percentage})</span>
                                </div>
                                <div class="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div class="h-full bg-indigo-500 rounded-full transition-all duration-300" style="width: ${r.percentage}%"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <!-- Kategorik Özet -->
                    <div class="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                        <div class="p-2 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Kavramsal / Bilgi</p>
                            <p class="text-sm font-black text-indigo-700 dark:text-indigo-400 mt-0.5">%${hwInsights.errorCategoryBreakdown.academic.percentage}</p>
                        </div>
                        <div class="p-2 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Sınav Tekniği</p>
                            <p class="text-sm font-black text-amber-700 dark:text-amber-400 mt-0.5">%${hwInsights.errorCategoryBreakdown.technique.percentage}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const examsTabHtml = `
        <div class="space-y-4">
            <!-- 6 Kompakt Üst KPI Kartı -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">Son Deneme Neti</p>
                    <p class="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1">${examInsights.summary.latestTotalNet !== null ? `${examInsights.summary.latestTotalNet} net` : '—'}</p>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">Ortalama Net</p>
                    <p class="text-lg font-black text-gray-900 dark:text-white mt-1">${examInsights.summary.averageTotalNet !== null ? `${examInsights.summary.averageTotalNet} net` : '—'}</p>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">Son Net Farkı</p>
                    <div class="flex items-center gap-1 mt-1">
                        <p class="text-lg font-black ${examInsights.summary.totalNetChange > 0 ? 'text-emerald-600' : (examInsights.summary.totalNetChange < 0 ? 'text-rose-600' : 'text-gray-700 dark:text-gray-300')}">
                            ${examInsights.summary.totalNetChange !== null ? (examInsights.summary.totalNetChange > 0 ? `+${examInsights.summary.totalNetChange}` : examInsights.summary.totalNetChange) : '—'}
                        </p>
                        ${examTrendBadge}
                    </div>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">En Güçlü Ders</p>
                    <p class="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate">${examInsights.summary.strongestSubject ? `${examInsights.summary.strongestSubject.shortName} (%${Math.round(examInsights.summary.strongestSubject.performancePercent)} · ${examInsights.summary.strongestSubject.averageNet} net)` : '—'}</p>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">En Zayıf Ders</p>
                    <p class="text-xs font-black text-rose-600 dark:text-rose-400 mt-1 truncate">${examInsights.summary.weakestSubject ? `${examInsights.summary.weakestSubject.shortName} (%${Math.round(examInsights.summary.weakestSubject.performancePercent)} · ${examInsights.summary.weakestSubject.averageNet} net)` : '—'}</p>
                </div>
                <div class="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/60 dark:border-gray-800">
                    <p class="text-[11px] font-black uppercase text-gray-400">Genel Deneme</p>
                    <p class="text-lg font-black text-gray-900 dark:text-white mt-1">${examInsights.summary.examCount} Deneme</p>
                </div>
            </div>

            <!-- Deterministik Rehberlik Yorumu (Deneme) -->
            <div class="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-3">
                <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs shrink-0 mt-0.5">
                    <i class="fas fa-bullseye"></i>
                </span>
                <div class="text-xs">
                    <p class="font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider text-[11px]">Rehberlik Değerlendirmesi & Karar Desteği</p>
                    <p class="text-gray-800 dark:text-gray-200 mt-0.5 font-medium leading-relaxed">${escapeHtml(examInsights.narrative)}</p>
                </div>
            </div>

            <!-- Toplam Net Trend Grafiği -->
            <div class="p-4 bg-white dark:bg-gray-900/70 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h4 class="font-black text-sm text-gray-900 dark:text-white">Okul Denemeleri Toplam Net Trendi</h4>
                        <p class="text-[11px] text-gray-500">LGS genel denemelerindeki toplam 90 soru üzerinden gelişim</p>
                    </div>
                    <div class="inline-flex p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold">
                        <button onclick="setGuidanceExamRange('${studentId}', 'last5')" class="px-3 py-1.5 min-h-[40px] rounded-md transition-colors ${examRange === 'last5' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}">Son 5</button>
                        <button onclick="setGuidanceExamRange('${studentId}', 'last10')" class="px-3 py-1.5 min-h-[40px] rounded-md transition-colors ${examRange === 'last10' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}">Son 10</button>
                        <button onclick="setGuidanceExamRange('${studentId}', 'all')" class="px-3 py-1.5 min-h-[40px] rounded-md transition-colors ${examRange === 'all' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}">Tümü</button>
                    </div>
                </div>
                <div class="relative w-full h-56">
                    ${examFilteredSeries.length > 0 ? `
                        <canvas id="guidanceExamTotalNetChart"></canvas>
                    ` : `
                        <div class="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center p-4">
                            <i class="fas fa-chart-line text-2xl mb-2 opacity-40"></i>
                            <p>Grafik çizimi için henüz okul denemesi (genel deneme) kaydı bulunmuyor.</p>
                        </div>
                    `}
                </div>
            </div>

            <!-- LGS 6 Ders Performans Tablosu -->
            <div class="p-4 bg-white dark:bg-gray-900/70 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-3">
                <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                    <div>
                        <h4 class="font-black text-sm text-gray-900 dark:text-white">LGS Ders Bazlı Performans Tablosu</h4>
                        <p class="text-[11px] text-gray-500">6 ana dersin son sınav ve genel ortalama analizi</p>
                    </div>
                    ${examInsights.lastExamComparison.hasComparison ? `
                        <div class="hidden sm:flex items-center gap-3 text-xs">
                            ${examInsights.lastExamComparison.biggestGain ? `<span class="text-emerald-600 font-bold"><i class="fas fa-arrow-up text-[10px]"></i> En Yüksek: ${examInsights.lastExamComparison.biggestGain.shortName} (+${examInsights.lastExamComparison.biggestGain.delta})</span>` : ''}
                            ${examInsights.lastExamComparison.biggestLoss ? `<span class="text-rose-600 font-bold"><i class="fas fa-arrow-down text-[10px]"></i> En Düşük: ${examInsights.lastExamComparison.biggestLoss.shortName} (${examInsights.lastExamComparison.biggestLoss.delta})</span>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full min-w-[620px] text-left text-xs border-collapse">
                        <thead>
                            <tr class="border-b border-gray-200 dark:border-gray-800 text-gray-400 font-bold text-xs uppercase">
                                <th class="py-2.5 px-3">Ders</th>
                                <th class="py-2.5 px-3 text-center">Soru</th>
                                <th class="py-2.5 px-3 text-center">Son Sınav (D / Y / B)</th>
                                <th class="py-2.5 px-3 text-center">Son Net</th>
                                <th class="py-2.5 px-3 text-center">Ort. Net</th>
                                <th class="py-2.5 px-3 text-center">Değişim</th>
                                <th class="py-2.5 px-3 text-center">Başarı Oranı</th>
                                <th class="py-2.5 px-3 text-right">Durum</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 dark:divide-gray-800/60 font-medium">
                            ${examInsights.subjectPerformance.map(sub => `
                                <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                <td class="py-2.5 px-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${sub.color}"></span>
                                    <span>${escapeHtml(sub.name)}</span>
                                </td>
                                <td class="py-2.5 px-3 text-center text-gray-500">${sub.questionCount}</td>
                                <td class="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">
                                    ${sub.hasData ? `
                                        <span class="text-emerald-600 font-bold">${sub.latestDogru} D</span> ·
                                        <span class="text-rose-600 font-bold">${sub.latestYanlis} Y</span> ·
                                        <span class="text-gray-400">${sub.latestBos} B</span>
                                    ` : '<span class="text-gray-400">—</span>'}
                                </td>
                                <td class="py-2.5 px-3 text-center font-black text-blue-600 dark:text-blue-400">${sub.hasData && Number.isFinite(sub.latestNet) ? sub.latestNet.toFixed(2) : '—'}</td>
                                <td class="py-2.5 px-3 text-center font-bold text-gray-800 dark:text-gray-200">${sub.hasData && sub.averageNet !== null && Number.isFinite(sub.averageNet) ? sub.averageNet.toFixed(2) : '—'}</td>
                                <td class="py-2.5 px-3 text-center">
                                    ${sub.change !== null ? `
                                        <span class="font-bold ${sub.change > 0 ? 'text-emerald-600' : (sub.change < 0 ? 'text-rose-600' : 'text-gray-500')}">
                                             ${sub.change > 0 ? `+${sub.change.toFixed(2)}` : sub.change.toFixed(2)}
                                        </span>
                                    ` : '<span class="text-gray-400">—</span>'}
                                </td>
                                <td class="py-2.5 px-3 text-center">
                                    ${sub.hasData && sub.successRate !== null ? `
                                        <div class="inline-flex items-center gap-2">
                                            <div class="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                <div class="h-full rounded-full" style="width: ${Math.max(0, Math.min(100, sub.successRate))}%; background-color: ${sub.color};"></div>
                                            </div>
                                            <span class="text-[11px] font-bold text-gray-500">%${Math.round(sub.successRate)}</span>
                                        </div>
                                    ` : '<span class="text-gray-400">—</span>'}
                                </td>
                                <td class="py-2.5 px-3 text-right">
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        sub.status === 'strong' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200' :
                                        (sub.status === 'needs_intervention' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200' :
                                        (sub.status === 'no_data' ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700' :
                                        'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200'))
                                    }">
                                        ${sub.status === 'strong' ? 'Güçlü' : (sub.status === 'needs_intervention' ? 'Müdahale' : (sub.status === 'no_data' ? 'Veri Yok' : 'Orta'))}
                                    </span>
                                </td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Ders Bazlı Net Trendi (Tek Ders Çizgi Grafiği) -->
            <div class="p-4 bg-white dark:bg-gray-900/70 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h4 class="font-black text-sm text-gray-900 dark:text-white">Ders Bazlı Net Gelişim Trendi</h4>
                        <p class="text-[11px] text-gray-500">Seçili dersin genel denemelerdeki net grafiği</p>
                    </div>
                    <!-- 6 Ders Butonları -->
                    <div class="flex items-center gap-1 flex-wrap">
                        ${LGS_SUBJECTS.map(sub => `
                            <button onclick="setGuidanceExamSubject('${studentId}', '${sub.key}')"
                                    class="px-3 py-1.5 min-h-[38px] text-xs font-bold rounded-lg border transition-colors ${
                                        selectedExamSubject === sub.key
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                                    }">
                                ${sub.shortName}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="relative w-full h-56">
                    ${(examInsights.subjectTrendSeries[selectedExamSubject] || []).length > 0 ? `
                        <canvas id="guidanceExamSubjectChart"></canvas>
                    ` : `
                        <div class="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center p-4">
                            <i class="fas fa-chart-line text-2xl mb-2 opacity-40"></i>
                            <p>Seçili ders için henüz genel deneme kaydı bulunmuyor.</p>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;

    const performanceCenterHtml = `
        <section class="app-panel p-5 mt-4 space-y-4" id="guidance-performance-center">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm">
                        <i class="fas fa-chart-line"></i>
                    </span>
                    <div>
                        <h3 class="font-black text-base text-gray-900 dark:text-white">Performans Merkezi</h3>
                        <p class="text-xs text-gray-500">Ödev ve okul denemeleri analitik karar desteği</p>
                    </div>
                </div>

                <!-- 2 Sekmeli Tab Butonları -->
                <div class="inline-flex p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl border border-gray-200/60 dark:border-gray-700/60 text-xs font-bold">
                    <button onclick="switchGuidancePerformanceTab('${studentId}', 'homework')"
                            class="min-h-[44px] px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${perfTab === 'homework' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}">
                        <i class="fas fa-book-open"></i>
                        <span>Ödev Performansı</span>
                    </button>
                    <button onclick="switchGuidancePerformanceTab('${studentId}', 'exams')"
                            class="min-h-[44px] px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${perfTab === 'exams' ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm font-black' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}">
                        <i class="fas fa-graduation-cap"></i>
                        <span>Okul Denemeleri</span>
                    </button>
                </div>
            </div>

            <!-- Tab İçeriği -->
            ${perfTab === 'homework' ? homeworkTabHtml : examsTabHtml}
        </section>
    `;

    const studentTab = window._guidanceStudentTab || 'overview';

    const detailTabs = [
        ['overview', 'fa-id-card', 'Genel Bakış'],
        ['performance', 'fa-chart-line', 'Performans'],
        ['interventions', 'fa-clipboard-list', 'Müdahaleler', detail.openGuidanceRecordsCount || 0],
        ['study', 'fa-compass', 'Çalışma Planı'],
        ['report', 'fa-file-pdf', 'Rapor']
    ];

    const studentTabsHtml = `
        <nav class="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 mt-4 mb-4 overflow-x-auto" aria-label="Öğrenci Rehberlik Sekmeleri">
            ${detailTabs.map(([key, icon, label, badgeCount]) => {
                const isActive = studentTab === key;
                return `
                    <button onclick="switchGuidanceStudentTab('${studentId}', '${key}')"
                            class="py-2.5 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition min-h-[44px] whitespace-nowrap ${isActive ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-black' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}">
                        <i class="fas ${icon} text-xs"></i>
                        <span>${label}</span>
                        ${badgeCount > 0 ? `
                            <span class="px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}">
                                ${badgeCount}
                            </span>
                        ` : ''}
                    </button>
                `;
            }).join('')}
        </nav>
    `;

    let tabBodyHtml = '';

    if (studentTab === 'overview') {
        tabBodyHtml = `
            <!-- ==================== GENEL BAKIŞ ==================== -->
            <div class="space-y-4">
                <!-- Akademik Durum Özeti Box -->
                <section class="app-panel p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50">
                    <div class="flex items-start gap-2.5">
                        <span class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs shrink-0 mt-0.5">
                            <i class="fas fa-chart-pie"></i>
                        </span>
                        <div>
                            <p class="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Akademik Durum Özeti</p>
                            <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1 leading-relaxed">
                                ${escapeHtml(detail.mainProblemSummary)}
                            </p>
                        </div>
                    </div>
                </section>

                <!-- 4 Kompakt Üst Metrik -->
                <section class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    ${topMetrics.map(([icon, label, value, detailText]) => `
                        <article class="app-panel p-4">
                            <div class="flex items-center gap-2 text-gray-400">
                                <i class="fas ${icon} text-xs"></i>
                                <p class="text-[11px] font-black uppercase tracking-[.08em]">${label}</p>
                            </div>
                            <p class="mt-3 text-2xl font-black text-slate-900 dark:text-white">${value}</p>
                            <p class="mt-1 text-xs text-gray-500 truncate">${detailText}</p>
                        </article>
                    `).join('')}
                </section>

                <!-- 3 Sütunlu Hızlı Durum ve Yönlendirme Kartları -->
                <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- Kart 1: Akademik & Performans Özeti -->
                    <article class="app-panel p-5 flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">
                                        <i class="fas fa-chart-line"></i>
                                    </span>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white">Akademik Performans</h3>
                                </div>
                                ${detail.examTrend ? `
                                    <span class="px-2 py-0.5 rounded-full text-xs font-black border ${detail.examTrend.trend === 'improving' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (detail.examTrend.trend === 'declining' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-gray-200')}">
                                        ${escapeHtml(detail.examTrend.label)}
                                    </span>
                                ` : ''}
                            </div>
                            <div class="space-y-2 text-xs">
                                <div class="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                                    <span class="text-gray-500">Son Deneme:</span>
                                    <span class="font-bold text-gray-900 dark:text-white">${detail.recentExams.length ? `${escapeHtml(detail.recentExams[0].name)} (${detail.recentExams[0].net.toFixed(2)} Net)` : '—'}</span>
                                </div>
                                <div class="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                                    <span class="text-gray-500">Ödev Disiplini:</span>
                                    <span class="font-bold text-gray-900 dark:text-white">${detail.discipline ? `%${detail.discipline.completionRate} (${detail.discipline.completed}/${detail.discipline.total})` : '—'}</span>
                                </div>
                                <div class="flex justify-between py-1">
                                    <span class="text-gray-500">Baskın Hata:</span>
                                    <span class="font-bold text-gray-900 dark:text-white">${detail.dominantError ? escapeHtml(detail.dominantError.label) : '—'}</span>
                                </div>
                            </div>
                        </div>
                        <button onclick="switchGuidanceStudentTab('${studentId}', 'performance')" class="cf-btn-primary w-full py-2.5 px-3 text-xs font-bold min-h-[44px] flex items-center justify-center gap-1.5 mt-4">
                            <i class="fas fa-chart-line"></i> Performansı Gör
                        </button>
                    </article>

                    <!-- Kart 2: Müdahale & Takip Durumu -->
                    <article class="app-panel p-5 flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs">
                                        <i class="fas fa-clipboard-list"></i>
                                    </span>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white">Rehberlik & Takip</h3>
                                </div>
                                ${detail.dueGuidanceRecordsCount > 0 ? `
                                    <span class="px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                                        ${detail.dueGuidanceRecordsCount} Takipte
                                    </span>
                                ` : ''}
                            </div>
                            <div class="space-y-2 text-xs">
                                <div class="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                                    <span class="text-gray-500">Açık Kayıtlar:</span>
                                    <span class="font-bold text-gray-900 dark:text-white">${detail.openGuidanceRecordsCount || 0} adet</span>
                                </div>
                                <div class="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                                    <span class="text-gray-500">Takip Durumu:</span>
                                    <span class="font-bold ${detail.dueGuidanceRecordsCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}">${detail.dueGuidanceRecordsCount > 0 ? 'Geciken / Bekleyen Takip Var' : 'Takipler Güncel'}</span>
                                </div>
                                <div class="py-1">
                                    <span class="text-gray-500 block mb-0.5">Son Müdahale:</span>
                                    <p class="font-semibold text-gray-800 dark:text-gray-200 truncate">${guidanceRecords.length ? escapeHtml(guidanceRecords[0].action || guidanceRecords[0].issue) : 'Kayıt bulunmuyor'}</p>
                                </div>
                            </div>
                        </div>
                        <button onclick="switchGuidanceStudentTab('${studentId}', 'interventions')" class="btn-secondary w-full py-2.5 px-3 text-xs font-bold min-h-[44px] flex items-center justify-center gap-1.5 mt-4">
                            <i class="fas fa-clipboard-list"></i> Müdahaleleri Gör
                        </button>
                    </article>

                    <!-- Kart 3: Çalışma Planı & Gelişim -->
                    <article class="app-panel p-5 flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                                        <i class="fas fa-compass"></i>
                                    </span>
                                    <h3 class="font-black text-base text-gray-900 dark:text-white">Çalışma Planı</h3>
                                </div>
                                ${impact.status === 'measured' ? `
                                    <span class="px-2.5 py-1 rounded-full text-xs font-black border ${impactBadgeStyles[impact.impactStatus] || impactBadgeStyles.neutral}">
                                        ${escapeHtml(impact.impactLabel)}
                                    </span>
                                ` : ''}
                            </div>
                            <div class="space-y-2 text-xs">
                                <div class="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                                    <span class="text-gray-500">Plan Durumu:</span>
                                    <span class="font-bold text-gray-900 dark:text-white">${detail.activePlan ? `${escapeHtml(detail.activePlan.subject)} (Aktif)` : (impact.status === 'measured' ? 'Ölçüldü' : 'Plan Yok')}</span>
                                </div>
                                <div class="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                                    <span class="text-gray-500">Son Net Etkisi:</span>
                                    <span class="font-bold ${impact.status === 'measured' ? (impact.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : 'text-gray-500'}">${impact.status === 'measured' ? `${impact.delta >= 0 ? `+${impact.delta.toFixed(2)}` : impact.delta.toFixed(2)} Net` : '—'}</span>
                                </div>
                                <div class="flex justify-between py-1">
                                    <span class="text-gray-500">Son Birebir Ders:</span>
                                    <span class="font-bold text-gray-900 dark:text-white truncate">${detail.recentLessons.length ? escapeHtml(detail.recentLessons[0].konu) : '—'}</span>
                                </div>
                            </div>
                        </div>
                        <button onclick="switchGuidanceStudentTab('${studentId}', 'study')" class="btn-secondary w-full py-2.5 px-3 text-xs font-bold min-h-[44px] flex items-center justify-center gap-1.5 mt-4">
                            <i class="fas fa-compass"></i> Çalışma Planını Aç
                        </button>
                    </article>
                </section>

                <!-- Önerilen İlk Müdahale Eylem Planı (Karar Destek) -->
                <article class="app-panel p-5 space-y-3 bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-200/60 dark:border-indigo-900/50">
                    <div class="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/60 pb-3">
                        <div class="flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">
                                <i class="fas fa-lightbulb"></i>
                            </span>
                            <div>
                                <p class="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Karar Destek</p>
                                <h3 class="font-black text-base text-gray-900 dark:text-white">Önerilen Müdahale</h3>
                            </div>
                        </div>
                        <span class="text-xs font-black text-indigo-700 dark:text-indigo-300">
                            ${escapeHtml(detail.recommendation.title)}
                        </span>
                    </div>
                    <p class="text-xs font-bold text-gray-800 dark:text-gray-200 leading-relaxed">
                        ${escapeHtml(detail.recommendation.action)}
                    </p>
                    <div class="flex items-center gap-2 pt-2">
                        <button onclick="showGuidanceRecordModal('${studentId}')" class="btn-primary py-2 px-4 text-xs font-bold min-h-[44px] inline-flex items-center gap-1.5">
                            <i class="fas fa-clipboard-list"></i> Rehberlik Kaydı Ekle
                        </button>
                        <button onclick="showStudyPlanSetup('${studentId}')" class="btn-secondary py-2 px-4 text-xs font-bold min-h-[44px] inline-flex items-center gap-1.5">
                            <i class="fas fa-compass"></i> Çalışma Planı Oluştur
                        </button>
                    </div>
                </article>
            </div>
        `;
    } else if (studentTab === 'performance') {
        tabBodyHtml = `
            <!-- ==================== PERFORMANS ==================== -->
            <div class="space-y-4">
                <!-- Performans Merkezi (Ödev & Okul Denemeleri) -->
                ${performanceCenterHtml}
            </div>
        `;
    } else if (studentTab === 'interventions') {
        tabBodyHtml = `
            <!-- ==================== MÜDAHALELER ==================== -->
            <div class="space-y-4">
                <section class="grid gap-4 lg:grid-cols-3">
                    <!-- Sol 2 Kolon: Rehberlik Günlüğü ve Müdahale Kayıtları -->
                    <div class="lg:col-span-2 space-y-4">
                        <article class="app-panel p-5 space-y-3.5">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-black text-base text-gray-900 dark:text-white">Rehberlik & Müdahale Kayıtları</h3>
                                        ${detail.dueGuidanceRecordsCount > 0 ? `
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                                                ${detail.dueGuidanceRecordsCount} Takip Bekliyor
                                            </span>
                                        ` : ''}
                                    </div>
                                    <p class="text-xs text-gray-500 mt-0.5">Öğretmen gözlem, müdahale ve takip geçmişi</p>
                                </div>
                                <button onclick="showGuidanceRecordModal('${studentId}')" class="btn-primary px-3.5 py-2 text-xs font-bold min-h-[44px] flex items-center gap-1.5">
                                    <i class="fas fa-plus"></i> Kayıt Ekle
                                </button>
                            </div>
                            <div class="space-y-3">
                                ${guidanceRecordsHtml}
                            </div>
                        </article>
                    </div>

                    <!-- Sağ 1 Kolon: Önerilen Müdahale + Zaman Çizelgesi -->
                    <div class="space-y-4">
                        <article class="app-panel p-5 space-y-3 bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-200/60 dark:border-indigo-900/50">
                            <div class="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/60 pb-3">
                                <div class="flex items-center gap-2">
                                    <span class="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">
                                        <i class="fas fa-lightbulb"></i>
                                    </span>
                                    <h3 class="font-black text-sm text-gray-900 dark:text-white">Önerilen Müdahale</h3>
                                </div>
                            </div>
                            <div class="space-y-2 text-xs">
                                <span class="font-black text-indigo-700 dark:text-indigo-300 block">
                                    ${escapeHtml(detail.recommendation.title)}
                                </span>
                                <p class="font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                                    ${escapeHtml(detail.recommendation.action)}
                                </p>
                            </div>
                        </article>

                        <article class="app-panel p-5 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <h3 class="font-black text-base text-gray-900 dark:text-white">Öğrenci Zaman Çizelgesi</h3>
                                <span class="text-xs font-bold text-gray-400">${detail.timeline.length} hareket</span>
                            </div>
                            <div class="pt-1">
                                ${timelineHtml}
                            </div>
                        </article>
                    </div>
                </section>
            </div>
        `;
    } else if (studentTab === 'study') {
        const planProfile = student.studyPlanProfile || null;
        const rawStudyPlan = student.studyPlan || {};
        const CANONICAL_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
        const studyStageNames = { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' };
        const studyIntensityNames = { light: 'Hafif', balanced: 'Dengeli', intensive: 'Yoğun' };

        const getStudyTasksForDay = (dayName) => {
            if (!rawStudyPlan || typeof rawStudyPlan !== 'object') return [];
            if (Array.isArray(rawStudyPlan[dayName])) return rawStudyPlan[dayName];
            const matchKey = Object.keys(rawStudyPlan).find(k => k.toLowerCase() === dayName.toLowerCase());
            if (matchKey && Array.isArray(rawStudyPlan[matchKey])) return rawStudyPlan[matchKey];
            return [];
        };

        const totalStudyTasksCount = CANONICAL_DAYS.reduce((sum, day) => sum + getStudyTasksForDay(day).length, 0);
        const hasPlanProfile = Boolean(planProfile || detail.activePlan);
        const hasAnyStudyPlan = hasPlanProfile || totalStudyTasksCount > 0;

        let studyPlanMainContentHtml = '';

        if (!hasAnyStudyPlan) {
            studyPlanMainContentHtml = `
                <article class="app-panel p-8 text-center space-y-4">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center text-xl">
                        <i class="fas fa-compass"></i>
                    </div>
                    <div class="max-w-md mx-auto space-y-1">
                        <h4 class="font-black text-base text-gray-900 dark:text-white">Henüz çalışma planı oluşturulmamış.</h4>
                        <p class="text-xs text-gray-500">Öğrenciye özel seviye, teknik ve gün seçimleriyle akıllı haftalık çalışma programı hazırlayabilirsiniz.</p>
                    </div>
                    <div>
                        <button onclick="showStudyPlanSetup('${studentId}')" class="btn-primary min-h-[44px] px-5 text-xs font-bold inline-flex items-center gap-2">
                            <i class="fas fa-magic"></i> Çalışma Planı Oluştur
                        </button>
                    </div>
                </article>
            `;
        } else {
            const planSubject = planProfile?.subject || detail.activePlan?.subject || 'Genel Program';
            const planBadge = planProfile?.badge || detail.activePlan?.badge || 'Çalışma Planı';
            const planStage = studyStageNames[planProfile?.stage || detail.activePlan?.stage] || 'Başlangıç';
            const planIntensity = studyIntensityNames[planProfile?.intensity] || 'Dengeli';
            const planDuration = planProfile?.durationWeeks || detail.activePlan?.durationWeeks || 1;
            const planMinutes = planProfile?.dailyMinutes || 30;
            const planDate = planProfile?.generatedAt ? formatActivityDate(planProfile.generatedAt) : 'Mevcut';
            const planStatusText = detail.interventionImpact?.status === 'measured' ? detail.interventionImpact.impactLabel : 'Aktif Program';

            const activePlanSummaryCardHtml = `
                <article class="app-panel p-5 space-y-4 bg-gradient-to-br from-white to-gray-50/60 dark:from-gray-900 dark:to-gray-900/40">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                        <div class="flex items-center gap-3">
                            <span class="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg shrink-0">
                                🏅
                            </span>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h3 class="font-black text-base text-gray-900 dark:text-white">${escapeHtml(planBadge)}</h3>
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/80">
                                        ${escapeHtml(planStatusText)}
                                    </span>
                                </div>
                                <p class="text-xs text-gray-500 mt-0.5">${escapeHtml(planSubject)} · ${planDuration} haftalık program</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <button onclick="exportStudyPlanToPdf('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" title="Haftalık Programı PDF Olarak İndir">
                                <i class="fas fa-file-pdf text-emerald-600"></i>
                                <span>PDF</span>
                            </button>
                            <button onclick="showStudyPlanSetup('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-bold flex items-center gap-1.5" title="Program Ölçütlerini Yeniden Düzenle">
                                <i class="fas fa-edit"></i>
                                <span>Düzenle</span>
                            </button>
                        </div>
                    </div>

                    <!-- Parametre Rozetleri -->
                    <div class="flex flex-wrap gap-2 text-xs">
                        <span class="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 font-bold text-gray-700 dark:text-gray-300">
                            Aşama: <strong class="text-gray-900 dark:text-white">${planStage}</strong>
                        </span>
                        <span class="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 font-bold text-gray-700 dark:text-gray-300">
                            Yoğunluk: <strong class="text-gray-900 dark:text-white">${planIntensity}</strong>
                        </span>
                        <span class="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 font-bold text-gray-700 dark:text-gray-300">
                            Günlük: <strong class="text-gray-900 dark:text-white">${planMinutes} dk</strong>
                        </span>
                        ${planDate ? `
                            <span class="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 font-bold text-gray-700 dark:text-gray-300">
                                Tarih: <strong class="text-gray-900 dark:text-white">${escapeHtml(planDate)}</strong>
                            </span>
                        ` : ''}
                    </div>
                </article>
            `;

            let weeklyDaysContentHtml = '';

            if (totalStudyTasksCount === 0) {
                weeklyDaysContentHtml = `
                    <div class="p-6 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50 text-center space-y-2">
                        <p class="text-sm font-bold text-amber-800 dark:text-amber-300"><i class="fas fa-info-circle mr-1.5"></i> Aktif plan profili mevcut ancak haftalık görev eklenmemiş.</p>
                        <p class="text-xs text-gray-500">Program sihirbazını kullanarak günlere otomatik görev atayabilir veya düzenleyebilirsiniz.</p>
                        <button onclick="showStudyPlanSetup('${studentId}')" class="btn-secondary min-h-[44px] px-4 text-xs font-bold mt-2 inline-flex items-center gap-1.5">
                            <i class="fas fa-compass"></i> Programı Yapılandır
                        </button>
                    </div>
                `;
            } else {
                const daysGridHtml = CANONICAL_DAYS.map(day => {
                    const dayTasks = getStudyTasksForDay(day);
                    return `
                        <article class="p-3.5 bg-white dark:bg-gray-900/70 rounded-xl border border-gray-200/70 dark:border-gray-800 space-y-2.5 flex flex-col justify-between">
                            <div class="space-y-2.5">
                                <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                                    <div class="flex items-center gap-1.5">
                                        <i class="far fa-calendar-check text-xs text-indigo-600 dark:text-indigo-400"></i>
                                        <h4 class="font-black text-sm text-gray-900 dark:text-white">${day}</h4>
                                    </div>
                                    ${dayTasks.length > 0 ? `
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/80">
                                            ${dayTasks.length} görev
                                        </span>
                                    ` : `
                                        <span class="text-[10px] text-gray-400 font-semibold">Boş</span>
                                    `}
                                </div>
                                <div class="space-y-2">
                                    ${dayTasks.length === 0 ? `
                                        <p class="text-xs text-gray-400 italic py-3 text-center">Bu gün için görev planlanmamış.</p>
                                    ` : dayTasks.map(task => {
                                        if (typeof task === 'string') {
                                            const parts = task.split('·').map(p => p.trim());
                                            const mainTitle = parts[0];
                                            const tags = parts.slice(1);
                                            return `
                                                <div class="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200/70 dark:border-gray-800 text-xs space-y-1.5">
                                                    <p class="font-bold text-gray-800 dark:text-gray-200 leading-snug">${escapeHtml(mainTitle)}</p>
                                                    ${tags.length ? `
                                                        <div class="flex flex-wrap gap-1.5 pt-0.5 text-[10px]">
                                                            ${tags.map(tag => `
                                                                <span class="px-2 py-0.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold">
                                                                    ${escapeHtml(tag)}
                                                                </span>
                                                            `).join('')}
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            `;
                                        } else if (typeof task === 'object' && task !== null) {
                                            const title = task.title || task.konu || task.name || task.text || 'Çalışma Görevi';
                                            const desc = task.description || task.aciklama || task.detail || '';
                                            const question = task.questionTarget || task.questionCount || task.soru || null;
                                            const duration = task.duration || task.durationMinutes || task.sure || null;
                                            const resource = task.resource || task.kaynak || null;
                                            const isDone = Boolean(task.completed || task.tamamlandi);
                                            return `
                                                <div class="p-2.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200/70 dark:border-gray-800 text-xs space-y-1.5">
                                                    <div class="flex items-start justify-between gap-1.5">
                                                        <p class="font-bold text-gray-800 dark:text-gray-200 leading-snug ${isDone ? 'line-through opacity-70' : ''}">${escapeHtml(title)}</p>
                                                        ${isDone ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 shrink-0">Tamamlandı</span>' : ''}
                                                    </div>
                                                    ${desc ? `<p class="text-[11px] text-gray-500">${escapeHtml(desc)}</p>` : ''}
                                                    <div class="flex flex-wrap gap-1.5 pt-0.5 text-[10px] text-gray-500 font-semibold">
                                                        ${question ? `<span class="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">${question} soru</span>` : ''}
                                                        ${duration ? `<span class="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">${duration} dk</span>` : ''}
                                                        ${resource ? `<span class="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 truncate max-w-[120px]">${escapeHtml(resource)}</span>` : ''}
                                                    </div>
                                                </div>
                                            `;
                                        }
                                        return '';
                                    }).join('')}
                                </div>
                            </div>
                        </article>
                    `;
                }).join('');

                weeklyDaysContentHtml = `
                    <section class="space-y-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <h3 class="font-black text-base text-gray-900 dark:text-white">Haftalık Çalışma Programı</h3>
                                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                    ${totalStudyTasksCount} görev
                                </span>
                            </div>
                            <span class="text-xs text-gray-400 font-medium">Pazartesi – Pazar</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                            ${daysGridHtml}
                        </div>
                    </section>
                `;
            }

            studyPlanMainContentHtml = `
                <div class="space-y-4">
                    ${activePlanSummaryCardHtml}
                    ${weeklyDaysContentHtml}
                </div>
            `;
        }

        tabBodyHtml = `
            <!-- ==================== ÇALIŞMA PLANI ==================== -->
            <div class="space-y-4">
                <!-- Aktif Plan Özeti ve Haftalık Program -->
                ${studyPlanMainContentHtml}

                <!-- Alt Bölüm: Etki Analizi & Birebir Dersler / Kokpit -->
                <section class="grid gap-4 lg:grid-cols-2 mt-4">
                    <article class="app-panel p-5 space-y-3">
                        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                            <div>
                                <h3 class="font-black text-base text-gray-900 dark:text-white">Çalışma Planı Etki Analizi</h3>
                                <p class="text-xs text-gray-500 mt-0.5">Çalışma programı sonrası ölçülen net değişimi</p>
                            </div>
                            <button onclick="showStudyPlanSetup('${studentId}')" class="btn-primary px-3.5 py-2 text-xs font-bold min-h-[44px] flex items-center gap-1.5">
                                <i class="fas fa-compass"></i> Plan Oluştur
                            </button>
                        </div>
                        <div>
                            ${impactSectionHtml}
                        </div>
                    </article>

                    <div class="space-y-4">
                        <article class="app-panel p-5 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <h3 class="font-black text-base text-gray-900 dark:text-white">İlgili Birebir Dersler</h3>
                                <span class="text-xs font-bold text-gray-400">${detail.recentLessons.length} ders</span>
                            </div>
                            <div class="space-y-2">
                                ${recentLessonsHtml}
                            </div>
                        </article>

                        <article class="app-panel p-5 space-y-3">
                            <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                                <h3 class="font-black text-base text-gray-900 dark:text-white">Detaylı Öğrenci Kokpiti</h3>
                                <i class="fas fa-chart-line text-blue-600 dark:text-blue-400"></i>
                            </div>
                            <p class="text-xs text-gray-500 leading-relaxed">Haftalık soru hedefleri, deneme grafikleri ve tüm öğrenci görevlerini yönetmek için kokpite geçebilirsiniz.</p>
                            <button onclick="openStudentCockpitDirect('${studentId}')" class="btn-secondary w-full py-2.5 px-3 text-xs font-bold min-h-[44px] flex items-center justify-center gap-1.5">
                                <i class="fas fa-chart-line mr-1"></i> Öğrenci Kokpitini Aç
                            </button>
                        </article>
                    </div>
                </section>
            </div>
        `;
    } else if (studentTab === 'report') {
        tabBodyHtml = `
            <!-- ==================== RAPOR ==================== -->
            <div class="space-y-4">
                <section class="app-panel p-6 space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                        <div class="flex items-center gap-3">
                            <span class="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center text-lg shrink-0">
                                <i class="fas fa-file-pdf"></i>
                            </span>
                            <div>
                                <h3 class="font-black text-lg text-gray-900 dark:text-white">Rehberlik Gelişim Raporu</h3>
                                <p class="text-xs text-gray-500">Veli görüşmeleri ve dönem sonu değerlendirmeleri için profesyonel PDF dokümanı</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <button onclick="openGuidanceReportModal('${studentId}')" class="btn-primary min-h-[44px] px-4 text-xs font-bold flex items-center gap-1.5">
                                <i class="fas fa-sliders mr-1"></i> Raporu Önizle & Yapılandır
                            </button>
                            <button onclick="downloadGuidanceReportPdf('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-bold flex items-center gap-1.5">
                                <i class="fas fa-download mr-1"></i> Hızlı İndir
                            </button>
                            <button onclick="printGuidanceReportPdf('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-bold flex items-center gap-1.5">
                                <i class="fas fa-print mr-1"></i> Yazdır
                            </button>
                            <button onclick="shareGuidanceReportPdf('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-bold flex items-center gap-1.5">
                                <i class="fas fa-share-nodes mr-1"></i> Paylaş
                            </button>
                        </div>
                    </div>

                    <!-- Raporda Yer Alan Alanlar -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                        <div class="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                            <div class="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                                <i class="fas fa-id-badge"></i>
                                <span>Öğrenci Profili</span>
                            </div>
                            <p class="text-[11px] text-gray-500">Sınıf, hedef okul, net hedefleri ve güncel durum özeti.</p>
                        </div>
                        <div class="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                            <div class="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                                <i class="fas fa-chart-line"></i>
                                <span>Akademik Gelişim</span>
                            </div>
                            <p class="text-[11px] text-gray-500">LGS okul denemeleri, net trendi, güçlü ve gelişime açık dersler.</p>
                        </div>
                        <div class="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                            <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                                <i class="fas fa-list-check"></i>
                                <span>Ödev Disiplini & Hatalar</span>
                            </div>
                            <p class="text-[11px] text-gray-500">Ödev tamamlama oranı, tekrarlayan zayıf konular ve hata nedenleri.</p>
                        </div>
                        <div class="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                            <div class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                <i class="fas fa-clipboard-check"></i>
                                <span>Müdahale & Öğretmen Notu</span>
                            </div>
                            <p class="text-[11px] text-gray-500">Uygulanan rehberlik aksiyonları, takip sonuçları ve veli tavsiyesi.</p>
                        </div>
                    </div>
                </section>
            </div>
        `;
    }

    document.getElementById('dynamic-content').innerHTML = `
        <div class="app-page pb-28 sm:pb-8">
            <!-- Breadcrumb -->
            <nav class="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2" aria-label="Breadcrumb">
                <button onclick="renderGuidancePage()" class="hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1">
                    <i class="fas fa-compass"></i> Rehberlik
                </button>
                <span><i class="fas fa-chevron-right text-[10px] text-gray-400"></i></span>
                <span class="text-gray-900 dark:text-white font-bold">${escapeHtml(detail.studentName)}</span>
            </nav>

            <!-- Header -->
            <header class="app-page-header">
                <div class="flex items-start justify-between gap-4 flex-wrap w-full">
                    <div class="flex items-center gap-3">
                        <button onclick="renderGuidancePage()" class="btn-secondary min-h-[44px] px-3" aria-label="Rehberlik Merkezine dön">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-base text-slate-800 dark:text-slate-100 shrink-0">
                            ${escapeHtml(detail.initials)}
                        </div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h2 class="app-page-title text-xl">${escapeHtml(detail.studentName)}</h2>
                                <span class="px-2.5 py-0.5 rounded-full text-xs font-black border ${priorityBadgeStyles[detail.priority]}">
                                    ${escapeHtml(detail.priorityLabel)} Öncelik
                                </span>
                            </div>
                            <p class="app-page-subtitle mt-0.5">${escapeHtml(detail.sinif ? `${detail.sinif}. Sınıf` : 'Sınıf yok')}${detail.okul ? ` · ${escapeHtml(detail.okul)}` : ''}${detail.hedefLise ? ` · Hedef: ${escapeHtml(detail.hedefLise)}` : ''}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <button onclick="showGuidanceRecordModal('${studentId}')" class="btn-primary min-h-[44px] px-4 text-xs font-bold flex items-center gap-1.5">
                            <i class="fas fa-clipboard-list"></i> Rehberlik Kaydı Ekle
                        </button>
                        <button onclick="showStudyPlanSetup('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-semibold flex items-center gap-1.5">
                            <i class="fas fa-compass"></i> Çalışma Planı Oluştur
                        </button>
                        <button onclick="openCockpitHomework('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-semibold">
                            <i class="fas fa-plus mr-1"></i> Ödev Ata
                        </button>
                        <button onclick="openGuidanceReportModal('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800" title="Öğrenci Rehberlik Gelişim Raporu (PDF)">
                            <i class="fas fa-file-pdf text-red-500"></i> Rehberlik Raporu
                        </button>
                        <button onclick="openStudentCockpitDirect('${studentId}')" class="btn-secondary min-h-[44px] px-3.5 text-xs font-semibold" title="Öğrenci Kokpiti">
                            <i class="fas fa-chart-line mr-1"></i> Kokpiti Aç
                        </button>
                    </div>
                </div>
            </header>

            <!-- 5 Öğrenci Detay Üst Sekmesi -->
            ${studentTabsHtml}

            <!-- Aktif Sekme İçeriği -->
            ${tabBodyHtml}
        </div>
    `;

    if (studentTab === 'performance') {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                renderGuidancePerformanceCharts(studentId, perfTab, hwFilteredSeries, examFilteredSeries, examInsights, selectedExamSubject);
            });
        } else {
            setTimeout(() => {
                renderGuidancePerformanceCharts(studentId, perfTab, hwFilteredSeries, examFilteredSeries, examInsights, selectedExamSubject);
            }, 0);
        }
    }
}

// ==================== PERFORMANS MERKEZİ CHART & TAB HELPERS ====================

export function renderGuidancePerformanceCharts(studentId, perfTab, hwFilteredSeries, examFilteredSeries, examInsights, selectedExamSubject) {
    if (typeof window === 'undefined') return;
    const ChartClass = window.Chart || (typeof Chart !== 'undefined' ? Chart : null);
    if (!ChartClass) return;

    if (perfTab === 'homework') {
        const hwCanvas = document.getElementById('guidanceHomeworkNetChart');
        if (hwCanvas && hwFilteredSeries && hwFilteredSeries.length > 0) {
            if (window._guidanceHwChartInstance) {
                window._guidanceHwChartInstance.destroy();
                window._guidanceHwChartInstance = null;
            }
            const ctx = hwCanvas.getContext('2d');
            window._guidanceHwChartInstance = new ChartClass(ctx, {
                type: 'line',
                data: {
                    labels: hwFilteredSeries.map(r => r.formattedDate || r.date || r.title),
                    datasets: [{
                        label: 'Ödev Neti',
                        data: hwFilteredSeries.map(r => r.net),
                        borderColor: '#4F46E5',
                        backgroundColor: 'rgba(79, 70, 229, 0.08)',
                        borderWidth: 2.5,
                        tension: 0.3,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#4F46E5'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const item = hwFilteredSeries[context.dataIndex];
                                    return `Net: ${item.net.toFixed(2)} (D: ${item.correct}, Y: ${item.wrong})`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(156, 163, 175, 0.15)' }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });
        }
    } else if (perfTab === 'exams') {
        const examCanvas = document.getElementById('guidanceExamTotalNetChart');
        if (examCanvas && examFilteredSeries && examFilteredSeries.length > 0) {
            if (window._guidanceExamChartInstance) {
                window._guidanceExamChartInstance.destroy();
                window._guidanceExamChartInstance = null;
            }
            const ctx = examCanvas.getContext('2d');
            window._guidanceExamChartInstance = new ChartClass(ctx, {
                type: 'line',
                data: {
                    labels: examFilteredSeries.map(e => e.name || e.formattedDate),
                    datasets: [{
                        label: 'Toplam Net',
                        data: examFilteredSeries.map(e => e.totalNet),
                        borderColor: '#4F46E5',
                        backgroundColor: 'rgba(79, 70, 229, 0.08)',
                        borderWidth: 2.5,
                        tension: 0.3,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#4F46E5'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const item = examFilteredSeries[context.dataIndex];
                                    return `Toplam Net: ${item.totalNet.toFixed(2)} (D: ${item.totalDogru}, Y: ${item.totalYanlis}, B: ${item.totalBos})`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(156, 163, 175, 0.15)' }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        const subjectCanvas = document.getElementById('guidanceExamSubjectChart');
        const subjectSeries = examInsights?.subjectTrendSeries?.[selectedExamSubject] || [];
        if (subjectCanvas && subjectSeries.length > 0) {
            if (window._guidanceExamSubjectChartInstance) {
                window._guidanceExamSubjectChartInstance.destroy();
                window._guidanceExamSubjectChartInstance = null;
            }
            const subMeta = LGS_SUBJECTS.find(s => s.key === selectedExamSubject) || { color: '#4F46E5', name: selectedExamSubject };
            const ctx = subjectCanvas.getContext('2d');
            window._guidanceExamSubjectChartInstance = new ChartClass(ctx, {
                type: 'line',
                data: {
                    labels: subjectSeries.map(e => e.examName || e.formattedDate),
                    datasets: [{
                        label: `${subMeta.name} Neti`,
                        data: subjectSeries.map(e => e.net),
                        borderColor: subMeta.color || '#4F46E5',
                        backgroundColor: `${subMeta.color || '#4F46E5'}1A`,
                        borderWidth: 2.5,
                        tension: 0.3,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: subMeta.color || '#4F46E5'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const item = subjectSeries[context.dataIndex];
                                    return `${subMeta.name}: ${item.net.toFixed(2)} net (D: ${item.dogru}, Y: ${item.yanlis}, B: ${item.bos})`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(156, 163, 175, 0.15)' }
                        },
                        x: {
                            grid: { display: false }
                        }
                    }
                }
            });
        }
    }
}

export function switchGuidanceStudentTab(studentId, tabKey) {
    window._guidanceStudentTab = tabKey || 'overview';
    renderGuidanceStudentDetail(studentId);
}

export function switchGuidancePerformanceTab(studentId, tab) {
    window._guidanceStudentTab = 'performance';
    window._guidancePerformanceTab = tab;
    renderGuidanceStudentDetail(studentId);
}

export function setGuidanceHomeworkRange(studentId, range) {
    window._guidanceStudentTab = 'performance';
    window._guidanceHwRange = range;
    renderGuidanceStudentDetail(studentId);
}

export function setGuidanceExamRange(studentId, range) {
    window._guidanceStudentTab = 'performance';
    window._guidanceExamRange = range;
    renderGuidanceStudentDetail(studentId);
}

export function setGuidanceExamSubject(studentId, subjectKey) {
    window._guidanceStudentTab = 'performance';
    window._guidanceExamSelectedSubject = subjectKey;
    renderGuidanceStudentDetail(studentId);
}


// ==================== GUIDANCE RECORDS MODAL DIALOGS ====================

/**
 * Shows the Create / Edit Guidance Record modal dialog with prefill support.
 */
export function showGuidanceRecordModal(studentId, recordId = null) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    let initialData = {
        type: 'academic',
        issue: '',
        action: '',
        followUpDate: '',
        note: ''
    };

    if (recordId) {
        const records = getStudentGuidanceRecords(student);
        const record = records.find(r => r.id === recordId);
        if (record) {
            initialData = {
                type: record.type || 'academic',
                issue: record.issue || '',
                action: record.action || '',
                followUpDate: record.followUpDate || '',
                note: record.note || ''
            };
        }
    } else {
        const homeworks = getStudentOdevler(student);
        const prefill = buildSuggestedPrefill(student, homeworks);
        initialData = {
            ...initialData,
            ...prefill
        };
    }

    const modalId = 'guidanceRecordModal';
    document.getElementById(modalId)?.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'app-modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
        <div class="app-modal max-w-lg w-full" onclick="event.stopPropagation()">
            <div class="app-modal-header">
                <div>
                    <h2 class="app-page-title text-lg">${recordId ? 'Rehberlik Kaydını Düzenle' : 'Yeni Rehberlik Kaydı Ekle'}</h2>
                    <p class="app-page-subtitle">${escapeHtml(student.adSoyad)} için müdahale ve takip planı.</p>
                </div>
                <button onclick="this.closest('.app-modal-backdrop').remove()" class="app-modal-close" aria-label="Kapat">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="app-modal-body">
            <form onsubmit="event.preventDefault(); saveGuidanceRecordForm('${studentId}', ${recordId ? `'${recordId}'` : 'null'})" class="space-y-3.5">
                <!-- Kayıt Türü -->
                <div class="space-y-1">
                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">Kayıt Türü</label>
                    <select id="grFormType" class="student-form-input min-h-[40px] text-xs">
                        ${Object.entries(GUIDANCE_RECORD_TYPES).map(([key, label]) => `
                            <option value="${key}" ${initialData.type === key ? 'selected' : ''}>${escapeHtml(label)}</option>
                        `).join('')}
                    </select>
                </div>

                <!-- Sorun / Gözlem -->
                <div class="space-y-1">
                    <div class="flex items-center justify-between">
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">Sorun / Gözlem <span class="text-rose-500">*</span></label>
                        ${!recordId && initialData.issue ? '<span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">Öneri Dolduruldu</span>' : ''}
                    </div>
                    <textarea id="grFormIssue" required rows="2" class="student-form-input text-xs leading-relaxed" placeholder="Örn: Katı Basıncı konusunda bilgi eksikliği ve soru kalıplarında zorlanma">${escapeHtml(initialData.issue)}</textarea>
                </div>

                <!-- Planlanan / Uygulanan Müdahale -->
                <div class="space-y-1">
                    <div class="flex items-center justify-between">
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">Planlanan / Uygulanan Müdahale <span class="text-rose-500">*</span></label>
                        ${!recordId && initialData.action ? '<span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">Öneri Dolduruldu</span>' : ''}
                    </div>
                    <textarea id="grFormAction" required rows="2" class="student-form-input text-xs leading-relaxed" placeholder="Örn: 20 dk hedefli konu tekrarı yapıldı, 25 soruluk pekiştirme ödevi verildi">${escapeHtml(initialData.action)}</textarea>
                </div>

                <!-- Takip Tarihi -->
                <div class="space-y-1">
                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">Takip Tarihi (Opsiyonel)</label>
                    <input type="date" id="grFormFollowUpDate" value="${escapeHtml(initialData.followUpDate)}" class="student-form-input min-h-[40px] text-xs">
                    <p class="text-[11px] text-gray-400">Bu tarihte sistemde takip hatırlatma vurgusu görüntülenecektir.</p>
                </div>

                <!-- Ek Not -->
                <div class="space-y-1">
                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">Ek Notlar (Opsiyonel)</label>
                    <textarea id="grFormNote" rows="2" class="student-form-input text-xs" placeholder="Öğrencinin yaklaşımı, veli görüşmesi vb.">${escapeHtml(initialData.note)}</textarea>
                </div>

                <div class="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button type="button" onclick="this.closest('.app-modal-backdrop').remove()" class="btn-secondary flex-1 py-2.5 min-h-[44px] text-xs font-semibold">
                        İptal
                    </button>
                    <button type="submit" class="btn-primary flex-1 py-2.5 min-h-[44px] text-xs font-bold">
                        <i class="fas fa-save mr-1"></i> ${recordId ? 'Değişiklikleri Kaydet' : 'Rehberlik Kaydını Kaydet'}
                    </button>
                </div>
            </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * Saves guidance record from the form submission.
 */
export async function saveGuidanceRecordForm(studentId, recordId = null) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const type = document.getElementById('grFormType')?.value || 'academic';
    const issue = document.getElementById('grFormIssue')?.value || '';
    const action = document.getElementById('grFormAction')?.value || '';
    const followUpDate = document.getElementById('grFormFollowUpDate')?.value || null;
    const note = document.getElementById('grFormNote')?.value || '';

    if (!issue.trim() || !action.trim()) {
        alert('Lütfen Sorun/Gözlem ve Planlanan / Uygulanan Müdahale alanlarını doldurunuz.');
        return;
    }

    if (recordId) {
        const tempStudent = { ...student, guidanceRecords: Array.isArray(student.guidanceRecords) ? [...student.guidanceRecords] : [] };
        const updatedRecord = updateGuidanceRecord(tempStudent, recordId, {
            type,
            issue: issue.trim(),
            action: action.trim(),
            followUpDate: followUpDate ? followUpDate.slice(0, 10) : null,
            note: note.trim()
        });
        const res = await updateStudentArrayRecord(studentId, 'guidanceRecords', recordId, updatedRecord);
        if (res && !res.ok && res.blockedOffline) {
            alert(res.message);
            return;
        }
    } else {
        const tempStudent = { ...student, guidanceRecords: Array.isArray(student.guidanceRecords) ? [...student.guidanceRecords] : [] };
        const newRecord = createGuidanceRecord(tempStudent, {
            type,
            issue: issue.trim(),
            action: action.trim(),
            followUpDate: followUpDate ? followUpDate.slice(0, 10) : null,
            note: note.trim()
        });
        const res = await addStudentArrayRecord(studentId, 'guidanceRecords', newRecord);
        if (res && !res.ok && res.blockedOffline) {
            alert(res.message);
            return;
        }
    }

    document.getElementById('guidanceRecordModal')?.remove();
    if (store.currentPage === 'guidance-detail' || window.currentPage === 'guidance-detail') {
        renderGuidanceStudentDetail(studentId);
    } else {
        renderGuidancePage();
    }
}

/**
 * Shows the modal to complete/evaluate a guidance record.
 */
export function showCompleteGuidanceRecordModal(studentId, recordId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const records = getStudentGuidanceRecords(student);
    const record = records.find(r => r.id === recordId);
    if (!record) return;

    const modalId = 'completeGuidanceRecordModal';
    document.getElementById(modalId)?.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'app-modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
        <div class="app-modal max-w-lg w-full" onclick="event.stopPropagation()">
            <div class="app-modal-header">
                <div>
                    <h2 class="app-page-title text-lg">Rehberlik Takibini Sonuçlandır</h2>
                    <p class="app-page-subtitle">${escapeHtml(student.adSoyad)} · Müdahale Sonuç Değerlendirmesi</p>
                </div>
                <button onclick="this.closest('.app-modal-backdrop').remove()" class="app-modal-close" aria-label="Kapat">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="app-modal-body space-y-4">
            <!-- Kayıt Özeti -->
            <div class="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200/60 dark:border-gray-800 space-y-1 text-xs">
                <p class="text-gray-500"><span class="font-bold text-gray-800 dark:text-gray-200">Gözlem:</span> ${escapeHtml(record.issue)}</p>
                <p class="text-gray-500"><span class="font-bold text-gray-800 dark:text-gray-200">Planlanan / Uygulanan Müdahale:</span> ${escapeHtml(record.action)}</p>
            </div>

            <form onsubmit="event.preventDefault(); saveCompleteGuidanceRecordForm('${studentId}', '${recordId}')" class="space-y-3.5">
                <!-- Sonuç Seçimi -->
                <div class="space-y-1">
                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">Öğretmen Değerlendirmesi / Sonuç <span class="text-rose-500">*</span></label>
                    <select id="grCompleteResult" class="student-form-input min-h-[40px] text-xs font-bold">
                        ${Object.entries(GUIDANCE_RESULT_OPTIONS).map(([key, label]) => `
                            <option value="${key}">${escapeHtml(label)}</option>
                        `).join('')}
                    </select>
                    <p class="text-[11px] text-gray-400">"Henüz Ölçülmedi" seçilirse kayıt açık ve takipte kalır; diğer sonuçlar takibi tamamlar.</p>
                </div>

                <!-- Sonuç Notu -->
                <div class="space-y-1">
                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">Değerlendirme Notu (Opsiyonel)</label>
                    <textarea id="grCompleteResultNote" rows="3" class="student-form-input text-xs" placeholder="Öğrencinin konuyu kavrama düzeyi, yeni net durumu veya pekişme durumu..."></textarea>
                </div>

                <div class="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button type="button" onclick="this.closest('.app-modal-backdrop').remove()" class="btn-secondary flex-1 py-2.5 min-h-[44px] text-xs font-semibold">
                        İptal
                    </button>
                    <button type="submit" class="btn-primary flex-1 py-2.5 min-h-[44px] text-xs font-bold">
                        <i class="fas fa-save mr-1"></i> Sonucu Kaydet
                    </button>
                </div>
            </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * Saves completion of guidance record.
 */
export async function saveCompleteGuidanceRecordForm(studentId, recordId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const result = document.getElementById('grCompleteResult')?.value || 'positive';
    const resultNote = document.getElementById('grCompleteResultNote')?.value || '';

    const tempStudent = { ...student, guidanceRecords: Array.isArray(student.guidanceRecords) ? [...student.guidanceRecords] : [] };
    const completedRecord = completeGuidanceRecord(tempStudent, recordId, {
        result,
        resultNote: resultNote.trim()
    });

    const res = await updateStudentArrayRecord(studentId, 'guidanceRecords', recordId, completedRecord);
    if (res && !res.ok && res.blockedOffline) {
        alert(res.message);
        return;
    }

    document.getElementById('completeGuidanceRecordModal')?.remove();
    if (store.currentPage === 'guidance-detail' || window.currentPage === 'guidance-detail') {
        renderGuidanceStudentDetail(studentId);
    } else {
        renderGuidancePage();
    }
}

/**
 * Confirms and deletes a guidance record safely.
 */
export async function confirmDeleteGuidanceRecord(studentId, recordId) {
    if (!confirm('Bu rehberlik kaydı kalıcı olarak silinecek. Emin misiniz?')) {
        return;
    }

    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const res = await deleteStudentArrayRecord(studentId, 'guidanceRecords', recordId);
    if (res && !res.ok && res.blockedOffline) {
        alert(res.message);
        return;
    }

    if (store.currentPage === 'guidance-detail' || window.currentPage === 'guidance-detail') {
        renderGuidanceStudentDetail(studentId);
    } else {
        renderGuidancePage();
    }
}

export function updateGuidanceFilters(nextFilters = {}) {
    const current = window._guidanceFilters || {};
    const merged = { ...current, ...nextFilters };
    renderGuidancePage(merged);
}

export function filterGuidanceStudents(query) {
    updateGuidanceFilters({ query });
    const input = document.getElementById('guidanceSearchInput');
    input?.focus();
    input?.setSelectionRange(query.length, query.length);
}

export function openGuidanceStudent(studentId) {
    window._guidanceStudentTab = 'overview';
    renderGuidanceStudentDetail(studentId);
}

export async function openStudentCockpitDirect(studentId) {
    store.studentPanelOrigin = 'guidance';
    if (window.renderStudentCockpit) {
        await window.renderStudentCockpit(studentId, 'guidance');
    }
}

export function openCockpitHomework(studentId) {
    if (window.showOdevAtaModal) {
        window.showOdevAtaModal(studentId);
    }
}

export function openGuidanceReportModal(studentId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const modalId = 'guidanceReportModal';
    document.getElementById(modalId)?.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'app-modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
        <div class="app-modal max-w-lg w-full" onclick="event.stopPropagation()">
            <div class="app-modal-header">
                <div>
                    <h2 class="app-page-title text-lg flex items-center gap-2">
                        <i class="fas fa-file-pdf text-red-500"></i> Rehberlik Gelişim Raporu
                    </h2>
                    <p class="app-page-subtitle">${escapeHtml(student.adSoyad)} (${escapeHtml(student.sinif ? `${student.sinif}. Sınıf` : 'Öğrenci')})</p>
                </div>
                <button onclick="this.closest('.app-modal-backdrop').remove()" class="app-modal-close" aria-label="Kapat">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="app-modal-body">
            <form id="guidanceReportForm" onsubmit="event.preventDefault(); downloadGuidanceReportPdf('${studentId}');" class="space-y-4">
                <!-- Dönem Seçimi -->
                <div>
                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Rapor Dönemi</label>
                    <select id="reportPeriodSelect" class="form-input text-xs w-full min-h-[44px]">
                        <option value="4weeks" selected>Son 4 Hafta (Önerilen)</option>
                        <option value="8weeks">Son 8 Hafta</option>
                        <option value="term">Bu Dönem</option>
                        <option value="all">Tüm Geçmiş</option>
                    </select>
                </div>

                <!-- Dahil Edilecek Bölümler -->
                <div>
                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Dahil Edilecek Bölümler</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-200 dark:border-gray-800 text-xs">
                        <label class="flex items-center gap-2 min-h-[44px] cursor-pointer">
                            <input type="checkbox" id="sec_academicSummary" checked class="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4">
                            <span class="font-medium text-gray-800 dark:text-gray-200">Akademik Durum Özeti</span>
                        </label>
                        <label class="flex items-center gap-2 min-h-[44px] cursor-pointer">
                            <input type="checkbox" id="sec_examTrend" checked class="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4">
                            <span class="font-medium text-gray-800 dark:text-gray-200">Deneme & Net Gelişimi</span>
                        </label>
                        <label class="flex items-center gap-2 min-h-[44px] cursor-pointer">
                            <input type="checkbox" id="sec_weakTopics" checked class="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4">
                            <span class="font-medium text-gray-800 dark:text-gray-200">Zayıf Ünite ve Konular</span>
                        </label>
                        <label class="flex items-center gap-2 min-h-[44px] cursor-pointer">
                            <input type="checkbox" id="sec_errorReasons" checked class="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4">
                            <span class="font-medium text-gray-800 dark:text-gray-200">Hata Nedenleri Dağılımı</span>
                        </label>
                        <label class="flex items-center gap-2 min-h-[44px] cursor-pointer">
                            <input type="checkbox" id="sec_homeworkSummary" checked class="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4">
                            <span class="font-medium text-gray-800 dark:text-gray-200">Ödev & Çalışma Disiplini</span>
                        </label>
                        <label class="flex items-center gap-2 min-h-[44px] cursor-pointer">
                            <input type="checkbox" id="sec_guidanceInterventions" checked class="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4">
                            <span class="font-medium text-gray-800 dark:text-gray-200">Rehberlik Müdahaleleri</span>
                        </label>
                        <label class="flex items-center gap-2 min-h-[44px] cursor-pointer">
                            <input type="checkbox" id="sec_openFollowUps" checked class="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4">
                            <span class="font-medium text-gray-800 dark:text-gray-200">Devam Eden Takipler</span>
                        </label>
                        <label class="flex items-center gap-2 min-h-[44px] cursor-pointer">
                            <input type="checkbox" id="sec_nextActions" checked class="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4">
                            <span class="font-medium text-gray-800 dark:text-gray-200">Önerilen Sonraki Adımlar</span>
                        </label>
                    </div>
                </div>

                <!-- Öğretmen Notu (Opsiyonel, yerel durum) -->
                <div>
                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Öğretmen Değerlendirmesi / Veli Notu (İsteğe Bağlı)</label>
                    <textarea id="reportTeacherNote" rows="2" class="form-input text-xs w-full py-2" placeholder="Rapora eklenecek özel öğretmen değerlendirmesi veya notu..."></textarea>
                </div>

                <!-- Modal Actions -->
                <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex-wrap">
                    <button type="button" onclick="this.closest('.app-modal-backdrop').remove()" class="btn-secondary min-h-[44px] px-4 text-xs font-semibold">
                        Vazgeç
                    </button>
                    ${typeof navigator !== 'undefined' && navigator.share ? `
                        <button type="button" onclick="shareGuidanceReportPdf('${studentId}')" class="btn-secondary min-h-[44px] px-4 text-xs font-bold flex items-center gap-1.5">
                            <i class="fas fa-share-nodes"></i> Paylaş
                        </button>
                    ` : ''}
                    <button type="button" onclick="printGuidanceReportPdf('${studentId}')" class="btn-secondary min-h-[44px] px-4 text-xs font-bold flex items-center gap-1.5">
                        <i class="fas fa-print"></i> Yazdır
                    </button>
                    <button type="submit" class="btn-primary min-h-[44px] px-5 text-xs font-bold flex items-center gap-1.5">
                        <i class="fas fa-file-pdf"></i> PDF İndir
                    </button>
                </div>
            </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function getGuidanceReportOptionsFromModal() {
    const periodSelect = document.getElementById('reportPeriodSelect');
    const period = periodSelect ? periodSelect.value : '4weeks';
    const teacherNoteInput = document.getElementById('reportTeacherNote');
    const teacherNote = teacherNoteInput ? teacherNoteInput.value.trim() : '';

    const sections = {
        academicSummary: document.getElementById('sec_academicSummary')?.checked ?? true,
        examTrend: document.getElementById('sec_examTrend')?.checked ?? true,
        weakTopics: document.getElementById('sec_weakTopics')?.checked ?? true,
        errorReasons: document.getElementById('sec_errorReasons')?.checked ?? true,
        homeworkSummary: document.getElementById('sec_homeworkSummary')?.checked ?? true,
        guidanceInterventions: document.getElementById('sec_guidanceInterventions')?.checked ?? true,
        openFollowUps: document.getElementById('sec_openFollowUps')?.checked ?? true,
        nextActions: document.getElementById('sec_nextActions')?.checked ?? true,
        teacherNote: true
    };

    return { period, teacherNote, sections };
}

let _reportModulesPromise = null;
export async function getGuidanceReportModules() {
    if (!_reportModulesPromise) {
        _reportModulesPromise = Promise.all([
            import('./guidance-report-insights.js'),
            import('./guidance-report-pdf.js')
        ]).then(([insights, pdf]) => ({
            buildGuidanceReportData: insights.buildGuidanceReportData,
            normalizeGuidanceReportFilename: insights.normalizeGuidanceReportFilename,
            generateGuidancePdf: pdf.generateGuidancePdf
        })).catch(err => {
            _reportModulesPromise = null; // Reset on failure to allow retry
            throw err;
        });
    }
    return _reportModulesPromise;
}

export async function downloadGuidanceReportPdf(studentId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    try {
        const { buildGuidanceReportData, normalizeGuidanceReportFilename, generateGuidancePdf } = await getGuidanceReportModules();
        const modalOptions = getGuidanceReportOptionsFromModal();
        const reportData = buildGuidanceReportData(student, modalOptions);
        if (!reportData) return;

        const filename = normalizeGuidanceReportFilename({
            studentName: reportData.student.name,
            date: reportData.period.endDate
        });

        const doc = generateGuidancePdf(reportData);
        doc.save(filename);
    } catch (err) {
        console.error("PDF oluşturma/yükleme hatası:", err);
        alert("Rehberlik raporlama modülü yüklenemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin: " + (err.message || err));
    }
}

export async function shareGuidanceReportPdf(studentId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    try {
        const { buildGuidanceReportData, normalizeGuidanceReportFilename, generateGuidancePdf } = await getGuidanceReportModules();
        const modalOptions = getGuidanceReportOptionsFromModal();
        const reportData = buildGuidanceReportData(student, modalOptions);
        if (!reportData) return;

        const filename = normalizeGuidanceReportFilename({
            studentName: reportData.student.name,
            date: reportData.period.endDate
        });

        const doc = generateGuidancePdf(reportData);
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({
                title: `CanFenci - ${reportData.student.name} Rehberlik Raporu`,
                text: `${reportData.student.name} öğrencimizin rehberlik gelişim ve takip raporu.`,
                files: [pdfFile]
            });
            return;
        } else if (navigator.share) {
            await navigator.share({
                title: `CanFenci - ${reportData.student.name} Rehberlik Raporu`,
                text: `${reportData.student.name} öğrencimizin rehberlik gelişim raporu (${reportData.student.periodLabel}).`
            });
            return;
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.warn("Paylaşım desteklenmiyor veya iptal edildi, PDF indiriliyor:", err);
            downloadGuidanceReportPdf(studentId);
        }
    }
}

export async function printGuidanceReportPdf(studentId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    try {
        const { buildGuidanceReportData, generateGuidancePdf } = await getGuidanceReportModules();
        const modalOptions = getGuidanceReportOptionsFromModal();
        const reportData = buildGuidanceReportData(student, modalOptions);
        if (!reportData) return;

        const doc = generateGuidancePdf(reportData);
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');
    } catch (err) {
        console.error("PDF yazdırma hatası:", err);
        downloadGuidanceReportPdf(studentId);
    }
}

window.renderGuidancePage = renderGuidancePage;
window.renderGuidanceStudentDetail = renderGuidanceStudentDetail;
window.updateGuidanceFilters = updateGuidanceFilters;
window.filterGuidanceStudents = filterGuidanceStudents;
window.openGuidanceStudent = openGuidanceStudent;
window.openStudentCockpitDirect = openStudentCockpitDirect;
window.openCockpitHomework = openCockpitHomework;
window.showGuidanceRecordModal = showGuidanceRecordModal;
window.saveGuidanceRecordForm = saveGuidanceRecordForm;
window.showCompleteGuidanceRecordModal = showCompleteGuidanceRecordModal;
window.saveCompleteGuidanceRecordForm = saveCompleteGuidanceRecordForm;
window.confirmDeleteGuidanceRecord = confirmDeleteGuidanceRecord;
window.openGuidanceReportModal = openGuidanceReportModal;
window.downloadGuidanceReportPdf = downloadGuidanceReportPdf;
window.shareGuidanceReportPdf = shareGuidanceReportPdf;
window.printGuidanceReportPdf = printGuidanceReportPdf;
window.switchGuidanceStudentTab = switchGuidanceStudentTab;
window.switchGuidancePerformanceTab = switchGuidancePerformanceTab;
window.setGuidanceHomeworkRange = setGuidanceHomeworkRange;
window.setGuidanceExamRange = setGuidanceExamRange;
window.setGuidanceExamSubject = setGuidanceExamSubject;
