// ==================== EXAM ANALYSIS & MANAGEMENT MODULE ====================

import { db, auth, isFirebaseActive } from './firebase-config.js';
import { store, loadStudentsData, saveStudentsData, getKonuListesiBySinif, getKonuListesiBySinifAndDers, CURRICULUM_UNITS, GENEL_DERSLER_GORUNUM, GENEL_DERSLER_KEY, HATA_KODLARI, POPULER_LISELER, getErrorColor, calculateNet, escapeHtml, loadSchedule, loadDersKayitlari, getStudentOdevler, addStudentArrayRecord, updateStudentArrayRecord, deleteStudentArrayRecord, bulkAddStudentExam, OFFLINE_BLOCKED_ARRAY_MESSAGE } from './store.js';
import { showSyncStatus } from './ui-helpers.js';
import { MANUAL_RESOURCE_VALUE, readResourceSelection, resourceOptionsHtml, toggleManualResource } from './resource-books.js';

// Global state for deneme assignment
let denemeAtaMode = "branş";
let batchBransSoruSayisi = 0;
let batchGenelDersSayilari = {};

export function getKonuBazliBasarilar(ogrenci) {
    const konuList = getKonuListesiBySinif(ogrenci.sinif);
    const stats = {};
    konuList.forEach(k => stats[k] = { dogru: 0, toplamSoru: 0 });
    if (!ogrenci.denemeler) return stats;
    for (let den of ogrenci.denemeler) {
        if (den.tip === "genel") continue;
        for (let soru of den.sorular) {
            const konu = soru.konuAdi;
            if (stats[konu]) {
                stats[konu].toplamSoru++;
                if (soru.durum === "dogru") stats[konu].dogru++;
            }
        }
    }
    const basari = {};
    for (let k of konuList) {
        basari[k] = stats[k].toplamSoru ? (stats[k].dogru / stats[k].toplamSoru) * 100 : null;
    }
    return basari;
}

export function getOrtalamaNet(ogrenci) {
    const d = ogrenci.denemeler || [];
    if (!d.length) return 0;
    const toplam = d.reduce((s, e) => s + (e.toplamNet || 0), 0);
    return parseFloat((toplam / d.length).toFixed(2));
}

export function getBransOrtalamaNet(ogrenci) {
    const br = (ogrenci.denemeler || []).filter(d => d.tip === "branş");
    if (!br.length) return null;
    return parseFloat((br.reduce((s, d) => s + d.toplamNet, 0) / br.length).toFixed(2));
}

export function getGenelOrtalamaNet(ogrenci) {
    const gn = (ogrenci.denemeler || []).filter(d => d.tip === "genel");
    if (!gn.length) return null;
    return parseFloat((gn.reduce((s, d) => s + d.toplamNet, 0) / gn.length).toFixed(2));
}

export function getBestWorstTopics(b) {
    const entries = Object.entries(b).filter(([_, v]) => v !== null);
    if (!entries.length) return { zayif: [], guclu: [] };
    const sorted = [...entries].sort((a, b) => a[1] - b[1]);
    return {
        zayif: sorted.slice(0, 3).map(([k, v]) => ({ konu: k, yuzde: v.toFixed(1) })),
        guclu: sorted.slice(-3).reverse().map(([k, v]) => ({ konu: k, yuzde: v.toFixed(1) }))
    };
}

export function getMotivationMessage(s) {
    const d = s.denemeler || [];
    if (!d.length) return "📝 İlk denemeyi ekleyin";
    const sonNet = d[d.length - 1].toplamNet;
    const hedef = parseFloat(s.hedefNet);
    if (isNaN(hedef)) return "🎯 Hedef net belirtilmemiş";
    const fark = hedef - sonNet;
    if (fark <= 0) return "🎉 Hedefine ulaştın!";
    if (fark <= 2) return `🚀 Hedefine ${fark.toFixed(1)} net kaldı`;
    if (fark <= 5) return `💪 ${fark.toFixed(1)} net kaldı`;
    return `📈 Hedefine ${fark.toFixed(1)} net var.`;
}

export function getHataIstatistikleri(ogrenci) {
    const hataSayilari = {};
    HATA_KODLARI.forEach(h => hataSayilari[h.kod] = 0);
    let toplamHata = 0;
    if (!ogrenci.denemeler) return { hataSayilari, toplamHata };
    for (let den of ogrenci.denemeler) {
        if (den.tip === "genel") continue;
        for (let soru of den.sorular) {
            if ((soru.durum === "yanlis" || soru.durum === "bos") && soru.hataKodu) {
                hataSayilari[soru.hataKodu]++;
                toplamHata++;
            }
        }
    }
    return { hataSayilari, toplamHata };
}

export function lgsPuanHesapla(genelDenemeler) {
    if (!genelDenemeler || genelDenemeler.length === 0) return null;
    let toplamPuan = 0;
    for (let den of genelDenemeler) {
        let examPuan = 177.8;
        if (den.dersSonuclari && Object.keys(den.dersSonuclari).length > 0) {
            let netMat = calculateNet(den.dersSonuclari["Matematik"]?.dogru || 0, den.dersSonuclari["Matematik"]?.yanlis || 0);
            let netFen = calculateNet(den.dersSonuclari["Fen Bilimleri"]?.dogru || 0, den.dersSonuclari["Fen Bilimleri"]?.yanlis || 0);
            let netTur = calculateNet(den.dersSonuclari["Türkçe"]?.dogru || 0, den.dersSonuclari["Türkçe"]?.yanlis || 0);
            let netSos = calculateNet(den.dersSonuclari["İnkılap Tarihi ve Sosyal Bilgiler"]?.dogru || 0, den.dersSonuclari["İnkılap Tarihi ve Sosyal Bilgiler"]?.yanlis || 0);
            if (den.dersSonuclari["İnkılap Tarihi / Sosyal Bilgiler"]) {
                netSos = calculateNet(den.dersSonuclari["İnkılap Tarihi / Sosyal Bilgiler"]?.dogru || 0, den.dersSonuclari["İnkılap Tarihi / Sosyal Bilgiler"]?.yanlis || 0);
            }
            let netDin = calculateNet(den.dersSonuclari["Din Kültürü ve Ahlak Bilgisi"]?.dogru || 0, den.dersSonuclari["Din Kültürü ve Ahlak Bilgisi"]?.yanlis || 0);
            let netIng = calculateNet(den.dersSonuclari["Yabancı Dil (İngilizce)"]?.dogru || 0, den.dersSonuclari["Yabancı Dil (İngilizce)"]?.yanlis || 0);

            examPuan += (netTur * 4.53) + (netMat * 4.65) + (netFen * 4.12) + (netSos * 1.94) + (netDin * 1.99) + (netIng * 1.69);
        } else {
            examPuan += den.toplamNet * 3.58;
        }
        toplamPuan += examPuan;
    }
    return Math.min(500, Math.max(100, Math.round(toplamPuan / genelDenemeler.length)));
}

export function showDenemeAtaModal(preSelectedStudentId = null) {
    denemeAtaMode = "branş";
    batchBransSoruSayisi = 0;
    batchGenelDersSayilari = {};
    GENEL_DERSLER_KEY.forEach(d => batchGenelDersSayilari[d] = 0);
    renderDenemeAtaModal(preSelectedStudentId);
}

export function renderDenemeAtaModal(preSelectedStudentId = null) {
    const students = loadStudentsData();
    const studentCheckboxes = students.map(s => `
        <label class="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition">
            <input type="checkbox" value="${s.id}" data-grade="${escapeHtml(s.sinif || '')}" ${s.id === preSelectedStudentId ? 'checked' : ''} class="studentCheck rounded border-gray-300 dark:border-gray-650 text-blue-600">
            <span class="text-sm font-medium text-gray-805 dark:text-gray-200">${escapeHtml(s.adSoyad)} (${escapeHtml(s.okul)}${s.sinif ? ', ' + s.sinif + '. sınıf' : ''})</span>
        </label>
    `).join('');

    const bransHtml = `
        <div id="bransSecim" class="${denemeAtaMode === 'branş' ? '' : 'hidden'}">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Sınıf</label>
                    <select id="bransSinif" onchange="updateTopicExamOptions()" class="student-form-input min-h-[44px]"><option value="">Sınıf seçin</option>${['5','6','7','8'].map(grade => `<option value="${grade}">${grade}. Sınıf</option>`).join('')}</select>
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Ders</label>
                    <select id="bransDers" onchange="updateTopicExamOptions()" class="student-form-input min-h-[44px]">
                        ${(store.teacherBranches || ['Türkçe', 'Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler']).map(ders => `<option value="${escapeHtml(ders)}">${escapeHtml(ders)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Konu</label>
                    <select id="bransKonuAdi" onchange="toggleTopicExamManualTopic()" class="student-form-input min-h-[44px]"><option value="">Önce sınıf seçin</option></select>
                    <div id="bransKonuManualArea" class="hidden mt-2"><input type="text" id="bransKonuManual" placeholder="Konuyu manuel girin" class="student-form-input min-h-[44px]"></div>
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Kaynak Kitap / Yayın</label>
                    <select id="bransKaynak" onchange="toggleTopicExamManualResource()" class="student-form-input min-h-[44px]"><option value="">Önce sınıf ve ders seçin</option></select>
                    <div id="bransKaynakManualArea" class="hidden mt-2"><input type="text" id="bransKaynakManual" placeholder="Kaynağı manuel girin" class="student-form-input min-h-[44px]"></div>
                </div>
            </div>
            <div class="mb-3">
                <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Toplam Soru Sayısı</label>
                <input type="number" id="bransSoruSayisi" min="1" value="${batchBransSoruSayisi || 1}" class="student-form-input min-h-[44px]">
            </div>
        </div>
    `;

    let genelDersHtml = `
        <div id="genelSecim" class="${denemeAtaMode === 'genel' ? '' : 'hidden'}">
            <div class="mb-2 font-bold text-sm text-gray-700 dark:text-gray-300">Ders Bazında Soru Sayıları:</div>
    `;
    for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
        const dersKey = GENEL_DERSLER_KEY[i];
        const dersGorunum = GENEL_DERSLER_GORUNUM[i];
        genelDersHtml += `
            <div class="mb-2 flex items-center gap-3">
                <label class="w-48 text-sm font-semibold">${dersGorunum}</label>
                <input type="number" min="0" value="${batchGenelDersSayilari[dersKey] || 0}" class="w-24 border-2 rounded-xl p-2 focus:ring-4 focus:ring-indigo-200 outline-none genelDersInput min-h-[44px]" data-ders="${dersKey}">
            </div>
        `;
    }
    genelDersHtml += `</div>`;

    const modalHtml = `
        <div id="denemeAtaModal" class="app-modal-backdrop" onclick="if(event.target===this) closeDenemeAtaModal()">
            <div class="app-modal max-w-2xl" onclick="event.stopPropagation()">
                <div class="app-modal-header">
                    <div><h2 class="app-page-title text-xl">Deneme Ata</h2><p class="app-page-subtitle">Konu veya genel denemeyi birden fazla öğrenciye tek işlemde atayın.</p></div>
                    <button onclick="closeDenemeAtaModal()" class="app-modal-close" aria-label="Pencereyi kapat"><i class="fas fa-times text-lg"></i></button>
                </div>
                <div class="app-modal-body">
                <div class="app-segmented mb-5">
                    <button id="tabBransBtn" class="${denemeAtaMode === 'branş' ? 'is-active' : ''}"><i class="fas fa-flask mr-1"></i> Konu Denemesi</button>
                    <button id="tabGenelBtn" class="${denemeAtaMode === 'genel' ? 'is-active' : ''}"><i class="fas fa-layer-group mr-1"></i> Genel Deneme</button>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Deneme Adı</label>
                    <input id="denemeAtaExamName" class="student-form-input min-h-[44px]" placeholder="Örn: Mart Denemesi">
                </div>
                ${bransHtml}
                ${genelDersHtml}
                <div class="mt-3">
                    <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Öğrencileri seç</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-auto border p-3 rounded-xl bg-gray-50 dark:bg-gray-900">${studentCheckboxes}</div>
                </div>
                <button id="saveDenemeAtaBtn" class="btn-primary mt-4 w-full py-3 min-h-[44px]"><i class="fas fa-check mr-1"></i> Seçilen Öğrencilere Ata</button>
                </div>
            </div>
        </div>
    `;

    const existing = document.getElementById('denemeAtaModal');
    if (existing) existing.remove();
    const modalDiv = document.createElement('div');
    modalDiv.id = 'denemeAtaModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);

    if (preSelectedStudentId) {
        const selectedStudent = students.find(student => student.id === preSelectedStudentId);
        const gradeSelect = document.getElementById('bransSinif');
        if (selectedStudent && gradeSelect) {
            gradeSelect.value = selectedStudent.sinif || '';
            window.updateTopicExamOptions?.();
        }
    }

    document.getElementById('tabBransBtn').addEventListener('click', () => {
        denemeAtaMode = 'branş';
        document.getElementById('bransSecim').classList.remove('hidden');
        document.getElementById('genelSecim').classList.add('hidden');
        document.getElementById('tabBransBtn').classList.add('is-active');
        document.getElementById('tabGenelBtn').classList.remove('is-active');
    });
    document.getElementById('tabGenelBtn').addEventListener('click', () => {
        denemeAtaMode = 'genel';
        document.getElementById('bransSecim').classList.add('hidden');
        document.getElementById('genelSecim').classList.remove('hidden');
        document.getElementById('tabGenelBtn').classList.add('is-active');
        document.getElementById('tabBransBtn').classList.remove('is-active');
    });
    document.getElementById('saveDenemeAtaBtn').addEventListener('click', () => saveDenemeAta());
    updateTopicExamOptions();
}

export function updateTopicExamOptions() {
    const grade = document.getElementById('bransSinif')?.value || '';
    const subject = document.getElementById('bransDers')?.value || '';
    const topicSelect = document.getElementById('bransKonuAdi');
    if (topicSelect) topicSelect.innerHTML = '<option value="">Konu seçin</option>' + getKonuListesiBySinifAndDers(grade, subject).map(topic => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join('') + `<option value="${MANUAL_RESOURCE_VALUE}">✍️ Manuel gir</option>`;
    const resourceSelect = document.getElementById('bransKaynak');
    if (resourceSelect) resourceSelect.innerHTML = resourceOptionsHtml(grade, subject, escapeHtml);
    document.querySelectorAll('.studentCheck').forEach(checkbox => {
        const matches = !grade || String(checkbox.dataset.grade) === String(grade);
        checkbox.closest('label')?.classList.toggle('hidden', !matches);
        if (!matches) checkbox.checked = false;
    });
    toggleTopicExamManualTopic();
    toggleManualResource('bransKaynak', 'bransKaynakManualArea');
}

export function toggleTopicExamManualTopic() {
    const isManual = document.getElementById('bransKonuAdi')?.value === MANUAL_RESOURCE_VALUE;
    document.getElementById('bransKonuManualArea')?.classList.toggle('hidden', !isManual);
}

export function toggleTopicExamManualResource() {
    toggleManualResource('bransKaynak', 'bransKaynakManualArea');
}

export function closeDenemeAtaModal() {
    document.getElementById('denemeAtaModal')?.remove();
}

export async function saveDenemeAta() {
    const examName = document.getElementById('denemeAtaExamName')?.value.trim();
    if (!examName) {
        alert("Deneme adı girin");
        return;
    }
    const selectedStudents = Array.from(document.querySelectorAll('.studentCheck:checked')).map(cb => cb.value);
    if (selectedStudents.length === 0) {
        alert("En az bir öğrenci seçin");
        return;
    }
    let sorular = [], tip = "";
    if (denemeAtaMode === 'branş') {
        const soruSayisi = parseInt(document.getElementById('bransSoruSayisi')?.value) || 0;
        const ders = document.getElementById('bransDers')?.value || '';
        const grade = document.getElementById('bransSinif')?.value || '';
        const selectedTopic = document.getElementById('bransKonuAdi')?.value || '';
        const konu = selectedTopic === MANUAL_RESOURCE_VALUE ? document.getElementById('bransKonuManual')?.value.trim() || '' : selectedTopic;
        const kaynak = readResourceSelection('bransKaynak', 'bransKaynakManual');
        if (!grade || !ders || !konu || !kaynak) {
            alert("Konu denemesi için sınıf, ders, konu ve kaynak bilgilerini girin");
            return;
        }
        if (soruSayisi < 1) {
            alert("En az 1 soru olmalı");
            return;
        }
        for (let i = 0; i < soruSayisi; i++) {
            sorular.push({ soruNo: i + 1, konuAdi: konu, durum: "bos", hataKodu: null });
        }
        tip = "branş";
    } else {
        let dersList = [];
        for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
            const dersKey = GENEL_DERSLER_KEY[i];
            const adet = parseInt(document.querySelector(`.genelDersInput[data-ders="${dersKey}"]`)?.value) || 0;
            if (adet > 0) dersList.push({ ders: dersKey, adet });
        }
        if (dersList.length === 0) {
            alert("En az bir ders için soru sayısı girin");
            return;
        }
        let soruNo = 1;
        for (let item of dersList) {
            for (let i = 0; i < item.adet; i++) {
                sorular.push({ soruNo: soruNo++, konuAdi: item.ders, durum: "bos", hataKodu: null });
            }
        }
        tip = "genel";
    }

    const newExam = {
        id: "ex_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        denemeAdi: examName,
        tarih: new Date().toISOString().slice(0, 10),
        tip: tip,
        sorular: sorular,
        toplamDogru: 0,
        toplamYanlis: 0,
        toplamBos: sorular.length,
        toplamNet: 0,
        toplamSoru: sorular.length
    };
    if (tip === 'branş') {
        newExam.ders = document.getElementById('bransDers')?.value || '';
        newExam.sinif = document.getElementById('bransSinif')?.value || '';
        newExam.konu = sorular[0]?.konuAdi || '';
        newExam.kaynak = readResourceSelection('bransKaynak', 'bransKaynakManual');
    }

    if (tip === "genel") {
        newExam.dersBilgileri = [];
        newExam.dersSonuclari = {};
        const dersMap = {};
        for (let s of sorular) dersMap[s.konuAdi] = (dersMap[s.konuAdi] || 0) + 1;
        for (let d in dersMap) {
            newExam.dersBilgileri.push({ ders: d, adet: dersMap[d] });
            newExam.dersSonuclari[d] = { dogru: 0, yanlis: 0, bos: dersMap[d] };
        }
    }

    const isCloud = Boolean(store.useFirestore && window.isFirebaseActive && window.db && !store.isGuestMode);
    if (!isCloud) {
        const students = loadStudentsData();
        for (let sid of selectedStudents) {
            const idx = students.findIndex(s => s.id === sid);
            if (idx !== -1) {
                if (!students[idx].denemeler) students[idx].denemeler = [];
                students[idx].denemeler.push(JSON.parse(JSON.stringify(newExam)));
            }
        }
        saveStudentsData(students);
        alert(`${selectedStudents.length} öğrenciye deneme başarıyla eklendi.`);
    } else {
        const bulkRes = await bulkAddStudentExam(selectedStudents, newExam);
        const hasOfflineBlocked = Array.isArray(bulkRes.results) && bulkRes.results.some(r => r.blockedOffline);
        if (hasOfflineBlocked) {
            const blockedMsg = bulkRes.results.find(r => r.blockedOffline)?.message || OFFLINE_BLOCKED_ARRAY_MESSAGE;
            alert(blockedMsg);
            return;
        }
        if (bulkRes.failedCount > 0) {
            alert(`${bulkRes.successCount}/${bulkRes.totalCount} öğrenciye deneme eklendi. ${bulkRes.failedCount} öğrencide hata oluştu.`);
        } else {
            alert(`${bulkRes.successCount} öğrenciye deneme başarıyla eklendi.`);
        }
    }
    closeDenemeAtaModal();
    if (window.renderHomeScreen) window.renderHomeScreen();
}

// Active state for branch exam editing (Fen and non-Fen)
let activeExamState = null;

export function goToFenHataAnaliziStep(studentId, examId) {
    if (!activeExamState) return;
    const nameInput = document.getElementById('editExamName');
    if (nameInput) activeExamState.denemeAdi = nameInput.value.trim();

    // Read current statuses from DOM into activeExamState
    activeExamState.sorular.forEach((soru, idx) => {
        const durumInput = document.querySelector(`.durum-select[data-index="${idx}"]`);
        if (durumInput) soru.durum = durumInput.value;
    });

    const wrongAndBlank = activeExamState.sorular.filter(s => s.durum === 'yanlis' || s.durum === 'bos');
    if (wrongAndBlank.length === 0) {
        saveBransExamEdit(studentId, examId);
        return;
    }

    activeExamState.currentStep = 2;
    if (window._renderFenStep2) window._renderFenStep2();
}

export function goToFenStep1(studentId, examId) {
    if (!activeExamState) return;
    // Save any selected topics / error codes from Step 2
    activeExamState.sorular.forEach((soru, idx) => {
        if (soru.durum === 'yanlis' || soru.durum === 'bos') {
            const konuSelect = document.querySelector(`.fen-konu-select[data-index="${idx}"]`);
            const hataSelect = document.querySelector(`.fen-hata-select[data-index="${idx}"]`);
            if (konuSelect && konuSelect.value) soru.konuAdi = konuSelect.value.trim();
            if (hataSelect && hataSelect.value) soru.hataKodu = hataSelect.value.trim();
        }
    });
    activeExamState.currentStep = 1;
    if (window._renderFenStep1) window._renderFenStep1();
}

export function onFenSelectChange(idx) {
    const card = document.getElementById(`fen-card-${idx}`);
    const konuSelect = document.querySelector(`.fen-konu-select[data-index="${idx}"]`);
    const hataSelect = document.querySelector(`.fen-hata-select[data-index="${idx}"]`);
    const konu = konuSelect ? konuSelect.value.trim() : "";
    const hata = hataSelect ? hataSelect.value.trim() : "";
    if (activeExamState?.sorular?.[idx]) {
        activeExamState.sorular[idx].konuAdi = konu;
        activeExamState.sorular[idx].hataKodu = hata || null;
    }
    if (card && konu && hata) {
        card.classList.remove('border-red-500', 'bg-red-50/20', 'dark:bg-red-950/20');
        const alertBox = document.getElementById('fenValidationAlert');
        if (alertBox && !document.querySelector('.fen-hata-karti.border-red-500')) {
            alertBox.classList.add('hidden');
            alertBox.classList.remove('flex');
            alertBox.textContent = '';
        }
    }
}

export async function saveFenExamWithAnalysis(studentId, examId) {
    if (!activeExamState) return;
    let missingCount = 0;
    let firstMissingCard = null;

    activeExamState.sorular.forEach((soru, idx) => {
        if (soru.durum === 'yanlis' || soru.durum === 'bos') {
            const card = document.getElementById(`fen-card-${idx}`);
            const konuSelect = document.querySelector(`.fen-konu-select[data-index="${idx}"]`);
            const hataSelect = document.querySelector(`.fen-hata-select[data-index="${idx}"]`);
            const konu = konuSelect ? konuSelect.value.trim() : "";
            const hata = hataSelect ? hataSelect.value.trim() : "";

            if (!konu || !hata) {
                missingCount++;
                if (card) {
                    card.classList.add('border-red-500', 'bg-red-50/20', 'dark:bg-red-950/20');
                    if (!firstMissingCard) firstMissingCard = card;
                }
            } else {
                if (card) {
                    card.classList.remove('border-red-500', 'bg-red-50/20', 'dark:bg-red-950/20');
                }
                soru.konuAdi = konu;
                soru.hataKodu = hata;
            }
        }
    });

    const alertBox = document.getElementById('fenValidationAlert');
    if (missingCount > 0) {
        const msg = `${missingCount} hata kaydı eksik. Lütfen işaretli sorular için konu ve hata nedenini seçin.`;
        if (alertBox) {
            alertBox.textContent = msg;
            alertBox.classList.remove('hidden');
            alertBox.classList.add('flex');
        }
        alert(msg);
        if (firstMissingCard && typeof firstMissingCard.scrollIntoView === 'function') {
            firstMissingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    if (alertBox) {
        alertBox.classList.add('hidden');
        alertBox.classList.remove('flex');
    }

    await saveBransExamEdit(studentId, examId);
}

/**
 * Determines whether a given exam is a Science ("Fen Bilimleri") branch exam.
 * Supports canonical new records (exam.ders === 'Fen Bilimleri') and provides
 * safe read-time compatibility for legacy branch exams where exam.ders is undefined/missing.
 *
 * @param {Object} exam
 * @param {Object} [student]
 * @returns {boolean}
 */
export function isFenBranchExam(exam, student) {
    if (!exam || exam.tip !== 'branş') return false;

    // A. Primary / Canonical Check
    if (exam.ders === 'Fen Bilimleri') return true;

    // B. Legacy Fallback (only when exam.ders is falsy / empty / legacy)
    if (!exam.ders) {
        const grade = String(exam.sinif || student?.sinif || '8').trim();
        const canonicalFenTopics = getKonuListesiBySinifAndDers(grade, 'Fen Bilimleri');
        const normalize = (s) => String(s || '').trim().toLocaleLowerCase('tr-TR');

        const fenSet = new Set((Array.isArray(canonicalFenTopics) ? canonicalFenTopics : []).map(normalize));

        // Also include grade-specific Fen curriculum units and unit topics from CURRICULUM_UNITS
        const gradeUnits = (typeof CURRICULUM_UNITS !== 'undefined' && CURRICULUM_UNITS?.[grade]?.['Fen Bilimleri']) || [];
        for (const u of gradeUnits) {
            if (u.unite) fenSet.add(normalize(u.unite));
            if (Array.isArray(u.konular)) {
                for (const k of u.konular) fenSet.add(normalize(k));
            }
        }

        // Fallback to Grade 8 Fen set if grade-specific set is empty
        if (fenSet.size === 0) {
            const fallback8 = getKonuListesiBySinifAndDers('8', 'Fen Bilimleri');
            if (Array.isArray(fallback8)) fallback8.forEach(t => fenSet.add(normalize(t)));
            const fallbackUnits = (typeof CURRICULUM_UNITS !== 'undefined' && CURRICULUM_UNITS?.['8']?.['Fen Bilimleri']) || [];
            for (const u of fallbackUnits) {
                if (u.unite) fenSet.add(normalize(u.unite));
                if (Array.isArray(u.konular)) {
                    for (const k of u.konular) fenSet.add(normalize(k));
                }
            }
        }

        // Check 1: exam.konu
        if (exam.konu) {
            const normKonu = normalize(exam.konu);
            if (normKonu && fenSet.has(normKonu)) {
                return true;
            }
        }

        // Check 2: questions topic evidence (sorular[].konuAdi)
        if (Array.isArray(exam.sorular) && exam.sorular.length > 0) {
            const hasMatchingTopic = exam.sorular.some(s => {
                const normSoruKonu = normalize(s.konuAdi);
                return normSoruKonu && fenSet.has(normSoruKonu);
            });
            if (hasMatchingTopic) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Pure, read-only helper to determine the question indices of the Science ("Fen Bilimleri")
 * section in a general exam. Uses exam.dersBilgileri order and counts, with safe fallback
 * to checking exam.sorular[].konuAdi.
 *
 * @param {Object} exam
 * @returns {number[]} Array of 0-based question indices in exam.sorular
 */
export function getGeneralExamFenQuestionIndexes(exam) {
    if (!exam || exam.tip !== 'genel') return [];
    const indices = [];
    const dersBilgileri = Array.isArray(exam.dersBilgileri) ? exam.dersBilgileri : [];
    const fenIndex = dersBilgileri.findIndex(d => d.ders === 'Fen Bilimleri');

    if (fenIndex !== -1) {
        let start = 0;
        for (let i = 0; i < fenIndex; i++) {
            start += Number(dersBilgileri[i].adet || 0);
        }
        const count = Number(dersBilgileri[fenIndex].adet || 0);
        for (let i = start; i < start + count; i++) {
            indices.push(i);
        }
        return indices;
    }

    // Fallback: search exam.sorular for 'Fen Bilimleri' or canonical Fen topics
    if (Array.isArray(exam.sorular)) {
        exam.sorular.forEach((q, idx) => {
            if (q && (q.konuAdi === 'Fen Bilimleri' || q.ders === 'Fen Bilimleri')) {
                indices.push(idx);
            }
        });
    }
    return indices;
}

/**
 * Pure, read-only helper to extract the Science ("Fen Bilimleri") question objects
 * from a general exam.
 *
 * @param {Object} exam
 * @returns {Object[]} Array of question objects
 */
export function getGeneralExamFenQuestions(exam) {
    if (!exam || !Array.isArray(exam.sorular)) return [];
    const indices = getGeneralExamFenQuestionIndexes(exam);
    return indices.map(idx => exam.sorular[idx]).filter(Boolean);
}

if (typeof window !== 'undefined') {
    window.getGeneralExamFenQuestionIndexes = getGeneralExamFenQuestionIndexes;
    window.getGeneralExamFenQuestions = getGeneralExamFenQuestions;
}

export function editBransExam(studentId, examId, exam) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const isFenExam = isFenBranchExam(exam, student);
    const studentGrade = exam.sinif || student.sinif || '8';

    activeExamState = {
        studentId,
        examId,
        isFenExam,
        sinif: studentGrade,
        denemeAdi: exam.denemeAdi || '',
        currentStep: 1,
        sorular: (exam.sorular || []).map((s, idx) => ({
            soruNo: s.soruNo || (idx + 1),
            durum: s.durum || 'bos',
            konuAdi: s.konuAdi || exam.konu || '',
            hataKodu: s.hataKodu || null
        }))
    };
    window._activeBransState = activeExamState;

    function updateEditFooter() {
        let totalDogru = 0, totalYanlis = 0, totalBos = 0;
        const soruSayisi = activeExamState ? activeExamState.sorular.length : (exam.sorular ? exam.sorular.length : 0);
        for (let i = 0; i < soruSayisi; i++) {
            const durumSelect = document.querySelector(`.durum-select[data-index="${i}"]`);
            const durum = durumSelect ? durumSelect.value : (activeExamState?.sorular?.[i]?.durum || 'bos');
            if (durum === 'dogru') totalDogru++;
            else if (durum === 'yanlis') totalYanlis++;
            else totalBos++;
        }
        const net = calculateNet(totalDogru, totalYanlis);
        const footer = document.getElementById('editFooter');
        if (footer) {
            footer.innerHTML = `<span>Toplam: ${soruSayisi} soru · D:${totalDogru} · Y:${totalYanlis} · B:${totalBos}</span><span class="text-indigo-600 dark:text-indigo-400">Net: ${net.toFixed(2)}</span>`;
        }

        if (isFenExam) {
            const ctaContainer = document.getElementById('fenStep1CtaContainer');
            if (ctaContainer) {
                if (totalYanlis + totalBos === 0) {
                    ctaContainer.innerHTML = `<button type="button" id="btnFenStep1Action" onclick="saveBransExamEdit('${studentId}', '${examId}')" class="btn-primary mt-4 w-full py-3 min-h-[44px]"><i class="fas fa-save mr-1"></i> Sonucu Kaydet</button>`;
                } else {
                    ctaContainer.innerHTML = `<button type="button" id="btnFenStep1Action" onclick="goToFenHataAnaliziStep('${studentId}', '${examId}')" class="btn-primary mt-4 w-full py-3 min-h-[44px]"><i class="fas fa-arrow-right mr-1"></i> Hata Analizine Devam</button>`;
                }
            }
        }
    }

    window.setQuestionStatus = function (index, status) {
        const hiddenInput = document.querySelector(`.durum-select[data-index="${index}"]`);
        if (hiddenInput) {
            hiddenInput.value = status;
        }
        const group = document.querySelector(`.durum-btn-group[data-index="${index}"]`);
        if (group) {
            const btnDogru = group.querySelector('.durum-btn-dogru');
            const btnYanlis = group.querySelector('.durum-btn-yanlis');
            const btnBos = group.querySelector('.durum-btn-bos');
            if (btnDogru) btnDogru.className = `flex-grow py-2 text-xs font-bold transition-all ${status === 'dogru' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-dogru`;
            if (btnYanlis) btnYanlis.className = `flex-grow py-2 text-xs font-bold transition-all ${status === 'yanlis' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-yanlis`;
            if (btnBos) btnBos.className = `flex-grow py-2 text-xs font-bold transition-all ${status === 'bos' ? 'bg-gray-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-bos`;
        }
        if (activeExamState?.sorular?.[index]) {
            activeExamState.sorular[index].durum = status;
            if (status === 'dogru') {
                activeExamState.sorular[index].hataKodu = null;
            }
        }
        if (hiddenInput) {
            hiddenInput.dispatchEvent(new Event('change'));
        }
        updateEditFooter();
    };

    window.setAllQuestionsCorrect = function () {
        if (confirm("Tüm soruları doğru olarak işaretlemek istediğinize emin misiniz?")) {
            const soruSayisi = activeExamState ? activeExamState.sorular.length : exam.sorular.length;
            for (let i = 0; i < soruSayisi; i++) {
                window.setQuestionStatus(i, 'dogru');
            }
            showSyncStatus("✅ Tüm sorular doğru olarak işaretlendi", false);
        }
    };

    function renderNonFenForm() {
        let rows = '';
        const soruSayisi = exam.sorular.length;
        let totalDogru = 0, totalYanlis = 0, totalBos = 0;

        for (let i = 0; i < soruSayisi; i++) {
            const soru = activeExamState?.sorular?.[i] || exam.sorular[i] || {};
            const durum = soru.durum || "bos";
            if (durum === 'dogru') totalDogru++;
            else if (durum === 'yanlis') totalYanlis++;
            else totalBos++;

            rows += `
                <div class="app-panel p-3 soru-duzenleme-satiri" data-soru-index="${i}">
                    <div class="font-bold mb-1 text-sm">${i + 1}. Soru</div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 mb-1">Durum</label>
                        <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-650 durum-btn-group" data-index="${i}">
                            <button type="button" onclick="setQuestionStatus(${i}, 'dogru')" class="flex-grow py-2 text-xs font-bold transition-all ${durum === 'dogru' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-dogru" data-index="${i}">✅ D</button>
                            <button type="button" onclick="setQuestionStatus(${i}, 'yanlis')" class="flex-grow py-2 text-xs font-bold transition-all ${durum === 'yanlis' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-yanlis" data-index="${i}">❌ Y</button>
                            <button type="button" onclick="setQuestionStatus(${i}, 'bos')" class="flex-grow py-2 text-xs font-bold transition-all ${durum === 'bos' ? 'bg-gray-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-bos" data-index="${i}">⬜ B</button>
                            <input type="hidden" class="durum-select" data-index="${i}" value="${durum}">
                        </div>
                    </div>
                </div>
            `;
        }

        const net = calculateNet(totalDogru, totalYanlis);
        const html = `
            <div class="app-page">
                <header class="app-page-header">
                    <div>
                        <button onclick="renderStudentPanel('${studentId}')" class="btn-secondary min-h-[44px] px-4 mb-3"><i class="fas fa-arrow-left mr-1"></i> Öğrenci Dosyasına Dön</button>
                        <h2 class="app-page-title">Konu Denemesi Sonucu</h2>
                        <p class="app-page-subtitle">${escapeHtml(activeExamState.denemeAdi || exam.denemeAdi)} · Soruların durumunu düzenleyin.</p>
                    </div>
                    <button onclick="setAllQuestionsCorrect()" class="btn-secondary px-4 py-2.5 text-sm min-h-[44px]"><i class="fas fa-check-double mr-1"></i> Tümünü Doğru İşaretle</button>
                </header>
                <div class="app-panel p-5">
                    <label for="editExamName" class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Deneme adı</label>
                    <input id="editExamName" class="student-form-input min-h-[44px] mb-3" placeholder="Deneme Adı" value="${escapeHtml(activeExamState.denemeAdi || exam.denemeAdi)}">
                    <div class="mb-2 text-sm text-gray-500">Her soru için durumu girin.</div>
                    <div class="space-y-3 md:max-h-96 md:overflow-auto mb-3">${rows}</div>
                    <div class="sticky-footer p-3.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-xl flex justify-between gap-3 flex-wrap font-bold text-sm" id="editFooter">
                        <span>Toplam: ${soruSayisi} soru · D:${totalDogru} · Y:${totalYanlis} · B:${totalBos}</span>
                        <span class="text-indigo-600 dark:text-indigo-400">Net: ${net.toFixed(2)}</span>
                    </div>
                    <button onclick="saveBransExamEdit('${studentId}', '${examId}')" class="btn-primary mt-4 w-full py-3 min-h-[44px]"><i class="fas fa-save mr-1"></i> Sonucu Kaydet</button>
                </div>
            </div>
        `;
        document.getElementById("dynamic-content").innerHTML = html;
        updateEditFooter();
    }

    function renderFenStep1() {
        let rows = '';
        const soruSayisi = activeExamState.sorular.length;
        let totalDogru = 0, totalYanlis = 0, totalBos = 0;

        for (let i = 0; i < soruSayisi; i++) {
            const soru = activeExamState.sorular[i];
            const durum = soru.durum || "bos";
            if (durum === 'dogru') totalDogru++;
            else if (durum === 'yanlis') totalYanlis++;
            else totalBos++;

            rows += `
                <div class="app-panel p-3 soru-duzenleme-satiri" data-soru-index="${i}">
                    <div class="font-bold mb-1 text-sm">${i + 1}. Soru</div>
                    <div>
                        <label class="block text-xs font-semibold text-gray-400 mb-1">Durum</label>
                        <div class="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-650 durum-btn-group" data-index="${i}">
                            <button type="button" onclick="setQuestionStatus(${i}, 'dogru')" class="flex-grow py-2.5 text-xs font-bold transition-all ${durum === 'dogru' ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-dogru" data-index="${i}">✅ D</button>
                            <button type="button" onclick="setQuestionStatus(${i}, 'yanlis')" class="flex-grow py-2.5 text-xs font-bold transition-all ${durum === 'yanlis' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-yanlis" data-index="${i}">❌ Y</button>
                            <button type="button" onclick="setQuestionStatus(${i}, 'bos')" class="flex-grow py-2.5 text-xs font-bold transition-all ${durum === 'bos' ? 'bg-gray-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'} durum-btn-bos" data-index="${i}">⬜ B</button>
                            <input type="hidden" class="durum-select" data-index="${i}" value="${durum}">
                        </div>
                    </div>
                </div>
            `;
        }

        const net = calculateNet(totalDogru, totalYanlis);
        const allCorrect = (totalYanlis + totalBos === 0);

        const html = `
            <div class="app-page">
                <header class="app-page-header">
                    <div>
                        <button onclick="renderStudentPanel('${studentId}')" class="btn-secondary min-h-[44px] px-4 mb-3"><i class="fas fa-arrow-left mr-1"></i> Öğrenci Dosyasına Dön</button>
                        <h2 class="app-page-title">Konu Denemesi Sonucu</h2>
                        <p class="app-page-subtitle">${escapeHtml(activeExamState.denemeAdi)} · 1. Adım: Soru durumlarını (Doğru, Yanlış, Boş) girin.</p>
                    </div>
                    <button onclick="setAllQuestionsCorrect()" class="btn-secondary px-4 py-2.5 text-sm min-h-[44px]"><i class="fas fa-check-double mr-1"></i> Tümünü Doğru İşaretle</button>
                </header>

                <!-- Step Indicator -->
                <div class="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div class="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        <span class="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</span>
                        <span>Sonuç</span>
                    </div>
                    <div class="flex-1 h-0.5 mx-3 bg-gray-200 dark:bg-gray-700"></div>
                    <div class="text-gray-400 text-center"><i class="fas fa-chevron-right text-xs"></i></div>
                    <div class="flex-1 h-0.5 mx-3 bg-gray-200 dark:bg-gray-700"></div>
                    <div class="flex items-center gap-2 text-sm font-medium text-gray-400 dark:text-gray-500">
                        <span class="w-6 h-6 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs">2</span>
                        <span>Hata Analizi</span>
                    </div>
                </div>

                <div class="app-panel p-5">
                    <label for="editExamName" class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Deneme adı</label>
                    <input id="editExamName" class="student-form-input min-h-[44px] mb-3" placeholder="Deneme Adı" value="${escapeHtml(activeExamState.denemeAdi)}">
                    <div class="mb-2 text-sm text-gray-500">Her soru için durumu girin. Yanlış ve boş sorular sonraki adımda analiz edilecektir.</div>
                    <div class="space-y-3 md:max-h-96 md:overflow-auto mb-3">${rows}</div>
                    <div class="sticky-footer p-3.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-xl flex justify-between gap-3 flex-wrap font-bold text-sm" id="editFooter">
                        <span>Toplam: ${soruSayisi} soru · D:${totalDogru} · Y:${totalYanlis} · B:${totalBos}</span>
                        <span class="text-indigo-600 dark:text-indigo-400">Net: ${net.toFixed(2)}</span>
                    </div>
                    <div id="fenStep1CtaContainer">
                        ${allCorrect ? `
                            <button type="button" id="btnFenStep1Action" onclick="saveBransExamEdit('${studentId}', '${examId}')" class="btn-primary mt-4 w-full py-3 min-h-[44px]"><i class="fas fa-save mr-1"></i> Sonucu Kaydet</button>
                        ` : `
                            <button type="button" id="btnFenStep1Action" onclick="goToFenHataAnaliziStep('${studentId}', '${examId}')" class="btn-primary mt-4 w-full py-3 min-h-[44px]"><i class="fas fa-arrow-right mr-1"></i> Hata Analizine Devam</button>
                        `}
                    </div>
                </div>
            </div>
        `;
        document.getElementById("dynamic-content").innerHTML = html;
        updateEditFooter();
    }

    function renderFenStep2() {
        const fenKonulari = getKonuListesiBySinifAndDers(activeExamState.sinif, 'Fen Bilimleri');
        const soruSayisi = activeExamState.sorular.length;
        let totalDogru = 0, totalYanlis = 0, totalBos = 0;

        let analysisCards = '';
        let wrongAndBlankCount = 0;

        for (let i = 0; i < soruSayisi; i++) {
            const soru = activeExamState.sorular[i];
            const durum = soru.durum || "bos";
            if (durum === 'dogru') {
                totalDogru++;
                continue; // Only wrong and blank questions are rendered in Step 2
            }
            if (durum === 'yanlis') totalYanlis++;
            else totalBos++;
            wrongAndBlankCount++;

            analysisCards += `
                <div class="app-panel p-4 fen-hata-karti border border-gray-200 dark:border-gray-700 rounded-xl transition-all" id="fen-card-${i}" data-index="${i}">
                    <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                        <span class="font-bold text-sm text-gray-900 dark:text-gray-100">${soru.soruNo}. Soru</span>
                        <span class="text-xs px-2.5 py-1 rounded-full font-bold ${durum === 'yanlis' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700'}">
                            ${durum === 'yanlis' ? 'Yanlış' : 'Boş'}
                        </span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label for="fen-konu-${i}" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Yapılamayan Konu <span class="text-red-500">*</span></label>
                            <select id="fen-konu-${i}" class="student-form-input fen-konu-select min-h-[44px] w-full text-sm" data-index="${i}" onchange="onFenSelectChange(${i})">
                                <option value="">-- Konu Seçin --</option>
                                ${fenKonulari.map(k => {
                                    const isSelected = (soru.konuAdi === k) || (soru.konuAdi && String(soru.konuAdi).trim().toLocaleLowerCase('tr-TR') === String(k).trim().toLocaleLowerCase('tr-TR'));
                                    return `<option value="${escapeHtml(k)}" ${isSelected ? 'selected' : ''}>${escapeHtml(k)}</option>`;
                                }).join('')}
                                ${(soru.konuAdi && !fenKonulari.some(k => k === soru.konuAdi || String(k).trim().toLocaleLowerCase('tr-TR') === String(soru.konuAdi).trim().toLocaleLowerCase('tr-TR'))) ? `<option value="${escapeHtml(soru.konuAdi)}" selected>${escapeHtml(soru.konuAdi)}</option>` : ''}
                            </select>
                        </div>
                        <div>
                            <label for="fen-hata-${i}" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Hata Nedeni <span class="text-red-500">*</span></label>
                            <select id="fen-hata-${i}" class="student-form-input fen-hata-select min-h-[44px] w-full text-sm" data-index="${i}" onchange="onFenSelectChange(${i})">
                                <option value="">-- Hata Kodu Seçin --</option>
                                ${HATA_KODLARI.map(h => `<option value="${escapeHtml(h.kod)}" ${soru.hataKodu === h.kod ? 'selected' : ''}>${escapeHtml(h.kod)} - ${escapeHtml(h.aciklama)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }

        const net = calculateNet(totalDogru, totalYanlis);

        const html = `
            <div class="app-page">
                <header class="app-page-header">
                    <div>
                        <button type="button" onclick="goToFenStep1('${studentId}', '${examId}')" class="btn-secondary min-h-[44px] px-4 mb-3"><i class="fas fa-arrow-left mr-1"></i> Sonuca Dön</button>
                        <h2 class="app-page-title">Fen Bilimleri Hata Analizi</h2>
                        <p class="app-page-subtitle">${escapeHtml(activeExamState.denemeAdi)} · 2. Adım: Yanlış ve boş sorular için yapılamayan konuyu ve hata nedenini belirleyin.</p>
                    </div>
                </header>

                <!-- Step Indicator -->
                <div class="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div class="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        <span class="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-xs"><i class="fas fa-check text-[10px]"></i></span>
                        <span>1. Sonuç</span>
                    </div>
                    <div class="flex-1 h-0.5 mx-3 bg-indigo-200 dark:bg-indigo-800"></div>
                    <div class="text-indigo-400 text-center"><i class="fas fa-chevron-right text-xs"></i></div>
                    <div class="flex-1 h-0.5 mx-3 bg-indigo-200 dark:bg-indigo-800"></div>
                    <div class="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                        <span class="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
                        <span>Hata Analizi</span>
                    </div>
                </div>

                <input type="hidden" id="editExamName" value="${escapeHtml(activeExamState.denemeAdi)}">

                <!-- Summary Banner -->
                <div class="mb-4 p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl">
                    <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div class="flex items-center gap-2 flex-wrap font-semibold text-gray-700 dark:text-gray-300">
                            <span class="bg-white dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700">${soruSayisi} soru</span>
                            <span class="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">${totalDogru} doğru</span>
                            <span class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800">${totalYanlis} yanlış</span>
                            <span class="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700">${totalBos} boş</span>
                            <span class="text-indigo-600 dark:text-indigo-400 font-bold px-2 py-1">Net: ${net.toFixed(2)}</span>
                        </div>
                        <div class="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
                            <i class="fas fa-exclamation-circle mr-1"></i> ${wrongAndBlankCount} analiz edilecek soru
                        </div>
                    </div>
                </div>

                <!-- Validation Alert Container -->
                <div id="fenValidationAlert" class="hidden mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm font-semibold items-center gap-2"></div>

                <!-- Error Analysis Cards (Only Yanlis & Bos) -->
                <div class="space-y-3 mb-4" id="fenCardsContainer">
                    ${analysisCards}
                </div>

                <!-- Actions -->
                <div class="flex flex-col sm:flex-row items-center gap-3 mt-4">
                    <button type="button" onclick="goToFenStep1('${studentId}', '${examId}')" class="btn-secondary w-full sm:w-1/3 py-3 min-h-[44px]"><i class="fas fa-arrow-left mr-1"></i> Sonuca Dön</button>
                    <button type="button" onclick="saveFenExamWithAnalysis('${studentId}', '${examId}')" class="btn-primary w-full sm:w-2/3 py-3 min-h-[44px]"><i class="fas fa-save mr-1"></i> Sonucu ve Hata Analizini Kaydet</button>
                </div>
            </div>
        `;
        document.getElementById("dynamic-content").innerHTML = html;
    }

    window._renderFenStep1 = renderFenStep1;
    window._renderFenStep2 = renderFenStep2;

    if (isFenExam) {
        renderFenStep1();
    } else {
        renderNonFenForm();
    }
}

export async function saveBransExamEdit(studentId, examId) {
    const examNameInput = document.getElementById('editExamName');
    const examName = examNameInput ? examNameInput.value.trim() : (activeExamState?.denemeAdi || '');
    if (!examName) {
        alert("Deneme adı girin");
        return;
    }
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx === -1) {
        if (window.renderHomeScreen) window.renderHomeScreen();
        return;
    }
    const examIndex = students[sIdx].denemeler.findIndex(e => e.id === examId);
    if (examIndex === -1) {
        if (window.renderHomeScreen) window.renderHomeScreen();
        return;
    }
    const exam = students[sIdx].denemeler[examIndex];
    const isFenExam = isFenBranchExam(exam, students[sIdx]);
    const soruSayisi = exam.sorular.length;
    let toplamDogru = 0, toplamYanlis = 0, toplamBos = 0;
    const updatedSorular = [];
    let hataEksik = false;
    let eksikHataSayisi = 0;

    if (isFenExam) {
        for (let i = 0; i < soruSayisi; i++) {
            const stSoru = activeExamState?.sorular?.[i];
            const durumSelect = document.querySelector(`.durum-select[data-index="${i}"]`);
            let durum = stSoru ? stSoru.durum : (durumSelect ? durumSelect.value : (exam.sorular[i]?.durum || 'bos'));

            let konu = stSoru ? stSoru.konuAdi : (exam.sorular[i]?.konuAdi || '');
            let hataKodu = stSoru ? stSoru.hataKodu : (exam.sorular[i]?.hataKodu || null);

            const konuSelect = document.querySelector(`.fen-konu-select[data-index="${i}"]`);
            const hataSelect = document.querySelector(`.fen-hata-select[data-index="${i}"]`);
            if (konuSelect && konuSelect.value) konu = konuSelect.value.trim();
            if (hataSelect && hataSelect.value) hataKodu = hataSelect.value.trim();

            if (durum === 'dogru') {
                toplamDogru++;
                hataKodu = null;
                if (!konu) konu = exam.sorular[i]?.konuAdi || exam.konu || 'Fen Bilimleri';
            } else {
                if (!konu || !hataKodu) {
                    hataEksik = true;
                    eksikHataSayisi++;
                }
                if (durum === 'yanlis') toplamYanlis++;
                else toplamBos++;
            }
            updatedSorular.push({ soruNo: i + 1, konuAdi: konu || "", durum: durum, hataKodu: hataKodu || null });
        }

        if (hataEksik) {
            alert(`${eksikHataSayisi} hata kaydı eksik. Lütfen işaretli sorular için konu ve hata nedenini seçin.`);
            return;
        }
    } else {
        // Non-Fen branch exam: simple save without requiring topic or error code
        for (let i = 0; i < soruSayisi; i++) {
            const durumSelect = document.querySelector(`.durum-select[data-index="${i}"]`);
            let durum = durumSelect ? durumSelect.value : (exam.sorular[i]?.durum || 'bos');
            let konu = exam.sorular[i]?.konuAdi || exam.konu || exam.ders || "";
            let hataKodu = null;
            if (durum === 'dogru') {
                toplamDogru++;
            } else {
                if (durum === 'yanlis') toplamYanlis++;
                else toplamBos++;
            }
            updatedSorular.push({ soruNo: i + 1, konuAdi: konu || "", durum: durum, hataKodu: hataKodu || null });
        }
    }

    const net = calculateNet(toplamDogru, toplamYanlis);
    const updatedExam = { ...exam, denemeAdi: examName, sorular: updatedSorular, toplamDogru, toplamYanlis, toplamBos, toplamNet: net, toplamSoru: soruSayisi };
    const res = await updateStudentArrayRecord(studentId, 'denemeler', exam.id, updatedExam);
    if (res && !res.ok && res.blockedOffline) {
        alert(res.message);
        return;
    }
    if (window.renderStudentPanel) window.renderStudentPanel(studentId);
}

let activeGeneralExamState = null;

export function editGenelExam(studentId, examId, exam) {
    const isReturningFromStep2 = arguments[3] === true;
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    const studentGrade = String(exam.sinif || student?.sinif || '8').trim();

    const dersBilgileri = exam.dersBilgileri || [];
    const dersSonuclari = exam.dersSonuclari || {};

    if (!isReturningFromStep2 || !activeGeneralExamState || activeGeneralExamState.examId !== examId) {
        const allDersInputs = {};
        for (let item of dersBilgileri) {
            const dersKey = item.ders;
            const res = dersSonuclari[dersKey] || { dogru: 0, yanlis: 0, bos: item.adet };
            allDersInputs[dersKey] = { dogru: res.dogru, yanlis: res.yanlis, bos: res.bos };
        }

        activeGeneralExamState = {
            studentId,
            examId,
            sinif: studentGrade,
            denemeAdi: exam.denemeAdi || '',
            currentStep: 1,
            dersBilgileri: JSON.parse(JSON.stringify(dersBilgileri)),
            dersSonuclari: JSON.parse(JSON.stringify(dersSonuclari)),
            allDersInputs,
            fenQuestionsToAnalyze: []
        };
    } else {
        activeGeneralExamState.currentStep = 1;
    }
    window._activeGeneralExamState = activeGeneralExamState;

    let dersRows = '';
    for (let item of dersBilgileri) {
        const dersKey = item.ders;
        const idx = GENEL_DERSLER_KEY.indexOf(dersKey);
        const dersGorunum = idx !== -1 ? GENEL_DERSLER_GORUNUM[idx] : dersKey;
        const toplamSoru = item.adet;
        const currentInput = activeGeneralExamState.allDersInputs[dersKey] || dersSonuclari[dersKey] || { dogru: 0, yanlis: 0, bos: toplamSoru };
        const dogruVal = currentInput.dogru ?? 0;
        const yanlisVal = currentInput.yanlis ?? 0;
        const bosVal = toplamSoru - dogruVal - yanlisVal;

        dersRows += `
            <div class="app-panel p-3">
                <div class="font-bold mb-2 text-sm">${escapeHtml(dersGorunum)}</div>
                <div class="text-xs text-gray-500 mb-2">Toplam Soru: ${toplamSoru}</div>
                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label class="block text-xs font-semibold mb-1">Doğru</label>
                        <input type="number" min="0" max="${toplamSoru}" value="${dogruVal}" class="student-form-input genel-dogru min-h-[44px]" data-ders="${escapeHtml(dersKey)}" data-toplam="${toplamSoru}">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Yanlış</label>
                        <input type="number" min="0" max="${toplamSoru}" value="${yanlisVal}" class="student-form-input genel-yanlis min-h-[44px]" data-ders="${escapeHtml(dersKey)}" data-toplam="${toplamSoru}">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold mb-1">Boş</label>
                        <input type="number" min="0" max="${toplamSoru}" value="${bosVal}" class="student-form-input genel-bos min-h-[44px] bg-gray-50 dark:bg-gray-900/50" data-ders="${escapeHtml(dersKey)}" data-toplam="${toplamSoru}" readonly>
                    </div>
                </div>
            </div>
        `;
    }

    const currentExamName = activeGeneralExamState.denemeAdi || exam.denemeAdi || '';

    const html = `
        <div class="app-page">
            <header class="app-page-header">
                <div>
                    <button type="button" onclick="renderStudentPanel('${studentId}')" class="btn-secondary min-h-[44px] px-4 mb-3"><i class="fas fa-arrow-left mr-1"></i> Öğrenci Dosyasına Dön</button>
                    <h2 class="app-page-title">Genel Deneme Sonucu</h2>
                    <p class="app-page-subtitle">${escapeHtml(currentExamName)} · Ders bazında doğru ve yanlış sayılarını düzenleyin.</p>
                </div>
            </header>
            <div class="app-panel p-5">
                <label for="editExamName" class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Deneme adı</label>
                <input id="editExamName" class="student-form-input min-h-[44px] mb-3" placeholder="Deneme Adı" value="${escapeHtml(currentExamName)}">
                <div class="mb-2 text-sm text-gray-500">Her ders için doğru, yanlış ve boş sayılarını girin. Boş sayısı otomatik hesaplanır.</div>
                <div class="space-y-3 md:max-h-96 md:overflow-auto mb-3">${dersRows}</div>
                <div class="sticky-footer p-3.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-xl flex justify-between gap-3 flex-wrap font-bold text-sm" id="editFooter">
                    <span>Toplam: ${exam.toplamSoru} soru · D:0 · Y:0 · B:0</span>
                    <span class="text-indigo-600 dark:text-indigo-400">Net: 0.00</span>
                </div>
                <div id="genelStep1CtaContainer">
                    <button type="button" onclick="saveGenelExamEdit('${studentId}', '${examId}')" class="btn-primary mt-4 w-full py-3 min-h-[44px]"><i class="fas fa-save mr-1"></i> Sonucu Kaydet</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;

    const dogruInputs = document.querySelectorAll('.genel-dogru');
    const yanlisInputs = document.querySelectorAll('.genel-yanlis');
    const bosInputs = document.querySelectorAll('.genel-bos');
    const examNameInput = document.getElementById('editExamName');

    if (examNameInput) {
        examNameInput.addEventListener('input', () => {
            if (activeGeneralExamState) {
                activeGeneralExamState.denemeAdi = examNameInput.value.trim();
            }
        });
    }

    function updateDers(dogruInput, yanlisInput, bosInput, toplam) {
        let dogru = parseInt(dogruInput.value) || 0;
        let yanlis = parseInt(yanlisInput.value) || 0;
        if (dogru < 0) dogru = 0;
        if (dogru > toplam) dogru = toplam;
        if (yanlis < 0) yanlis = 0;
        if (yanlis > toplam - dogru) yanlis = toplam - dogru;
        dogruInput.value = dogru;
        yanlisInput.value = yanlis;
        bosInput.value = toplam - dogru - yanlis;

        const dersKey = dogruInput.getAttribute('data-ders');
        if (dersKey && activeGeneralExamState && activeGeneralExamState.allDersInputs) {
            activeGeneralExamState.allDersInputs[dersKey] = {
                dogru,
                yanlis,
                bos: toplam - dogru - yanlis
            };
        }
    }

    function updateAll() {
        let totalDogru = 0, totalYanlis = 0, totalBos = 0;
        let fenDogru = 0, fenYanlis = 0, fenBos = 0, fenToplam = 0, hasFen = false;

        dogruInputs.forEach((inp, idx) => {
            const dersKey = inp.getAttribute('data-ders');
            const toplam = parseInt(inp.getAttribute('data-toplam'));
            const yanlisInp = yanlisInputs[idx];
            const dogru = parseInt(inp.value) || 0;
            const yanlis = parseInt(yanlisInp.value) || 0;
            const bos = toplam - dogru - yanlis;

            totalDogru += dogru;
            totalYanlis += yanlis;
            totalBos += bos;

            if (dersKey === 'Fen Bilimleri') {
                hasFen = true;
                fenDogru = dogru;
                fenYanlis = yanlis;
                fenBos = bos;
                fenToplam = toplam;
            }

            if (activeGeneralExamState && activeGeneralExamState.allDersInputs && dersKey) {
                activeGeneralExamState.allDersInputs[dersKey] = { dogru, yanlis, bos };
            }
        });

        const net = calculateNet(totalDogru, totalYanlis);
        const footer = document.getElementById('editFooter');
        if (footer) {
            footer.innerHTML = `<span>Toplam: ${exam.toplamSoru} soru · D:${totalDogru} · Y:${totalYanlis} · B:${totalBos}</span><span class="text-indigo-600 dark:text-indigo-400">Net: ${net.toFixed(2)}</span>`;
        }

        const ctaContainer = document.getElementById('genelStep1CtaContainer');
        if (ctaContainer) {
            if (hasFen && (fenYanlis + fenBos > 0)) {
                ctaContainer.innerHTML = `
                    <div class="flex flex-col sm:flex-row items-center gap-3 mt-4">
                        <button type="button" onclick="saveGenelExamEdit('${studentId}', '${examId}')" class="btn-secondary w-full sm:w-1/3 py-3 min-h-[44px] order-2 sm:order-1">
                            <i class="fas fa-save mr-1"></i> Sadece Sonucu Kaydet
                        </button>
                        <button type="button" id="btnGoToGeneralFenStep2" onclick="goToGeneralFenStep2('${studentId}', '${examId}')" class="btn-primary w-full sm:w-2/3 py-3 min-h-[44px] order-1 sm:order-2 font-bold shadow-sm">
                            <i class="fas fa-arrow-right mr-1"></i> Fen Hata Analizine Devam
                        </button>
                    </div>
                `;
            } else {
                ctaContainer.innerHTML = `
                    <button type="button" onclick="saveGenelExamEdit('${studentId}', '${examId}')" class="btn-primary mt-4 w-full py-3 min-h-[44px] font-bold"><i class="fas fa-save mr-1"></i> Sonucu Kaydet</button>
                `;
            }
        }
    }

    for (let i = 0; i < dogruInputs.length; i++) {
        const toplam = parseInt(dogruInputs[i].getAttribute('data-toplam'));
        const dogruInp = dogruInputs[i];
        const yanlisInp = yanlisInputs[i];
        const bosInp = bosInputs[i];

        dogruInp.addEventListener('input', () => {
            updateDers(dogruInp, yanlisInp, bosInp, toplam);
            updateAll();
        });
        yanlisInp.addEventListener('input', () => {
            updateDers(dogruInp, yanlisInp, bosInp, toplam);
            updateAll();
        });
    }
    updateAll();
}

export async function saveGenelExamEdit(studentId, examId, fenAnalysisMap = null) {
    const examNameInput = document.getElementById('editExamName');
    const examName = examNameInput ? examNameInput.value.trim() : (activeGeneralExamState?.denemeAdi || '');
    if (!examName) {
        alert("Deneme adı girin");
        return;
    }
    const students = loadStudentsData();
    const sIdx = students.findIndex(s => s.id === studentId);
    if (sIdx === -1) {
        if (window.renderHomeScreen) window.renderHomeScreen();
        return;
    }
    const examIndex = students[sIdx].denemeler.findIndex(e => e.id === examId);
    if (examIndex === -1) {
        if (window.renderHomeScreen) window.renderHomeScreen();
        return;
    }
    const exam = students[sIdx].denemeler[examIndex];
    const dersBilgileri = exam.dersBilgileri || [];
    const dersSonuclari = {};
    let toplamDogru = 0, toplamYanlis = 0, toplamBos = 0;

    for (let item of dersBilgileri) {
        const dersKey = item.ders;
        const toplamSoru = item.adet;
        const dogruInput = document.querySelector(`.genel-dogru[data-ders="${dersKey}"]`);
        const yanlisInput = document.querySelector(`.genel-yanlis[data-ders="${dersKey}"]`);
        let dogru = 0;
        let yanlis = 0;

        if (dogruInput && yanlisInput) {
            dogru = parseInt(dogruInput.value) || 0;
            yanlis = parseInt(yanlisInput.value) || 0;
        } else if (activeGeneralExamState?.allDersInputs?.[dersKey]) {
            dogru = activeGeneralExamState.allDersInputs[dersKey].dogru;
            yanlis = activeGeneralExamState.allDersInputs[dersKey].yanlis;
        } else if (exam.dersSonuclari?.[dersKey]) {
            dogru = exam.dersSonuclari[dersKey].dogru;
            yanlis = exam.dersSonuclari[dersKey].yanlis;
        }

        if (dogru > toplamSoru) dogru = toplamSoru;
        if (yanlis > toplamSoru - dogru) yanlis = toplamSoru - dogru;
        const bos = toplamSoru - dogru - yanlis;
        dersSonuclari[dersKey] = { dogru, yanlis, bos };
        toplamDogru += dogru;
        toplamYanlis += yanlis;
        toplamBos += bos;
    }

    const net = calculateNet(toplamDogru, toplamYanlis);
    const updatedSorular = [];
    let soruIndex = 0;

    for (let item of dersBilgileri) {
        const dersKey = item.ders;
        const sonuc = dersSonuclari[dersKey];
        const adet = item.adet;
        let dogruKalan = sonuc.dogru;
        let yanlisKalan = sonuc.yanlis;
        let bosKalan = sonuc.bos;

        for (let i = 0; i < adet; i++) {
            const globalIndex = soruIndex;
            const prevQ = exam.sorular?.[globalIndex];
            const actualSoruNo = prevQ?.soruNo || (globalIndex + 1);

            let durum = "";
            if (dogruKalan > 0) {
                durum = "dogru";
                dogruKalan--;
            } else if (yanlisKalan > 0) {
                durum = "yanlis";
                yanlisKalan--;
            } else {
                durum = "bos";
                bosKalan--;
            }

            let konuAdi = dersKey;
            let hataKodu = null;

            if (dersKey === 'Fen Bilimleri') {
                if (durum === 'dogru') {
                    konuAdi = prevQ?.konuAdi || dersKey;
                    hataKodu = null;
                } else {
                    if (fenAnalysisMap && fenAnalysisMap.has(globalIndex)) {
                        const mapped = fenAnalysisMap.get(globalIndex);
                        konuAdi = mapped.konuAdi || dersKey;
                        hataKodu = mapped.hataKodu || null;
                    } else if (prevQ && prevQ.konuAdi && prevQ.konuAdi !== 'Fen Bilimleri') {
                        konuAdi = prevQ.konuAdi;
                        hataKodu = prevQ.hataKodu || null;
                    } else {
                        konuAdi = dersKey;
                        hataKodu = prevQ?.hataKodu || null;
                    }
                }
            }

            updatedSorular.push({
                soruNo: actualSoruNo,
                konuAdi: konuAdi,
                durum: durum,
                hataKodu: hataKodu
            });
            soruIndex++;
        }
    }

    const updatedExam = {
        ...exam,
        denemeAdi: examName,
        sorular: updatedSorular,
        dersSonuclari: dersSonuclari,
        toplamDogru,
        toplamYanlis,
        toplamBos,
        toplamNet: net,
        toplamSoru: exam.toplamSoru
    };

    const res = await updateStudentArrayRecord(studentId, 'denemeler', exam.id, updatedExam);
    if (res && !res.ok && res.blockedOffline) {
        alert(res.message);
        return;
    }

    activeGeneralExamState = null;
    window._activeGeneralExamState = null;

    if (window.renderStudentPanel) window.renderStudentPanel(studentId);
}

export function goToGeneralFenStep2(studentId, examId) {
    const examNameInput = document.getElementById('editExamName');
    const examName = examNameInput ? examNameInput.value.trim() : (activeGeneralExamState?.denemeAdi || '');
    if (!examName) {
        alert("Deneme adı girin");
        return;
    }

    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    const exam = student?.denemeler?.find(e => e.id === examId);
    if (!student || !exam) return;

    if (!activeGeneralExamState) {
        editGenelExam(studentId, examId, exam);
    }
    activeGeneralExamState.denemeAdi = examName;

    // Sync input values from Step 1 DOM into activeGeneralExamState.allDersInputs
    const dersBilgileri = exam.dersBilgileri || [];
    for (let item of dersBilgileri) {
        const dersKey = item.ders;
        const toplamSoru = item.adet;
        const dogruInput = document.querySelector(`.genel-dogru[data-ders="${dersKey}"]`);
        const yanlisInput = document.querySelector(`.genel-yanlis[data-ders="${dersKey}"]`);
        if (dogruInput && yanlisInput) {
            let dogru = parseInt(dogruInput.value) || 0;
            let yanlis = parseInt(yanlisInput.value) || 0;
            if (dogru > toplamSoru) dogru = toplamSoru;
            if (yanlis > toplamSoru - dogru) yanlis = toplamSoru - dogru;
            const bos = toplamSoru - dogru - yanlis;
            activeGeneralExamState.allDersInputs[dersKey] = { dogru, yanlis, bos };
            activeGeneralExamState.dersSonuclari[dersKey] = { dogru, yanlis, bos };
        }
    }

    const fenSonuc = activeGeneralExamState.allDersInputs['Fen Bilimleri'];
    if (!fenSonuc || (fenSonuc.yanlis + fenSonuc.bos === 0)) {
        saveGenelExamEdit(studentId, examId);
        return;
    }

    // Determine Fen question indices in exam.sorular
    const fenIndices = getGeneralExamFenQuestionIndexes(exam);
    const fenTotal = fenIndices.length;
    let targetDogru = fenSonuc.dogru;
    let targetYanlis = fenSonuc.yanlis;
    let targetBos = fenSonuc.bos;

    // Check if existing exam.sorular matches target distribution
    const existingFenQs = fenIndices.map(idx => exam.sorular?.[idx]).filter(Boolean);
    const existingDCount = existingFenQs.filter(q => q.durum === 'dogru').length;
    const existingYCount = existingFenQs.filter(q => q.durum === 'yanlis').length;
    const existingBCount = existingFenQs.filter(q => q.durum === 'bos').length;

    const matchesExisting = (existingDCount === targetDogru && existingYCount === targetYanlis && existingBCount === targetBos);

    // Existing memory map if user already selected topics in this session
    const inMemoryMap = new Map();
    if (Array.isArray(activeGeneralExamState.fenQuestionsToAnalyze)) {
        activeGeneralExamState.fenQuestionsToAnalyze.forEach(q => {
            inMemoryMap.set(q.globalIndex, { konuAdi: q.konuAdi, hataKodu: q.hataKodu });
        });
    }

    const fenQuestions = [];
    let dRemaining = targetDogru;
    let yRemaining = targetYanlis;
    let bRemaining = targetBos;

    for (let i = 0; i < fenTotal; i++) {
        const globalIndex = fenIndices[i];
        const existingQ = exam.sorular?.[globalIndex];
        const actualSoruNo = existingQ?.soruNo || (globalIndex + 1);

        let durum = 'bos';
        if (matchesExisting && existingQ?.durum) {
            durum = existingQ.durum;
        } else {
            if (dRemaining > 0) {
                durum = 'dogru';
                dRemaining--;
            } else if (yRemaining > 0) {
                durum = 'yanlis';
                yRemaining--;
            } else {
                durum = 'bos';
                bRemaining--;
            }
        }

        // Determine konuAdi and hataKodu
        let konuAdi = '';
        let hataKodu = null;

        if (inMemoryMap.has(globalIndex)) {
            const mem = inMemoryMap.get(globalIndex);
            konuAdi = mem.konuAdi || '';
            hataKodu = mem.hataKodu || null;
        } else if (existingQ) {
            if (existingQ.konuAdi && existingQ.konuAdi !== 'Fen Bilimleri') {
                konuAdi = existingQ.konuAdi;
            }
            if (existingQ.hataKodu) {
                hataKodu = existingQ.hataKodu;
            }
        }

        fenQuestions.push({
            globalIndex,
            soruNo: actualSoruNo,
            durum,
            konuAdi,
            hataKodu
        });
    }

    activeGeneralExamState.fenQuestions = fenQuestions;
    activeGeneralExamState.fenQuestionsToAnalyze = fenQuestions.filter(q => q.durum === 'yanlis' || q.durum === 'bos');
    activeGeneralExamState.currentStep = 2;

    renderGeneralFenStep2(studentId, examId);
}

export function renderGeneralFenStep2(studentId, examId) {
    const studentGrade = activeGeneralExamState.sinif || '8';
    let fenKonulari = getKonuListesiBySinifAndDers(studentGrade, 'Fen Bilimleri') || [];
    if (fenKonulari.length === 0) fenKonulari = getKonuListesiBySinifAndDers('8', 'Fen Bilimleri') || [];

    const fenSonuc = activeGeneralExamState.allDersInputs['Fen Bilimleri'] || { dogru: 0, yanlis: 0, bos: 0 };
    const fenDogru = fenSonuc.dogru;
    const fenYanlis = fenSonuc.yanlis;
    const fenBos = fenSonuc.bos;
    const fenToplam = fenDogru + fenYanlis + fenBos;
    const fenNet = calculateNet(fenDogru, fenYanlis);

    const questionsToAnalyze = activeGeneralExamState.fenQuestionsToAnalyze || [];

    let analysisCards = '';
    questionsToAnalyze.forEach((q, idx) => {
        const durum = q.durum;
        analysisCards += `
            <div class="app-panel p-4 genel-fen-hata-karti border border-gray-200 dark:border-gray-700 rounded-xl transition-all mb-3" id="genel-fen-card-${idx}" data-index="${idx}">
                <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <span class="font-bold text-sm text-gray-900 dark:text-gray-100">${q.soruNo}. Soru</span>
                    <span class="text-xs px-2.5 py-1 rounded-full font-bold ${durum === 'yanlis' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700'}">
                        ${durum === 'yanlis' ? 'Yanlış' : 'Boş'}
                    </span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label for="genel-fen-konu-${idx}" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Yapılamayan Konu <span class="text-red-500">*</span></label>
                        <select id="genel-fen-konu-${idx}" class="student-form-input genel-fen-konu-select min-h-[44px] w-full text-sm" data-index="${idx}" onchange="onGenelFenSelectChange(${idx})">
                            <option value="">-- Konu Seçin --</option>
                            ${fenKonulari.map(k => {
                                const isSelected = (q.konuAdi === k) || (q.konuAdi && String(q.konuAdi).trim().toLocaleLowerCase('tr-TR') === String(k).trim().toLocaleLowerCase('tr-TR'));
                                return `<option value="${escapeHtml(k)}" ${isSelected ? 'selected' : ''}>${escapeHtml(k)}</option>`;
                            }).join('')}
                            ${(q.konuAdi && q.konuAdi !== 'Fen Bilimleri' && !fenKonulari.some(k => k === q.konuAdi || String(k).trim().toLocaleLowerCase('tr-TR') === String(q.konuAdi).trim().toLocaleLowerCase('tr-TR'))) ? `<option value="${escapeHtml(q.konuAdi)}" selected>${escapeHtml(q.konuAdi)}</option>` : ''}
                        </select>
                    </div>
                    <div>
                        <label for="genel-fen-hata-${idx}" class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Hata Nedeni <span class="text-red-500">*</span></label>
                        <select id="genel-fen-hata-${idx}" class="student-form-input genel-fen-hata-select min-h-[44px] w-full text-sm" data-index="${idx}" onchange="onGenelFenSelectChange(${idx})">
                            <option value="">-- Hata Kodu Seçin --</option>
                            ${HATA_KODLARI.map(h => `<option value="${escapeHtml(h.kod)}" ${q.hataKodu === h.kod ? 'selected' : ''}>${escapeHtml(h.kod)} - ${escapeHtml(h.aciklama)}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;
    });

    const html = `
        <div class="app-page">
            <header class="app-page-header">
                <div>
                    <button type="button" onclick="goToGeneralStep1('${studentId}', '${examId}')" class="btn-secondary min-h-[44px] px-4 mb-3"><i class="fas fa-arrow-left mr-1"></i> Genel Sonuca Dön</button>
                    <h2 class="app-page-title">Fen Bilimleri Hata Analizi</h2>
                    <p class="app-page-subtitle">${escapeHtml(activeGeneralExamState.denemeAdi)} · 2. Adım: Yanlış ve boş Fen Bilimleri soruları için konu ve hata nedenini belirleyin.</p>
                </div>
            </header>

            <!-- Step Indicator -->
            <div class="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 cursor-pointer" onclick="goToGeneralStep1('${studentId}', '${examId}')">
                    <span class="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center text-xs"><i class="fas fa-check text-[10px]"></i></span>
                    <span>1. Genel Sonuç</span>
                </div>
                <div class="flex-1 h-0.5 mx-3 bg-indigo-200 dark:bg-indigo-800"></div>
                <div class="text-indigo-400 text-center"><i class="fas fa-chevron-right text-xs"></i></div>
                <div class="flex-1 h-0.5 mx-3 bg-indigo-200 dark:bg-indigo-800"></div>
                <div class="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    <span class="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
                    <span>Fen Hata Analizi</span>
                </div>
            </div>

            <!-- Subject Summary Card -->
            <div class="app-panel p-4 mb-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <span class="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Ders Özeti</span>
                        <h4 class="text-base font-extrabold text-gray-900 dark:text-white">Fen Bilimleri</h4>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-sm">
                        <span class="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 font-semibold border border-gray-200 dark:border-gray-700">Toplam: ${fenToplam} soru</span>
                        <span class="px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 font-bold border border-green-200 dark:border-green-800">${fenDogru}D</span>
                        <span class="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold border border-red-200 dark:border-red-800">${fenYanlis}Y</span>
                        <span class="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold border border-gray-300 dark:border-gray-700">${fenBos}B</span>
                        <span class="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-black border border-indigo-200 dark:border-indigo-800">${fenNet.toFixed(2)} Net</span>
                        <span class="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800"><i class="fas fa-exclamation-triangle text-xs mr-1"></i>${questionsToAnalyze.length} analiz edilecek soru</span>
                    </div>
                </div>
            </div>

            <!-- Validation alert -->
            <div id="fenValidationAlert" class="hidden p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium items-center gap-2">
                <i class="fas fa-circle-exclamation text-base"></i>
                <span></span>
            </div>

            <!-- Analysis Cards Container -->
            <div class="space-y-3 md:max-h-[600px] md:overflow-auto mb-4">
                ${analysisCards}
            </div>

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row items-center gap-3 mt-4">
                <button type="button" onclick="goToGeneralStep1('${studentId}', '${examId}')" class="btn-secondary w-full sm:w-1/3 py-3 min-h-[44px] order-2 sm:order-1">
                    <i class="fas fa-arrow-left mr-1"></i> Genel Sonuca Dön
                </button>
                <button type="button" onclick="saveGenelExamWithFenAnalysis('${studentId}', '${examId}')" class="btn-primary w-full sm:w-2/3 py-3 min-h-[44px] order-1 sm:order-2 font-bold shadow-sm">
                    <i class="fas fa-save mr-1"></i> Sonucu ve Fen Hata Analizini Kaydet
                </button>
            </div>
        </div>
    `;
    document.getElementById("dynamic-content").innerHTML = html;
}

export function goToGeneralStep1(studentId, examId) {
    if (activeGeneralExamState && activeGeneralExamState.fenQuestionsToAnalyze) {
        activeGeneralExamState.fenQuestionsToAnalyze.forEach((q, idx) => {
            const konuSelect = document.querySelector(`.genel-fen-konu-select[data-index="${idx}"]`);
            const hataSelect = document.querySelector(`.genel-fen-hata-select[data-index="${idx}"]`);
            if (konuSelect && konuSelect.value) q.konuAdi = konuSelect.value.trim();
            if (hataSelect && hataSelect.value) q.hataKodu = hataSelect.value.trim();
        });
        activeGeneralExamState.currentStep = 1;
    }
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    const exam = student?.denemeler?.find(e => e.id === examId);
    if (!student || !exam) return;
    editGenelExam(studentId, examId, exam, true);
}

export function onGenelFenSelectChange(idx) {
    const card = document.getElementById(`genel-fen-card-${idx}`);
    const konuSelect = document.querySelector(`.genel-fen-konu-select[data-index="${idx}"]`);
    const hataSelect = document.querySelector(`.genel-fen-hata-select[data-index="${idx}"]`);
    if (card && konuSelect && hataSelect && konuSelect.value.trim() && hataSelect.value.trim()) {
        card.classList.remove('border-red-500', 'bg-red-50/20', 'dark:bg-red-950/20');
    }
}

export async function saveGenelExamWithFenAnalysis(studentId, examId) {
    if (!activeGeneralExamState || activeGeneralExamState.examId !== examId) {
        return;
    }

    const fenQuestionsToAnalyze = activeGeneralExamState.fenQuestionsToAnalyze || [];
    let missingCount = 0;
    let firstMissingCard = null;
    const fenAnalysisMap = new Map();

    fenQuestionsToAnalyze.forEach((q, idx) => {
        const card = document.getElementById(`genel-fen-card-${idx}`);
        const konuSelect = document.querySelector(`.genel-fen-konu-select[data-index="${idx}"]`);
        const hataSelect = document.querySelector(`.genel-fen-hata-select[data-index="${idx}"]`);
        const konu = konuSelect ? konuSelect.value.trim() : "";
        const hata = hataSelect ? hataSelect.value.trim() : "";

        if (!konu || !hata) {
            missingCount++;
            if (card) {
                card.classList.add('border-red-500', 'bg-red-50/20', 'dark:bg-red-950/20');
                if (!firstMissingCard) firstMissingCard = card;
            }
        } else {
            if (card) {
                card.classList.remove('border-red-500', 'bg-red-50/20', 'dark:bg-red-950/20');
            }
            q.konuAdi = konu;
            q.hataKodu = hata;
            fenAnalysisMap.set(q.globalIndex, { konuAdi: konu, hataKodu: hata });
        }
    });

    const alertBox = document.getElementById('fenValidationAlert');
    if (missingCount > 0) {
        const msg = `${missingCount} Fen hata kaydı eksik. Lütfen yanlış/boş sorular için konu ve hata nedenini seçin.`;
        if (alertBox) {
            const span = alertBox.querySelector('span') || alertBox;
            span.textContent = msg;
            alertBox.classList.remove('hidden');
            alertBox.classList.add('flex');
        }
        alert(msg);
        if (firstMissingCard && typeof firstMissingCard.scrollIntoView === 'function') {
            firstMissingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    if (alertBox) {
        alertBox.classList.add('hidden');
        alertBox.classList.remove('flex');
    }

    await saveGenelExamEdit(studentId, examId, fenAnalysisMap);
}

if (typeof window !== 'undefined') {
    window.goToGeneralFenStep2 = goToGeneralFenStep2;
    window.goToGeneralStep1 = goToGeneralStep1;
    window.saveGenelExamWithFenAnalysis = saveGenelExamWithFenAnalysis;
    window.onGenelFenSelectChange = onGenelFenSelectChange;
}

export function isExamResultPending(exam) {
    if (!exam || typeof exam !== 'object') return false;
    const totalQuestions = Number(exam.toplamSoru ?? (Array.isArray(exam.sorular) ? exam.sorular.length : 0));
    if (totalQuestions <= 0) return false;

    const dogru = Number(exam.toplamDogru ?? 0);
    const yanlis = Number(exam.toplamYanlis ?? 0);
    const bos = Number(exam.toplamBos ?? 0);

    if (dogru !== 0 || yanlis !== 0) return false;
    if (bos !== totalQuestions) return false;

    if (Array.isArray(exam.sorular) && exam.sorular.length > 0) {
        const hasAnswered = exam.sorular.some(q => q && q.durum && q.durum !== 'bos');
        if (hasAnswered) return false;
    }

    if (exam.dersSonuclari && typeof exam.dersSonuclari === 'object') {
        const results = Object.values(exam.dersSonuclari);
        if (results.length > 0) {
            const hasScore = results.some(r => r && (Number(r.dogru || 0) > 0 || Number(r.yanlis || 0) > 0));
            if (hasScore) return false;
        }
    }

    return true;
}

export function editExam(studentId, examId) {
    const students = loadStudentsData();
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const exam = student.denemeler.find(e => e.id === examId);
    if (!exam) return;
    if (exam.tip === "genel") {
        editGenelExam(studentId, examId, exam);
    } else {
        editBransExam(studentId, examId, exam);
    }
}

export function viewExam(studentId, examId) {
    const students = loadStudentsData();
    const s = students.find(s => s.id === studentId);
    if (!s) return;
    const ex = s.denemeler.find(e => e.id === examId);
    if (!ex) return;
    let detay = '<div class="space-y-1.5 max-h-80 overflow-y-auto pr-1 text-sm">';
    for (let soru of ex.sorular) {
        const durumEmoji = soru.durum === 'dogru' ? '✅' : (soru.durum === 'yanlis' ? '❌' : '⬜');
        const hataStr = soru.hataKodu ? ` (${soru.hataKodu})` : '';
        const konuStr = soru.konuAdi ? ` (${soru.konuAdi})` : '';
        detay += `<div class="border-b dark:border-gray-700 py-1.5 font-medium">${soru.soruNo}. Soru${konuStr}: ${durumEmoji} ${soru.durum}${hataStr}</div>`;
    }
    detay += '</div>';

    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4";
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl border">
            <div class="flex justify-between items-center mb-3">
                <h2 class="text-xl font-bold text-gray-805 dark:text-white">Deneme Detayı</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500"><i class="fas fa-times text-xl"></i></button>
            </div>
            <div class="bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl mb-4 border text-sm">
                <p class="font-bold text-base text-indigo-600 dark:text-indigo-400 mb-1">${escapeHtml(ex.denemeAdi)}</p>
                <p class="font-medium text-gray-600 dark:text-gray-300">Tarih: ${ex.tarih} | Net: <span class="font-bold text-blue-600">${ex.toplamNet}</span> | D:${ex.toplamDogru} Y:${ex.toplamYanlis} B:${ex.toplamBos}</p>
            </div>
            <h3 class="font-bold text-sm mb-2 text-gray-750 dark:text-gray-250">Soru Dağılımı</h3>
            ${detay}
            <div class="mt-4 flex gap-2">
                <button onclick="this.closest('.fixed').remove(); editExam('${studentId}','${examId}')" class="flex-grow bg-blue-650 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition shadow min-h-[44px]">Düzenle</button>
                <button onclick="this.closest('.fixed').remove()" class="flex-grow border py-2.5 rounded-xl font-bold min-h-[44px]">Kapat</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

export async function deleteExam(studentId, examId) {
    if (confirm("Bu denemeyi silmek istediğinize emin misiniz?")) {
        const res = await deleteStudentArrayRecord(studentId, 'denemeler', examId);
        if (res && !res.ok && res.blockedOffline) {
            alert(res.message);
            return;
        }
        if (window.renderStudentPanel) window.renderStudentPanel(studentId);
    }
}

export function copyExamToOthers(studentId, examId) {
    // Standard mock alerts as per original code
    alert("Kopyalama işlemi");
}

export function executeCopyExam(sourceStudentId, examId) {
    // Standard mock alerts as per original code
    alert("Kopyalandı");
}

export async function exportReport(format) {
    if (!store.currentStudentId) {
        alert("Önce bir öğrenci seçin");
        return;
    }
    const students = loadStudentsData();
    const student = students.find(s => s.id === store.currentStudentId);
    if (!student) return;
    const denemeler = student.denemeler || [];
    const bransDenemeler = denemeler.filter(d => d.tip === "branş");
    const bransSayisi = bransDenemeler.length;
    const bransOrt = getBransOrtalamaNet(student) || 0;
    const basari = getKonuBazliBasarilar(student);
    const { zayif } = getBestWorstTopics(basari);
    const hataIstat = getHataIstatistikleri(student);
    const hataList = HATA_KODLARI.map(h => ({ kod: h.kod, ad: h.aciklama, adet: hataIstat.hataSayilari[h.kod] || 0 }));
    const genelDenemeler = denemeler.filter(d => d.tip === "genel");
    const genelSayisi = genelDenemeler.length;
    const dersBazliToplam = {};
    GENEL_DERSLER_KEY.forEach(d => dersBazliToplam[d] = { dogru: 0, toplamSoru: 0 });
    for (let den of genelDenemeler) {
        if (den.dersSonuclari) {
            for (let d in den.dersSonuclari) {
                if (dersBazliToplam[d]) {
                    dersBazliToplam[d].dogru += den.dersSonuclari[d].dogru;
                    dersBazliToplam[d].toplamSoru += (den.dersSonuclari[d].dogru + den.dersSonuclari[d].yanlis + den.dersSonuclari[d].bos);
                }
            }
        }
    }
    const dersYuzdeler = [];
    for (let i = 0; i < GENEL_DERSLER_KEY.length; i++) {
        const d = GENEL_DERSLER_KEY[i];
        const t = dersBazliToplam[d].toplamSoru;
        const yuzde = t ? ((dersBazliToplam[d].dogru / t) * 100).toFixed(1) : null;
        dersYuzdeler.push({ ad: GENEL_DERSLER_GORUNUM[i], yuzde: yuzde });
    }

    const is8thGrade = String(student.sinif).trim() === "8" || (student.adSoyad && student.adSoyad.includes("(8)"));

    // 1. Weekly Schedule HTML
    const scheduleList = loadSchedule(student.id) || [];
    const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    let scheduleHtml = '';
    if (scheduleList.length === 0) {
        scheduleHtml = '<p style="color: gray; font-style: italic; font-size: 13px;">Ders programı planlanmamış.</p>';
    } else {
        scheduleHtml = `<table style="width:100%; border-collapse:collapse; margin-top:5px; font-size: 13px;">
            <thead>
                <tr style="background:#f3f4f6; border-bottom:1px solid #d1d5db;">
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Gün</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Saat</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Ders</th>
                </tr>
            </thead>
            <tbody>`;
        const sortedSchedule = [...scheduleList].sort((a, b) => {
            const dayDiff = gunler.indexOf(a.gun) - gunler.indexOf(b.gun);
            if (dayDiff !== 0) return dayDiff;
            return a.saat.localeCompare(b.saat);
        });
        sortedSchedule.forEach(item => {
            const dersAdi = (is8thGrade && item.dersAdi === "Sosyal Bilgiler") ? "İnkılap Tarihi" : item.dersAdi;
            scheduleHtml += `<tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:6px; border:1px solid #d1d5db; font-weight:bold;">${item.gun}</td>
                <td style="padding:6px; border:1px solid #d1d5db;">${item.saat}</td>
                <td style="padding:6px; border:1px solid #d1d5db; color:#4f46e5; font-weight:bold;">${dersAdi}</td>
            </tr>`;
        });
        scheduleHtml += `</tbody></table>`;
    }

    // 2. Homework Records HTML (last 5)
    const odevlerList = getStudentOdevler(student) || [];
    let homeworkHtml = '';
    if (odevlerList.length === 0) {
        homeworkHtml = '<p style="color: gray; font-style: italic; font-size: 13px;">Atanmış ödev bulunmamaktadır.</p>';
    } else {
        homeworkHtml = `<table style="width:100%; border-collapse:collapse; margin-top:5px; font-size: 13px;">
            <thead>
                <tr style="background:#f3f4f6; border-bottom:1px solid #d1d5db;">
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Ödev Konusu</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Bitiş</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Durum</th>
                </tr>
            </thead>
            <tbody>`;
        odevlerList.slice(-5).reverse().forEach(o => {
            let statusText = '';
            if (o.durum === "Tamamlandı") {
                statusText = `✅ Yapıldı (${o.dogru}D ${o.yanlis}Y)`;
            } else if (o.durum === "Süresi Geçti") {
                statusText = `❌ Yapılmadı`;
            } else {
                statusText = `⏳ Bekliyor`;
            }
            homeworkHtml += `<tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:6px; border:1px solid #d1d5db; font-weight:semibold;">${escapeHtml(o.konu)} <span style="font-size:11px; color:gray;">(${escapeHtml(o.yayin)})</span></td>
                <td style="padding:6px; border:1px solid #d1d5db; font-size:11px;">${o.bitisTarihi}</td>
                <td style="padding:6px; border:1px solid #d1d5db; font-weight:bold; font-size:11px;">${statusText}</td>
            </tr>`;
        });
        homeworkHtml += `</tbody></table>`;
    }

    // 3. Lesson Records HTML (last 5)
    const dersKayitlariList = loadDersKayitlari(student.id) || [];
    let lessonsHtml = '';
    if (dersKayitlariList.length === 0) {
        lessonsHtml = '<p style="color: gray; font-style: italic; font-size: 13px;">Ders kaydı bulunmamaktadır.</p>';
    } else {
        lessonsHtml = `<table style="width:100%; border-collapse:collapse; margin-top:5px; font-size: 13px;">
            <thead>
                <tr style="background:#f3f4f6; border-bottom:1px solid #d1d5db;">
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">No</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Tarih</th>
                    <th style="padding:6px; text-align:left; border:1px solid #d1d5db;">Konu</th>
                </tr>
            </thead>
            <tbody>`;
        dersKayitlariList.slice(-5).reverse().forEach(k => {
            lessonsHtml += `<tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:6px; border:1px solid #d1d5db;">${k.dersNo}</td>
                <td style="padding:6px; border:1px solid #d1d5db; font-size:11px;">${k.tarih}</td>
                <td style="padding:6px; border:1px solid #d1d5db; font-weight:bold; color:#0f766e;">${escapeHtml(k.konu)}</td>
            </tr>`;
        });
        lessonsHtml += `</tbody></table>`;
    }

    const reportContent = `
        <div style="font-family: Arial, sans-serif; max-width: 1100px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4f46e5; text-align: center; margin-bottom: 5px;">Canfenci Öğrenci Takip Sistemi Raporu</h1>
            <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px;">
                <h2 style="margin: 5px 0; color: #1f2937;">${escapeHtml(student.adSoyad)}</h2>
                <p style="color: #4b5563; margin: 5px 0;">🏫 ${escapeHtml(student.okul)} | 📚 ${student.sinif ? student.sinif + '. Sınıf' : 'Sınıf belirtilmemiş'} | 🎯 Hedef Net: ${student.hedefNet} | 🏫 Hedef Lise: ${escapeHtml(student.hedefLise)}</p>
            </div>

            <div style="display: flex; gap: 30px; margin-bottom: 20px;">
                <div style="flex: 1; background: #fafafa; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <h3 style="background: #0f766e; color: white; padding: 8px 12px; border-radius: 8px; margin-top: 0;">🔬 Konu Denemesi Analizi</h3>
                    <p style="margin: 8px 0;"><strong>Toplam Konu Denemesi Sayısı:</strong> ${bransSayisi}</p>
                    <p style="margin: 8px 0;"><strong>Ortalama Net:</strong> <span style="color:#0f766e; font-weight:bold;">${bransOrt.toFixed(2)}</span></p>
                    <h4 style="margin: 12px 0 5px 0; color: #374151; border-bottom: 1px solid #e5e7eb; pb: 3px;">📉 En Zayıf 3 Yapılamayan Konu</h4>
                    <ul style="margin: 5px 0; padding-left: 20px;">${zayif.map(z => `<li>${z.konu} (%${z.yuzde})</li>`).join('') || '<li>Veri yok</li>'}</ul>
                    <h4 style="margin: 15px 0 5px 0; color: #374151; border-bottom: 1px solid #e5e7eb; pb: 3px;">⚠️ Hata Kodu Analizi</h4>
                    <ul style="margin: 5px 0; padding-left: 20px; font-size:13px; color:#4b5563;">${hataList.map(h => `<li><strong>${h.kod}</strong> - ${h.ad}: ${h.adet} hata</li>`).join('')}</ul>
                </div>

                <div style="flex: 1; background: #fafafa; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <h3 style="background: #4f46e5; color: white; padding: 8px 12px; border-radius: 8px; margin-top: 0;">📘 Genel Deneme Analizi</h3>
                    <p style="margin: 8px 0;"><strong>Toplam Genel Deneme Sayısı:</strong> ${genelSayisi}</p>
                    <p style="margin: 8px 0;"><strong>Ortalama Net:</strong> <span style="color:#4f46e5; font-weight:bold;">${getGenelOrtalamaNet(student) || 0}</span></p>
                    <p style="margin: 8px 0;"><strong>Tahmini LGS Puanı:</strong> <span style="color:#10b981; font-weight:bold;">${lgsPuanHesapla(genelDenemeler) || '—'}</span></p>
                    <h4 style="margin: 12px 0 5px 0; color: #374151; border-bottom: 1px solid #e5e7eb; pb: 3px;">📚 Ders Bazlı Ortalama Başarı (%)</h4>
                    <ul style="margin: 5px 0; padding-left: 20px; font-size: 13px;">${dersYuzdeler.map(d => `<li><strong>${d.ad}:</strong> ${d.yuzde !== null ? d.yuzde + '%' : '—'}</li>`).join('')}</ul>
                </div>
            </div>

            <div style="display: flex; gap: 30px;">
                <div style="flex: 1; background: #fafafa; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <h3 style="background: #312e81; color: white; padding: 8px 12px; border-radius: 8px; margin-top: 0;">📅 Haftalık Ders Programı</h3>
                    ${scheduleHtml}
                </div>
                <div style="flex: 1; background: #fafafa; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <h3 style="background: #0369a1; color: white; padding: 8px 12px; border-radius: 8px; margin-top: 0;">📝 Son Ödevler ve Yapılan Dersler</h3>
                    <h4 style="margin: 5px 0; color: #374151;">📖 Son Dersler</h4>
                    ${lessonsHtml}
                    <h4 style="margin: 15px 0 5px 0; color: #374151;">⏳ Son Atanan Ödevler</h4>
                    ${homeworkHtml}
                </div>
            </div>

            <hr style="margin: 30px 0 15px 0; border: 0; border-top: 1px solid #e5e7eb;">
            <p style="text-align: center; font-size: 12px; color: #9ca3af; margin: 0;">Rapor Tarihi: ${new Date().toLocaleDateString()} - Canfenci Öğrenci Takip Sistemi</p>
        </div>
    `;
    if (format === 'pdf') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`<html><head><title>${student.adSoyad} - Deneme Raporu</title><style>body { font-family: Arial; margin: 20px; }</style></head><body>${reportContent}</body></html>`);
            printWindow.document.close();
            printWindow.print();
        } else {
            alert("Açılır pencere engellendi! Lütfen izin verin.");
        }
    } else if (format === 'word') {
        try {
            const blob = new Blob([reportContent], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${student.adSoyad}_rapor.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert("Word raporu oluşturulamadı: " + err.message);
        }
    }
}

// Global window mappings for compatibility
window.showDenemeAtaModal = showDenemeAtaModal;
window.renderDenemeAtaModal = renderDenemeAtaModal;
window.closeDenemeAtaModal = closeDenemeAtaModal;
window.saveDenemeAta = saveDenemeAta;
window.saveBransExamEdit = saveBransExamEdit;
window.saveGenelExamEdit = saveGenelExamEdit;
window.editExam = editExam;
window.viewExam = viewExam;
window.deleteExam = deleteExam;
window.copyExamToOthers = copyExamToOthers;
window.executeCopyExam = executeCopyExam;
window.exportReport = exportReport;
window.lgsPuanHesapla = lgsPuanHesapla;
window.getBransOrtalamaNet = getBransOrtalamaNet;
window.getGenelOrtalamaNet = getGenelOrtalamaNet;
window.getOrtalamaNet = getOrtalamaNet;
window.getKonuBazliBasarilar = getKonuBazliBasarilar;
window.getBestWorstTopics = getBestWorstTopics;
window.getMotivationMessage = getMotivationMessage;
window.getHataIstatistikleri = getHataIstatistikleri;
window.updateTopicExamOptions = updateTopicExamOptions;
window.toggleTopicExamManualTopic = toggleTopicExamManualTopic;
window.toggleTopicExamManualResource = toggleTopicExamManualResource;
window.isExamResultPending = isExamResultPending;
window.isFenBranchExam = isFenBranchExam;
window.goToFenHataAnaliziStep = goToFenHataAnaliziStep;
window.goToFenStep1 = goToFenStep1;
window.onFenSelectChange = onFenSelectChange;
window.saveFenExamWithAnalysis = saveFenExamWithAnalysis;
