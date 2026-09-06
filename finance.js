// ==================== LESSON LOGS & FINANCE REPORT MODÜLÜ ====================

import { store, loadStudentsData, loadDersKayitlari, saveDersKayitlari, getDersOzet, getKonuListesiBySinif, getKonuListesiBySinifAndDers, getStudentOdevler, escapeHtml } from './store.js';
import { updateMobileNavActive } from './auth.js';
import { ATTENDANCE_LABELS, calculateLessonFinance, normalizeLessonStatus, updateLessonAttendanceState, updateLessonPaymentState } from './lesson-finance-insights.js';
import { formatLessonDateForDisplay, formatLessonDateTyping, parseLessonDateInput } from './lesson-date-utils.js';
import { readResourceSelection, resourceOptionsHtml, toggleManualResource } from './resource-books.js';

export function renderFinanceReport() {
    store.currentPage = "finance";
    const students = loadStudentsData();
    
    let totalRevenueCollected = 0;
    let totalPendingRevenue = 0;
    let totalCompletedLessons = 0;
    let totalPendingLessons = 0;
    let activeFeeStudentsCount = 0;
    
    const studentFinanceRows = students.map(s => {
        const ucret = parseFloat(s.dersUcreti) || parseFloat(s.aylikUcret) || parseFloat(s.ucret) || 0;
        if (ucret > 0) activeFeeStudentsCount++;
        
        const kayitlar = loadDersKayitlari(s.id);
        const finance = calculateLessonFinance(kayitlar, ucret);
        const totalDersCount = finance.totalCount;
        const paidDersCount = finance.paidCount;
        const pendingDersCount = finance.pendingCount;
        const paidAmount = finance.paidAmount;
        const pendingAmount = finance.pendingAmount;
        
        totalRevenueCollected += paidAmount;
        totalPendingRevenue += pendingAmount;
        totalCompletedLessons += paidDersCount;
        totalPendingLessons += pendingDersCount;
        
        return {
            id: s.id,
            adSoyad: s.adSoyad,
            veliTel: s.veliTel,
            ucret: ucret,
            totalDersCount,
            paidDersCount,
            pendingDersCount,
            paidAmount,
            pendingAmount,
            statusCounts: finance.statusCounts
        };
    });
    
    let rowsHtml = '';
    if (studentFinanceRows.length === 0) {
        rowsHtml = `<tr><td colspan="7" class="text-center p-4 text-gray-500">Öğrenci bulunmuyor.</td></tr>`;
    } else {
        rowsHtml = studentFinanceRows.map(row => {
            const whMsg = `Merhaba Sayın Velimiz,\n\n*${row.adSoyad}* isimli öğrencimizin ders ödeme takip detayı aşağıdaki gibidir:\n\n` +
                          `- Birim Ders Ücreti: ${row.ucret} TL\n` +
                          `- Ücretlendirilen Ders: ${row.paidDersCount + row.pendingDersCount} saat\n` +
                          `- Ödenen Ders: ${row.paidDersCount} saat\n` +
                          `- Ödeme Bekleyen Ders: ${row.pendingDersCount} saat\n` +
                          `💸 *Kalan Ödeme Tutarı:* *${row.pendingAmount} TL*\n\n` +
                          `Ödemeyi gerçekleştirdiyseniz lütfen bize bilgi veriniz. İyi çalışmalar dileriz.`;
            
            let phone = row.veliTel ? row.veliTel.replace(/\D/g, '') : '';
            if (phone.startsWith('0')) phone = '90' + phone.substring(1);
            else if (!phone.startsWith('90') && phone.length === 10) phone = '90' + phone;
            const whUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(whMsg)}`;
            
            const whBtn = row.pendingAmount > 0 
                ? `<a href="${whUrl}" target="_blank" class="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 py-2 rounded-xl text-sm inline-flex items-center gap-1 font-semibold transition shadow-md min-h-[44px]">
                       <i class="fab fa-whatsapp"></i> Hatırlat
                   </a>`
                : `<span class="text-sm text-green-600 font-bold"><i class="fas fa-check-circle"></i> Borç Yok</span>`;
            
            return `
                <tr class="border-b hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td class="p-4 text-base font-semibold">${escapeHtml(row.adSoyad)}</td>
                    <td class="p-4 text-base">${row.ucret} TL</td>
                    <td class="p-4 text-base">${row.paidDersCount + row.pendingDersCount}<br><span class="text-xs text-gray-400">${row.statusCounts.iptal + row.statusCounts.mazeretli + row.statusCounts.gelmedi} ücret dışı · ${row.statusCounts.planlandi} planlandı</span></td>
                    <td class="p-4 text-base text-green-600 font-bold">${row.paidDersCount} (${row.paidAmount} TL)</td>
                    <td class="p-4 text-base text-yellow-600 dark:text-yellow-400 font-bold">${row.pendingDersCount} (${row.pendingAmount} TL)</td>
                    <td class="p-4 text-base font-bold text-indigo-600 dark:text-indigo-400">${row.paidAmount + row.pendingAmount} TL</td>
                    <td class="p-4 text-base">${whBtn}</td>
                </tr>
            `;
        }).join('');
    }
    
    const html = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-100/20 dark:border-gray-700/50">
            <div class="flex justify-between items-center mb-6 flex-wrap gap-3">
                <div>
                    <h2 class="text-2xl font-black text-gray-800 dark:text-white border-b-2 border-primary/20 pb-2 mb-1">
                        <i class="fas fa-wallet text-amber-500"></i> Finans / Ödeme Raporu
                    </h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Tüm öğrencilerin ders ücreti ve ödeme durumlarının toplu raporu.</p>
                </div>
                <button onclick="renderGenelIslemler()" class="bg-gray-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-600 transition flex items-center gap-1 min-h-[44px]">
                    <i class="fas fa-arrow-left"></i> Geri
                </button>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div class="cf-card p-4 text-center">
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Aktif Ücretli Öğrenci</span>
                    <div class="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">${activeFeeStudentsCount} / ${students.length}</div>
                </div>
                <div class="cf-card p-4 text-center">
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Yapılan Toplam Ders</span>
                    <div class="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">${totalCompletedLessons + totalPendingLessons} Saat</div>
                </div>
                <div class="cf-card p-4 text-center">
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Tahsil Edilen Toplam Tutar</span>
                    <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${totalRevenueCollected} TL</div>
                </div>
                <div class="cf-card p-4 text-center">
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Ödeme Bekleyen Tutar</span>
                    <div class="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">${totalPendingRevenue} TL</div>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full border-collapse border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <thead class="bg-gray-800 dark:bg-gray-900 text-white">
                        <tr>
                            <th class="border p-4 text-left text-sm font-bold">Öğrenci</th>
                            <th class="border p-4 text-left text-sm font-bold">Ders Ücreti</th>
                            <th class="border p-4 text-left text-sm font-bold">Toplam Ders</th>
                            <th class="border p-4 text-left text-sm font-bold">Ödenen (Tutar)</th>
                            <th class="border p-4 text-left text-sm font-bold">Bekleyen (Tutar)</th>
                            <th class="border p-4 text-left text-sm font-bold">Genel Toplam</th>
                            <th class="border p-4 text-left text-sm font-bold">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export function renderDersKayitlari() {
    store.currentPage = "dersKayitlari";
    window._dersKayitOrigin = 'list';
    updateMobileNavActive('mobile-nav-lessons');
    const students = loadStudentsData();
    if (students.length === 0) {
        document.getElementById("dynamic-content").innerHTML = `
            <div class="app-page">
                <div class="app-panel cf-empty-state">
                    <div class="cf-empty-icon"><i class="fas fa-book-open"></i></div>
                    <h3 class="cf-empty-title">Henüz Öğrenci Kaydı Bulunmuyor</h3>
                    <p class="cf-empty-desc">Ders kayıtlarını yönetmek ve ücret takibini yapmak için önce öğrenci ekleyin.</p>
                    <button onclick="showAddStudentModal()" class="cf-btn-primary min-h-[44px]"><i class="fas fa-plus mr-1"></i> Öğrenci Ekle</button>
                </div>
            </div>`;
        return;
    }
    
    let cardsHtml = '<div class="grid md:grid-cols-2 gap-4">';
    for (let s of students) {
        const dersUcreti = parseFloat(s.dersUcreti) || parseFloat(s.aylikUcret) || parseFloat(s.ucret) || 0;
        const { toplamDers, ucretlendirilenDersSayisi, odenenDersSayisi, toplamOdeme } = getDersOzet(s.id, dersUcreti);
        cardsHtml += `
            <div class="app-panel p-5 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition" onclick="renderDersDetay('${s.id}')">
                <div class="flex justify-between items-start gap-3">
                    <div><h3 class="text-lg font-black">${escapeHtml(s.adSoyad)}</h3><p class="text-sm text-gray-500 mt-1">Bir ders ücreti · ${dersUcreti} TL</p></div>
                    <span class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 flex items-center justify-center"><i class="fas fa-chevron-right"></i></span>
                </div>
                <div class="grid grid-cols-3 gap-2 mt-4 pt-4 border-t dark:border-gray-700 text-center">
                    <div><p class="text-xs text-gray-500">Ders</p><p class="font-black">${toplamDers}</p></div>
                    <div><p class="text-xs text-gray-500">Ödenen</p><p class="font-black text-emerald-600">${odenenDersSayisi}/${ucretlendirilenDersSayisi}</p></div>
                    <div><p class="text-xs text-gray-500">Toplam</p><p class="font-black text-indigo-600">${toplamOdeme} TL</p></div>
                </div>
            </div>`;
    }
    cardsHtml += '</div>';
    
    document.getElementById("dynamic-content").innerHTML = `
        <div class="app-page"><header class="app-page-header"><div><h2 class="app-page-title">Ders Kayıtları</h2><p class="app-page-subtitle">Ders geçmişi, katılım ve ücret durumlarını tek yerden yönetin.</p></div></header>${cardsHtml}</div>
    `;
}

function formatLessonDateShort(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return formatLessonDateForDisplay(value);
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const monthIdx = Number(match[2]) - 1;
    const monthName = months[monthIdx] || match[2];
    return `${match[3]} ${monthName} ${match[1]}`;
}

export function toggleLessonRowDetail(lessonId) {
    const detailRow = document.getElementById(`detail-row-${lessonId}`);
    const mobileDetail = document.getElementById(`mobile-detail-${lessonId}`);
    const chevron = document.getElementById(`chevron-${lessonId}`);
    const mobileChevron = document.getElementById(`mobile-chevron-${lessonId}`);

    const isAlreadyOpen = detailRow && !detailRow.classList.contains('hidden');

    // Single open detail: close all open detail rows
    document.querySelectorAll('.lesson-detail-row').forEach(row => row.classList.add('hidden'));
    document.querySelectorAll('.mobile-lesson-detail').forEach(row => row.classList.add('hidden'));
    document.querySelectorAll('[id^="chevron-"]').forEach(icon => icon.classList.remove('rotate-90'));
    document.querySelectorAll('[id^="mobile-chevron-"]').forEach(icon => icon.classList.remove('rotate-90'));

    if (!isAlreadyOpen) {
        if (detailRow) detailRow.classList.remove('hidden');
        if (mobileDetail) mobileDetail.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-90');
        if (mobileChevron) mobileChevron.classList.add('rotate-90');
    }
}

export function setLessonPeriodFilter(studentId, period) {
    window._lessonFilterPeriod = period;
    renderDersDetay(studentId);
}

export function setLessonSortOrder(studentId, order) {
    window._lessonSortOrder = order;
    renderDersDetay(studentId);
}

export function onLessonSearchInput(studentId, query) {
    window._lessonSearchQuery = query;
    renderDersDetay(studentId);
}

export function renderDersDetay(studentId, origin = 'list') {
    store.currentPage = "dersDetay";
    window._dersKayitOrigin = origin === 'cockpit' ? 'cockpit' : (window._dersKayitOrigin || origin);
    window._currentDersKayitStudentId = studentId;
    updateMobileNavActive('mobile-nav-lessons');
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) {
        renderDersKayitlari();
        return;
    }
    
    const effectiveSinif = (String(student.sinif).trim() === "8" || (student.adSoyad && student.adSoyad.includes("(8)"))) ? "8" : student.sinif;
    
    let kayitlar = loadDersKayitlari(studentId);
    kayitlar = kayitlar.map((k, idx) => ({
        ...k,
        id: k.id || `lesson_${studentId}_${Date.now()}_${idx}`,
        dersNo: idx + 1
    }));
    saveDersKayitlari(studentId, kayitlar);
    const studentHomeworks = getStudentOdevler(student);
    
    const now = new Date();
    const currentYearMonth = now.toISOString().slice(0, 7);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const currentPeriod = window._lessonFilterPeriod || 'all';
    const searchQuery = (window._lessonSearchQuery || '').toLocaleLowerCase('tr-TR').trim();
    const sortOrder = window._lessonSortOrder || 'newest';

    let displayKayitlar = [...kayitlar];

    // 1. Period filter
    if (currentPeriod === 'month') {
        displayKayitlar = displayKayitlar.filter(k => String(k.tarih || '').startsWith(currentYearMonth));
    } else if (currentPeriod === '3months') {
        displayKayitlar = displayKayitlar.filter(k => String(k.tarih || '') >= ninetyDaysAgo);
    }

    // 2. Search filter (Turkish case-insensitive across topic, content, branch, and resource)
    if (searchQuery) {
        displayKayitlar = displayKayitlar.filter(k => {
            const konu = String(k.konu || '').toLocaleLowerCase('tr-TR');
            const icerik = String(k.icerik || '').toLocaleLowerCase('tr-TR');
            const ders = String(k.ders || '').toLocaleLowerCase('tr-TR');
            const kaynak = String(k.kaynak || '').toLocaleLowerCase('tr-TR');
            return konu.includes(searchQuery) || icerik.includes(searchQuery) || ders.includes(searchQuery) || kaynak.includes(searchQuery);
        });
    }

    // 3. Sorting (default: newest -> oldest)
    displayKayitlar.sort((a, b) => {
        const dateComp = String(b.tarih || '').localeCompare(String(a.tarih || ''));
        if (dateComp !== 0) {
            return sortOrder === 'newest' ? dateComp : -dateComp;
        }
        return sortOrder === 'newest' ? (b.dersNo - a.dersNo) : (a.dersNo - b.dersNo);
    });

    let tableRows = '';
    let mobileCards = '';
    for (let k of displayKayitlar) {
        const katilimDurumu = normalizeLessonStatus(k);
        const legacyHomework = Array.isArray(k.odev) ? k.odev : (k.odev ? [k.odev] : []);
        const linkedHomeworks = studentHomeworks.filter(homework => homework.kaynakDers?.lessonId === k.id);
        const completedHomeworkCount = linkedHomeworks.filter(homework => homework.durum === 'tamamlandi').length;
        const homeworkSummary = linkedHomeworks.length > 0
            ? `<button onclick="renderStudentOdevDetay('${studentId}')" class="text-left text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">${linkedHomeworks.length} ödev · ${completedHomeworkCount} tamamlandı</button>`
            : '<span class="text-xs text-gray-400">Ödev atanmadı</span>';
        const legacyHomeworkHtml = legacyHomework.length > 0
            ? `<div class="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400" title="Eski ders kaydından korundu">Eski not: ${legacyHomework.map(escapeHtml).join(', ')}</div>`
            : '';
        const lessonBranches = [...new Set([...(store.teacherBranches || []), k.ders].filter(Boolean))];
        const lessonTopics = getKonuListesiBySinifAndDers(effectiveSinif, k.ders);
        const editTopics = lessonTopics.includes(k.konu) ? lessonTopics : [k.konu, ...lessonTopics].filter(Boolean);
        
        tableRows += `
            <tr class="cf-lesson-row border-b border-gray-100 dark:border-gray-800 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition cursor-pointer" onclick="toggleLessonRowDetail('${k.id}')">
                <td class="p-3 text-xs font-bold text-gray-400">#${k.dersNo}</td>
                <td class="p-3 text-xs whitespace-nowrap">
                    <div class="font-bold text-gray-800 dark:text-gray-100">${formatLessonDateShort(k.tarih)}</div>
                    <div class="text-[11px] text-gray-400 font-medium">${k.sure || '60'} dk</div>
                </td>
                <td class="p-3 text-xs min-w-0 max-w-[200px]">
                    <div class="font-bold text-indigo-600 dark:text-indigo-400 truncate" title="${escapeHtml(k.konu)}">${escapeHtml(k.konu)}</div>
                    <div class="text-[11px] text-gray-400 font-medium truncate">${escapeHtml(k.ders || 'Ders')}</div>
                </td>
                <td class="p-3 text-xs text-gray-500 max-w-[220px] truncate" title="${escapeHtml(k.icerik || '')}">
                    ${escapeHtml(k.icerik || '—')}
                </td>
                <td class="p-2 min-w-[180px]" onclick="event.stopPropagation()">
                    <label class="sr-only" for="attendance-${k.id}">Katılım durumu</label>
                    <select id="attendance-${k.id}" aria-label="${escapeHtml(k.konu)} katılım durumu" onchange="updateDersKatilimDurumu('${studentId}', '${k.id}', this.value)" class="w-full min-h-[38px] rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 px-2.5 py-1.5 text-xs font-bold text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
                        ${Object.entries(ATTENDANCE_LABELS).map(([value, label]) => `<option value="${value}" ${katilimDurumu === value ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                </td>
                <td class="p-2 min-w-[125px]" onclick="event.stopPropagation()">
                    <label class="sr-only" for="payment-${k.id}">Ücret durumu</label>
                    <select id="payment-${k.id}" aria-label="${escapeHtml(k.konu)} ücret durumu" onchange="updateDersUcretDurumu('${studentId}', '${k.id}', this.value)" ${katilimDurumu !== 'yapildi' ? 'disabled' : ''} class="w-full min-h-[38px] rounded-lg border px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 transition ${katilimDurumu !== 'yapildi' ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed' : k.odendi ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 focus:ring-green-500' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 focus:ring-amber-500'}">
                        ${katilimDurumu !== 'yapildi'
                            ? '<option value="not-billable">Ücret Yok</option>'
                            : `<option value="pending" ${!k.odendi ? 'selected' : ''}>Bekliyor</option><option value="paid" ${k.odendi ? 'selected' : ''}>Ödendi</option>`}
                    </select>
                </td>
                <td class="p-2 text-center" onclick="event.stopPropagation()">
                    <button type="button" onclick="toggleLessonRowDetail('${k.id}')" class="w-8 h-8 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700 inline-flex items-center justify-center transition" title="Detayları Aç / Kapat" aria-label="Detayları Aç">
                        <i id="chevron-${k.id}" class="fas fa-chevron-right text-xs transition-transform duration-200"></i>
                    </button>
                </td>
            </tr>
            <tr id="detail-row-${k.id}" class="lesson-detail-row hidden bg-blue-50/30 dark:bg-blue-950/10 border-b border-gray-200 dark:border-gray-800">
                <td colspan="7" class="p-4">
                    <div class="rounded-xl border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-3">
                        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-2.5">
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 rounded text-[11px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">#${k.dersNo}</span>
                                <h4 class="font-black text-sm text-gray-900 dark:text-white">${escapeHtml(k.konu)}</h4>
                                <span class="text-xs text-gray-400">(${escapeHtml(k.ders || 'Ders')})</span>
                            </div>
                            <div class="text-xs text-gray-500 font-semibold">
                                <i class="far fa-calendar-alt mr-1"></i> ${formatLessonDateForDisplay(k.tarih)} · <i class="far fa-clock mr-1"></i> ${k.sure || '60'} dk
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                                <span class="font-bold text-gray-400 uppercase tracking-wider block mb-1">İçerik / Not</span>
                                <p class="text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/30 p-2.5 rounded-lg border border-gray-150 dark:border-gray-750">${escapeHtml(k.icerik || 'İçerik notu eklenmemiş.')}</p>
                            </div>
                            <div>
                                <span class="font-bold text-gray-400 uppercase tracking-wider block mb-1">Kaynak & Bağlantılı Ödev</span>
                                <div class="bg-gray-50 dark:bg-gray-900/30 p-2.5 rounded-lg border border-gray-150 dark:border-gray-750 space-y-1.5">
                                    <div><span class="text-gray-500">Kaynak:</span> <strong class="text-gray-800 dark:text-gray-200">${escapeHtml(k.kaynak || 'Belirtilmedi')}</strong></div>
                                    <div><span class="text-gray-500">Bağlantılı Ödev:</span> ${homeworkSummary}</div>
                                    ${legacyHomeworkHtml}
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <button onclick="openHomeworkForLesson('${studentId}', '${k.id}')" class="btn-secondary px-3 py-1.5 text-xs min-h-[36px]" title="Bu derse ödev ata">
                                <i class="fas fa-tasks mr-1"></i> Ödev Ata
                            </button>
                            <button id="edit-toggle-${k.id}" onclick="toggleDersKayitEditor('${k.id}')" aria-expanded="false" aria-controls="edit-row-${k.id}" class="btn-secondary px-3 py-1.5 text-xs min-h-[36px]">
                                <i class="fas fa-edit mr-1"></i> Düzenle
                            </button>
                            <button onclick="deleteDersKayit('${studentId}', ${k.dersNo})" class="px-3 py-1.5 text-xs min-h-[36px] rounded-xl border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold transition flex items-center gap-1" title="Ders kaydını sil" aria-label="Ders kaydını sil">
                                <i class="fas fa-trash"></i> Sil
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
            <tr id="edit-row-${k.id}" class="hidden bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900">
                <td colspan="7" class="p-4">
                    <div class="rounded-2xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-850 p-4 shadow-inner">
                        <div class="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h4 class="font-black text-gray-800 dark:text-white"><i class="fas fa-pen-to-square text-blue-500 mr-1"></i> ${k.dersNo}. Ders Kaydını Düzenle</h4>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Değişiklikleri yaptıktan sonra kaydetmeyi unutmayın.</p>
                            </div>
                            <button type="button" onclick="toggleDersKayitEditor('${k.id}', false)" class="min-w-[44px] min-h-[44px] rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Düzenleme panelini kapat"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                                <label for="edit-date-${k.id}" class="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Tarih</label>
                                <input id="edit-date-${k.id}" type="text" inputmode="numeric" maxlength="10" value="${formatLessonDateForDisplay(k.tarih)}" oninput="formatLessonDateTyping(this)" class="student-form-input min-h-[44px]" placeholder="GG/AA/YYYY">
                            </div>
                            <div>
                                <label for="edit-subject-${k.id}" class="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Ders</label>
                                <select id="edit-subject-${k.id}" onchange="updateDersEditTopics('${k.id}', '${effectiveSinif}')" class="student-form-input min-h-[44px]">
                                    ${lessonBranches.map(branch => `<option value="${escapeHtml(branch)}" ${branch === k.ders ? 'selected' : ''}>${effectiveSinif === '8' && branch === 'Sosyal Bilgiler' ? 'İnkılap Tarihi' : escapeHtml(branch)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label for="edit-topic-${k.id}" class="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Konu</label>
                                <select id="edit-topic-${k.id}" class="student-form-input min-h-[44px]">
                                    ${editTopics.map(topic => `<option value="${escapeHtml(topic)}" ${topic === k.konu ? 'selected' : ''}>${escapeHtml(topic)}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label for="edit-content-${k.id}" class="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">İçerik / Not</label>
                                <input id="edit-content-${k.id}" type="text" maxlength="300" value="${escapeHtml(k.icerik || '')}" class="student-form-input min-h-[44px]" placeholder="Ders içeriği veya kısa not">
                            </div>
                        </div>
                        <div id="edit-error-${k.id}" role="alert" class="hidden mt-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300"></div>
                        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
                            <button type="button" onclick="toggleDersKayitEditor('${k.id}', false)" class="min-h-[44px] px-5 rounded-xl border border-gray-300 dark:border-gray-600 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Vazgeç</button>
                            <button type="button" onclick="saveDersKayitEditor('${studentId}', '${k.id}')" class="btn-primary min-h-[44px] px-5"><i class="fas fa-save mr-1"></i> Değişiklikleri Kaydet</button>
                        </div>
                    </div>
                </td>
            </tr>`;

        mobileCards += `
            <article class="app-panel p-3.5 space-y-2.5 transition cursor-pointer" onclick="toggleLessonRowDetail('${k.id}')">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-xs font-black text-indigo-600 dark:text-indigo-400 shrink-0">#${k.dersNo}</span>
                        <span class="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">${formatLessonDateShort(k.tarih)} · 60 dk</span>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${katilimDurumu === 'yapildi' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : katilimDurumu === 'planlandi' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}">${ATTENDANCE_LABELS[katilimDurumu] || 'Ders'}</span>
                        <i id="mobile-chevron-${k.id}" class="fas fa-chevron-right text-gray-400 text-xs transition-transform duration-200"></i>
                    </div>
                </div>
                <div class="min-w-0">
                    <h4 class="font-black text-sm text-gray-900 dark:text-white truncate">${escapeHtml(k.konu)}</h4>
                    <p class="text-xs text-gray-500 truncate mt-0.5">${escapeHtml(k.icerik || k.ders || 'Ders kaydı')}</p>
                </div>

                <div id="mobile-detail-${k.id}" class="mobile-lesson-detail hidden pt-2.5 border-t border-gray-150 dark:border-gray-700 space-y-2.5 text-xs" onclick="event.stopPropagation()">
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-xs font-bold text-gray-500 block mb-1" for="mobile-attendance-${k.id}">Katılım</label>
                            <select id="mobile-attendance-${k.id}" onchange="updateDersKatilimDurumu('${studentId}', '${k.id}', this.value)" class="student-form-input min-h-[44px] text-xs">
                                ${Object.entries(ATTENDANCE_LABELS).map(([value, label]) => `<option value="${value}" ${katilimDurumu === value ? 'selected' : ''}>${label}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="text-xs font-bold text-gray-500 block mb-1" for="mobile-payment-${k.id}">Ücret</label>
                            <select id="mobile-payment-${k.id}" onchange="updateDersUcretDurumu('${studentId}', '${k.id}', this.value)" ${katilimDurumu !== 'yapildi' ? 'disabled' : ''} class="student-form-input min-h-[44px] text-xs">
                                ${katilimDurumu !== 'yapildi' ? '<option value="not-billable">Ücret Yok</option>' : `<option value="pending" ${!k.odendi ? 'selected' : ''}>Bekliyor</option><option value="paid" ${k.odendi ? 'selected' : ''}>Ödendi</option>`}
                            </select>
                        </div>
                    </div>
                    ${k.icerik ? `<div class="bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-lg border text-gray-700 dark:text-gray-300"><strong>İçerik:</strong> ${escapeHtml(k.icerik)}</div>` : ''}
                    <div class="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-2.5 border">${homeworkSummary}${legacyHomeworkHtml}</div>
                    <div class="flex gap-2 pt-1">
                        <button onclick="openHomeworkForLesson('${studentId}', '${k.id}')" class="btn-secondary flex-1 min-h-[44px] text-xs"><i class="fas fa-tasks mr-1"></i> Ödev</button>
                        <button onclick="toggleDersKayitEditor('${k.id}')" class="btn-secondary flex-1 min-h-[44px] text-xs"><i class="fas fa-edit mr-1"></i> Düzenle</button>
                        <button onclick="deleteDersKayit('${studentId}', ${k.dersNo})" class="min-w-[44px] min-h-[44px] rounded-xl border border-red-200 text-red-500 text-sm flex items-center justify-center" aria-label="Ders kaydını sil"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </article>`;
    }

    const dersUcreti = parseFloat(student.dersUcreti) || parseFloat(student.aylikUcret) || parseFloat(student.ucret) || 0;
    const lessonSummary = getDersOzet(studentId, dersUcreti);
    
    const countSummaryText = kayitlar.length === 0
        ? 'Henüz ders kaydı yok'
        : displayKayitlar.length === kayitlar.length
            ? `Toplam ${kayitlar.length} ders kaydı`
            : `${kayitlar.length} dersten ${displayKayitlar.length} tanesi gösteriliyor`;

    const emptyTableContent = kayitlar.length === 0
        ? '<tr><td colspan="7" class="text-center p-8 text-gray-500 font-medium">Henüz ders kaydı bulunmuyor.<br><span class="text-xs text-gray-400">İlk ders kaydını eklediğinizde geçmiş burada görünecek.</span></td></tr>'
        : searchQuery
            ? '<tr><td colspan="7" class="text-center p-6 text-gray-500 font-medium"><i class="fas fa-search mr-1"></i> Bu aramaya uygun ders kaydı bulunamadı.</td></tr>'
            : '<tr><td colspan="7" class="text-center p-6 text-gray-500 font-medium"><i class="fas fa-calendar-times mr-1"></i> Bu dönem için ders kaydı bulunamadı.</td></tr>';

    const emptyMobileContent = kayitlar.length === 0
        ? '<div class="app-panel p-6 text-center text-gray-500 font-medium">Henüz ders kaydı bulunmuyor.<br><span class="text-xs text-gray-400">İlk ders kaydını eklediğinizde geçmiş burada görünecek.</span></div>'
        : searchQuery
            ? '<div class="app-panel p-6 text-center text-gray-500 font-medium"><i class="fas fa-search mr-1"></i> Bu aramaya uygun ders kaydı bulunamadı.</div>'
            : '<div class="app-panel p-6 text-center text-gray-500 font-medium"><i class="fas fa-calendar-times mr-1"></i> Bu dönem için ders kaydı bulunamadı.</div>';

    const html = `
        <div class="app-page space-y-4">
            <header class="app-page-header">
                <div>
                    <h2 class="app-page-title">${escapeHtml(student.adSoyad)}</h2>
                    <p class="app-page-subtitle">${countSummaryText} · Katılım ve ücret durumu</p>
                </div>
                <button onclick="${window._dersKayitOrigin === 'cockpit' ? `renderStudentCockpit('${studentId}', window._cockpitReturnOrigin || 'home')` : 'renderDersKayitlari()'}" class="bg-gray-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-1 font-semibold min-h-[44px]">
                    <i class="fas fa-arrow-left"></i> Geri
                </button>
            </header>

            <!-- Finance Summary Metrics -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div class="app-metric"><p class="app-metric-label">Toplam Ders</p><p class="app-metric-value">${lessonSummary.toplamDers}</p></div>
                <div class="app-metric"><p class="app-metric-label">Ücretli Ders</p><p class="app-metric-value">${lessonSummary.ucretlendirilenDersSayisi}</p></div>
                <div class="app-metric"><p class="app-metric-label">Ödenen</p><p class="app-metric-value text-emerald-600">${lessonSummary.odenenDersSayisi}</p></div>
                <div class="app-metric"><p class="app-metric-label">Tahsilat</p><p class="app-metric-value text-indigo-600">${lessonSummary.toplamOdeme} TL</p></div>
            </div>
            
            <!-- New Lesson Disclosure Form -->
            <details class="app-panel app-disclosure">
                <summary class="app-panel-header flex items-center justify-between gap-3"><div><h3 class="font-black"><i class="fas fa-plus-circle text-indigo-600 mr-1"></i> Yeni Ders Kaydı</h3><p class="text-xs text-gray-500 mt-1">Formu açmak için tıklayın</p></div><i class="fas fa-chevron-down disclosure-chevron text-gray-400"></i></summary>
                <div class="p-5">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input type="text" id="kayitTarih" inputmode="numeric" maxlength="10" placeholder="GG/AA/YYYY" aria-label="Ders tarihi (gün/ay/yıl)" oninput="formatLessonDateTyping(this)" class="student-form-input min-h-[44px]">
                    <select id="kayitDers" onchange="window.onDersKayitSubjectChanged('${effectiveSinif}')" class="student-form-input min-h-[44px]">
                        <option value="">Ders Seçin</option>
                        ${(store.teacherBranches || ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler"]).map(b => {
                            const displayName = (effectiveSinif === "8" && b === "Sosyal Bilgiler") ? "İnkılap Tarihi" : b;
                            return `<option value="${b}">${displayName}</option>`;
                        }).join('')}
                    </select>
                    <select id="kayitKonu" class="student-form-input min-h-[44px]">
                        <option value="">Konu Seç (Önce Ders Seçin)</option>
                    </select>
                    <input type="text" id="kayitIcerik" placeholder="Ders içeriği / kısa not" class="student-form-input min-h-[44px]">
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-semibold mb-1">Kaynak Kitap / Yayın</label>
                    <select id="kayitKaynak" onchange="toggleDersKayitManualResource()" class="student-form-input min-h-[44px]"><option value="">Önce ders seçin</option></select>
                    <div id="kayitKaynakManualArea" class="hidden mt-2"><input id="kayitKaynakManual" class="student-form-input min-h-[44px]" placeholder="Kaynağı manuel girin"></div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div>
                        <label class="block text-sm font-semibold mb-1">Katılım Durumu</label>
                        <select id="kayitKatilim" class="student-form-input min-h-[44px]">
                            ${Object.entries(ATTENDANCE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
                        </select>
                        <p class="mt-1 text-xs text-gray-500">Ders önceden giriliyorsa “Planlandı” olarak bırakın; ders sonrasında güncelleyin.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-1">Ödeme Durumu</label>
                        <select id="kayitOdendi" class="student-form-input min-h-[44px]">
                            <option value="true">Ödendi</option>
                            <option value="false" selected>Bekliyor</option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button onclick="addDersKayit('${studentId}')" class="btn-primary w-full px-5 py-3 min-h-[44px]">Ders Kaydını Kaydet</button>
                    </div>
                </div>
                </div>
            </details>

            <!-- Compact Search, Period Filter, and Sort Controls -->
            <div class="app-panel p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="flex items-center gap-2 flex-1">
                    <div class="relative flex-1 max-w-md">
                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                        <input type="text" id="lessonSearchInput" value="${escapeHtml(window._lessonSearchQuery || '')}" oninput="onLessonSearchInput('${studentId}', this.value)" placeholder="Ders kayıtlarında ara..." class="cf-input pl-8 py-1.5 text-xs w-full min-h-[38px]">
                    </div>
                    ${window._lessonSearchQuery ? `<button onclick="onLessonSearchInput('${studentId}', '')" class="text-gray-400 hover:text-gray-600 p-2 text-xs" title="Aramayı temizle"><i class="fas fa-times"></i></button>` : ''}
                </div>
                <div class="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                    <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                        <button type="button" onclick="setLessonPeriodFilter('${studentId}', 'all')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${currentPeriod === 'all' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}">Tümü (${kayitlar.length})</button>
                        <button type="button" onclick="setLessonPeriodFilter('${studentId}', 'month')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${currentPeriod === 'month' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}">Bu Ay</button>
                        <button type="button" onclick="setLessonPeriodFilter('${studentId}', '3months')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${currentPeriod === '3months' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}">Son 3 Ay</button>
                    </div>
                    <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                        <button type="button" onclick="setLessonSortOrder('${studentId}', 'newest')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${sortOrder === 'newest' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}" title="En yeni ders üstte"><i class="fas fa-sort-amount-down text-[10px] mr-1"></i> En Yeni</button>
                        <button type="button" onclick="setLessonSortOrder('${studentId}', 'oldest')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${sortOrder === 'oldest' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}" title="En eski ders üstte"><i class="fas fa-sort-amount-up text-[10px] mr-1"></i> En Eski</button>
                    </div>
                </div>
            </div>
            
            <!-- High-Density Desktop Compact Table View -->
            <div class="hidden md:block app-panel overflow-x-auto">
                <table class="app-data-table ders-kayitlari-table w-full">
                    <thead>
                        <tr>
                            <th class="w-12">#</th>
                            <th class="w-28">Tarih</th>
                            <th>Konu & Ders</th>
                            <th>İçerik / Not</th>
                            <th class="w-48">Katılım Durumu</th>
                            <th class="w-36">Durum (Ücret)</th>
                            <th class="w-12 text-center">Detay</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || emptyTableContent}
                    </tbody>
                </table>
            </div>

            <!-- Mobile Compact Card/List View -->
            <div class="md:hidden space-y-2.5">
                ${mobileCards || emptyMobileContent}
            </div>
        </div>`;
        
    document.getElementById("dynamic-content").innerHTML = html;
}

export function addDersKayit(studentId) {
    const tarihInput = document.getElementById("kayitTarih").value;
    const tarih = parseLessonDateInput(tarihInput);
    const ders = document.getElementById("kayitDers")?.value || "";
    const konu = document.getElementById("kayitKonu").value;
    const icerik = document.getElementById("kayitIcerik").value;
    const kaynak = readResourceSelection('kayitKaynak', 'kayitKaynakManual');
    const odendi = document.getElementById("kayitOdendi").value === "true";
    const katilimDurumu = document.getElementById("kayitKatilim")?.value || 'yapildi';
    
    if (!tarih || !ders || !konu) {
        alert("Lütfen tarihi GG/AA/YYYY biçiminde, ders ve konu alanlarını eksiksiz giriniz.");
        return;
    }
    
    let kayitlar = loadDersKayitlari(studentId);
    const yeniNo = kayitlar.length + 1;
    kayitlar.push({ id: `lesson_${studentId}_${Date.now()}`, dersNo: yeniNo, tarih, ders, konu, icerik, kaynak, odendi: katilimDurumu === 'yapildi' ? odendi : false, katilimDurumu });
    saveDersKayitlari(studentId, kayitlar);
    renderDersDetay(studentId);
}

export function toggleDersKayitEditor(lessonId, forceOpen) {
    const row = document.getElementById(`edit-row-${lessonId}`);
    const button = document.getElementById(`edit-toggle-${lessonId}`);
    if (!row) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : row.classList.contains('hidden');

    document.querySelectorAll('[id^="edit-row-"]').forEach(editor => editor.classList.add('hidden'));
    document.querySelectorAll('[id^="edit-toggle-"]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
    if (shouldOpen) {
        row.classList.remove('hidden');
        button?.setAttribute('aria-expanded', 'true');
        document.getElementById(`edit-date-${lessonId}`)?.focus();
    }
}

export function updateDersEditTopics(lessonId, sinif) {
    const subject = document.getElementById(`edit-subject-${lessonId}`)?.value || '';
    const topicSelect = document.getElementById(`edit-topic-${lessonId}`);
    if (!topicSelect) return;
    const topics = getKonuListesiBySinifAndDers(sinif, subject);
    topicSelect.replaceChildren(...topics.map(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        return option;
    }));
}

export function saveDersKayitEditor(studentId, lessonId) {
    const tarih = parseLessonDateInput(document.getElementById(`edit-date-${lessonId}`)?.value || '');
    const ders = document.getElementById(`edit-subject-${lessonId}`)?.value || '';
    const konu = document.getElementById(`edit-topic-${lessonId}`)?.value || '';
    const icerik = document.getElementById(`edit-content-${lessonId}`)?.value.trim() || '';
    const error = document.getElementById(`edit-error-${lessonId}`);

    if (!tarih || !ders || !konu) {
        if (error) {
            error.textContent = 'Tarih, ders ve konu alanlarını eksiksiz doldurun.';
            error.classList.remove('hidden');
        }
        return;
    }

    const kayitlar = loadDersKayitlari(studentId);
    const idx = kayitlar.findIndex(lesson => lesson.id === lessonId);
    if (idx === -1) return;
    kayitlar[idx] = { ...kayitlar[idx], tarih, ders, konu, icerik };
    saveDersKayitlari(studentId, kayitlar);
    renderDersDetay(studentId);
}

export function updateDersKatilimDurumu(studentId, lessonId, attendanceStatus) {
    const kayitlar = loadDersKayitlari(studentId);
    const idx = kayitlar.findIndex(lesson => lesson.id === lessonId);
    if (idx === -1) return;
    kayitlar[idx] = updateLessonAttendanceState(kayitlar[idx], attendanceStatus);
    saveDersKayitlari(studentId, kayitlar);
    renderDersDetay(studentId);
}

export function updateDersUcretDurumu(studentId, lessonId, paymentStatus) {
    const kayitlar = loadDersKayitlari(studentId);
    const idx = kayitlar.findIndex(lesson => lesson.id === lessonId);
    if (idx === -1) return;
    kayitlar[idx] = updateLessonPaymentState(kayitlar[idx], paymentStatus === 'paid');
    saveDersKayitlari(studentId, kayitlar);
    renderDersDetay(studentId);
}

export function deleteDersKayit(studentId, dersNo) {
    if (confirm("Bu ders kaydını silmek istediğinize emin misiniz?")) {
        let kayitlar = loadDersKayitlari(studentId);
        kayitlar = kayitlar.filter(k => k.dersNo !== dersNo);
        kayitlar = kayitlar.map((k, idx) => ({ ...k, dersNo: idx + 1 }));
        saveDersKayitlari(studentId, kayitlar);
        renderDersDetay(studentId);
    }
}

export function onDersKayitSubjectChanged(sinif) {
    const dersSelect = document.getElementById("kayitDers");
    const konuSelect = document.getElementById("kayitKonu");
    if (!dersSelect || !konuSelect) return;
    
    const selectedDers = dersSelect.value;
    if (!selectedDers) {
        konuSelect.innerHTML = '<option value="">Konu Seç (Önce Ders Seçin)</option>';
        return;
    }
    
    const konular = getKonuListesiBySinifAndDers(sinif, selectedDers);
    konuSelect.innerHTML = '<option value="">Konu Seç</option>' + konular.map(k => `<option value="${k}">${k}</option>`).join('');
    const resourceSelect = document.getElementById('kayitKaynak');
    if (resourceSelect) resourceSelect.innerHTML = resourceOptionsHtml(sinif, selectedDers, escapeHtml);
    toggleManualResource('kayitKaynak', 'kayitKaynakManualArea');
}

export function toggleDersKayitManualResource() {
    toggleManualResource('kayitKaynak', 'kayitKaynakManualArea');
}

export function openHomeworkForLesson(studentId, lessonId) {
    const lesson = loadDersKayitlari(studentId).find(record => record.id === lessonId);
    if (!lesson || !window.renderOdevAtaModal) return;

    window._geciciOdevListesi = [];
    window.renderOdevAtaModal([studentId], {
        lessonId: lesson.id,
        dersNo: lesson.dersNo,
        tarih: lesson.tarih,
        ders: lesson.ders,
        konu: lesson.konu,
        kaynak: lesson.kaynak || ''
    });
}

// Bind to window for global accessibility
window.renderFinanceReport = renderFinanceReport;
window.renderDersKayitlari = renderDersKayitlari;
window.renderDersDetay = renderDersDetay;
window.addDersKayit = addDersKayit;
window.toggleDersKayitEditor = toggleDersKayitEditor;
window.updateDersEditTopics = updateDersEditTopics;
window.saveDersKayitEditor = saveDersKayitEditor;
window.deleteDersKayit = deleteDersKayit;
window.updateDersKatilimDurumu = updateDersKatilimDurumu;
window.updateDersUcretDurumu = updateDersUcretDurumu;
window.onDersKayitSubjectChanged = onDersKayitSubjectChanged;
window.toggleDersKayitManualResource = toggleDersKayitManualResource;
window.openHomeworkForLesson = openHomeworkForLesson;
window.formatLessonDateTyping = formatLessonDateTyping;
window.toggleLessonRowDetail = toggleLessonRowDetail;
window.setLessonPeriodFilter = setLessonPeriodFilter;
window.setLessonSortOrder = setLessonSortOrder;
window.onLessonSearchInput = onLessonSearchInput;
