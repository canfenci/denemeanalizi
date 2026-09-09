import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readProjectFile = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Firestore rules require verified ownership and contain no public homework access', async () => {
  const rules = await readProjectFile('firestore.rules');

  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /request\.resource\.data\.userId == resource\.data\.userId/);
  assert.doesNotMatch(rules, /allow\s+(read|update|write)[^:]*:\s*if\s+true/);
});

test('authentication errors never embed a password in generated HTML', async () => {
  const auth = await readProjectFile('auth.js');

  assert.doesNotMatch(auth, /resendVerificationEmail\([^)]*password/);
  assert.doesNotMatch(auth, /password\.replace/);
});

test('successful authentication restores navigation before cloud profile loading', async () => {
  const [auth, index, serviceWorker] = await Promise.all([
    readProjectFile('auth.js'),
    readProjectFile('index.html'),
    readProjectFile('sw.js')
  ]);

  const restorePosition = auth.indexOf('restoreNavigationLayout();', auth.indexOf('export async function handleLogin'));
  const profileFetchPosition = auth.indexOf('collection("users")', auth.indexOf('export async function handleLogin'));
  assert.ok(restorePosition > -1 && restorePosition < profileFetchPosition);
  assert.match(auth, /renderAppLoadingState\(\)/);
  assert.match(auth, /Verileriniz hazırlanıyor/);
  assert.match(index, /if \(window\.restoreNavigationLayout\) window\.restoreNavigationLayout\(\)/);
  assert.match(index, /if \(window\.renderAppLoadingState\) window\.renderAppLoadingState\(\)/);
  assert.match(auth, /mainContent\.className = "app-workspace w-full md:w-3\/4/);
  assert.match(serviceWorker, /canfenci-cache-v86/);
});

test('mobile layout contains wide schedules and keeps Safari forms usable', async () => {
  const [index, schedule] = await Promise.all([
    readProjectFile('index.html'),
    readProjectFile('schedule.js')
  ]);
  assert.match(index, /\.app-page > \* \{ min-width: 0; \}/);
  assert.match(index, /overflow-x: hidden/);
  assert.match(index, /font-size: 16px !important/);
  assert.match(index, /\.mobile-nav-btn \{ min-width: 0; font-size: \.68rem !important; \}/);
  assert.match(index, /100dvh - 2rem/);
  assert.match(schedule, /flex flex-col lg:flex-row lg:items-center/);
  assert.match(schedule, /w-full lg:w-auto min-w-0/);
});

test('login refreshes Safari verification state and preserves sign-out feedback', async () => {
  const auth = await readProjectFile('auth.js');

  assert.match(auth, /await user\.reload\(\)/);
  assert.match(auth, /user = auth\.currentUser \|\| user/);
  assert.match(auth, /sessionStorage\.setItem\('canfenci_auth_flash_v1'/);
  assert.match(auth, /sessionStorage\.getItem\('canfenci_auth_flash_v1'\)/);
  assert.match(auth, /sessionStorage\.removeItem\('canfenci_auth_flash_v1'\)/);
  assert.ok(auth.indexOf('await user.reload()') < auth.indexOf('if (!user.emailVerified)'));
});

test('login offers privacy-preserving Firebase password reset', async () => {
  const [auth, serviceWorker] = await Promise.all([
    readProjectFile('auth.js'),
    readProjectFile('sw.js')
  ]);

  assert.match(auth, /Şifremi unuttum/);
  assert.match(auth, /handlePasswordReset/);
  assert.match(auth, /auth\.sendPasswordResetEmail\(email/);
  assert.match(auth, /https:\/\/canfenci\.github\.io\/ogrenci-takip\//);
  assert.match(auth, /Bu adresle kayıtlı bir hesap varsa/);
  assert.doesNotMatch(auth, /Bu e-posta adresi kayıtlı değil/);
  assert.match(auth, /auth\/too-many-requests/);
  assert.match(serviceWorker, /canfenci-cache-v86/);
});

test('registration requires a versioned KVKK notice acknowledgment without conflating consent', async () => {
  const [auth, notice, index, students, serviceWorker] = await Promise.all([
    readProjectFile('auth.js'),
    readProjectFile('privacy-notice.js'),
    readProjectFile('index.html'),
    readProjectFile('students.js'),
    readProjectFile('sw.js')
  ]);

  assert.match(auth, /privacyNoticeAcknowledged/);
  assert.match(auth, /privacyNoticeVersion: PRIVACY_NOTICE_VERSION/);
  assert.match(auth, /privacyNoticeAcknowledgedAt: new Date\(\)\.toISOString\(\)/);
  assert.ok(auth.indexOf("privacyNoticeAcknowledged')?.checked") < auth.indexOf('createUserWithEmailAndPassword'));
  assert.match(auth, /Bunun açık rıza değil, veri işleme hakkında bilgilendirme/);
  assert.match(notice, /Murat Can Baş/);
  assert.match(notice, /cnmrt84@gmail\.com/);
  assert.match(notice, /Google Firebase\/Firestore/);
  assert.match(notice, /KVKK’nın 11\. maddesi/);
  assert.match(notice, /otomatik bir sorumluluk kabulü değildir/);
  assert.match(notice, /yurt dışı aktarım şartlarına ilişkin uygun güvenceler/);
  assert.match(index, /import '\.\/privacy-notice\.js'/);
  assert.match(students, /Gizlilik ve KVKK Aydınlatma Metni/);
  assert.match(serviceWorker, /privacy-notice\.js/);
  assert.match(serviceWorker, /canfenci-cache-v86/);
});

test('account deletion reauthenticates and removes every owned cloud collection before auth', async () => {
  const [deletion, index, students, serviceWorker] = await Promise.all([
    readProjectFile('account-deletion.js'),
    readProjectFile('index.html'),
    readProjectFile('students.js'),
    readProjectFile('sw.js')
  ]);

  for (const collection of ['homeworks', 'schedules', 'lessons', 'groups', 'resourceBooks', 'students']) {
    assert.match(deletion, new RegExp(`['"]${collection}['"]`));
  }
  assert.match(deletion, /where\('userId', '==', userId\)/);
  assert.match(deletion, /offset \+= 400/);
  assert.match(deletion, /EmailAuthProvider\.credential/);
  assert.match(deletion, /reauthenticateWithCredential/);
  assert.match(deletion, /phrase !== 'HESABIMI SİL'/);
  assert.match(deletion, /deleteOwnedCollection[\s\S]*collection\('users'\)[\s\S]*user\.delete\(\)/);
  assert.ok(deletion.indexOf("collection('users').doc(user.uid).delete()") < deletion.indexOf('await user.delete()'));
  assert.match(deletion, /clearDeletedAccountLocalData/);
  assert.match(index, /import '\.\/account-deletion\.js'/);
  assert.match(students, /Hesabımı ve Verilerimi Sil/);
  assert.match(serviceWorker, /account-deletion\.js/);
  assert.match(serviceWorker, /canfenci-cache-v86/);
});

test('public homework links are disabled and are not included in reminders', async () => {
  const [index, homework] = await Promise.all([
    readProjectFile('index.html'),
    readProjectFile('homework.js')
  ]);

  assert.match(index, /herkese açık ödev sonuç bağlantıları kapatıldı/);
  assert.doesNotMatch(homework, /D\/Y Sonuç Giriş Bağlantısı/);
  assert.doesNotMatch(homework, /aşağıdaki güvenli bağlantıyı kullanabilirsiniz/);
});

test('service worker only runtime-caches same-origin requests without query data', async () => {
  const serviceWorker = await readProjectFile('sw.js');

  assert.match(serviceWorker, /requestUrl\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /requestUrl\.search/);
  assert.doesNotMatch(serviceWorker, /ASSETS_TO_CACHE[\s\S]*https:\/\//);
});

test('student deletion includes dependent cloud records', async () => {
  const students = await readProjectFile('students.js');

  assert.match(students, /\["schedules", "lessons", "homeworks"\]/);
  assert.match(students, /where\("userId", "==", user\.uid\)/);
  assert.match(students, /where\("studentId", "==", id\)/);
  assert.match(students, /dependentSnapshots\.forEach/);
  assert.doesNotMatch(students, /collection\("schedules"\)\.doc\(id\)/);
  assert.doesNotMatch(students, /collection\("lessons"\)\.doc\(id\)/);
  assert.match(students, /await batch\.commit\(\)/);
  assert.match(students, /hiçbir kayıt değiştirilmedi/);
});

test('production cloud sync isolates authenticated accounts from shared local data', async () => {
  const [firebaseConfig, store] = await Promise.all([
    readProjectFile('firebase-config.js'),
    readProjectFile('store.js')
  ]);

  assert.match(firebaseConfig, /const CLOUD_FEATURES_ENABLED = true/);
  assert.match(firebaseConfig, /store\.syncUserId === user\.uid/);
  assert.match(firebaseConfig, /store\.useFirestore = true/);
  assert.match(firebaseConfig, /LOCAL_DATA_OWNER_KEY/);
  assert.match(firebaseConfig, /belongsToAnotherAccount/);
  assert.match(firebaseConfig, /resetFirestoreSync/);
  assert.match(firebaseConfig, /firestoreUnsubscribers/);
  assert.match(firebaseConfig, /hydrateTeacherProfile/);
  assert.match(firebaseConfig, /localStorage\.removeItem\('teacher_profile_completed_v1'\)/);
  assert.match(firebaseConfig, /store\.syncUserId !== user\.uid/);
  assert.match(store, /useFirestore: false/);
  assert.match(store, /syncUserId: null/);
});

test('manual local recovery requires the exact verified account and an empty cloud account', async () => {
  const [firebaseConfig, students, serviceWorker] = await Promise.all([
    readProjectFile('firebase-config.js'),
    readProjectFile('students.js'),
    readProjectFile('sw.js')
  ]);

  assert.match(firebaseConfig, /migrateLocalDataToCurrentAccount/);
  assert.match(firebaseConfig, /!user \|\| !user\.emailVerified/);
  assert.match(firebaseConfig, /enteredEmail !== expectedEmail/);
  assert.match(firebaseConfig, /limit\(1\)\.get\(\)/);
  assert.match(firebaseConfig, /if \(!existingCloudData\.empty\)/);
  assert.match(firebaseConfig, /Yerel kayıtlar silinmeyecek/);
  assert.match(students, /Yerel Kayıt Kurtarma/);
  assert.match(students, /Açık hesap:/);
  assert.match(students, /startLocalDataRecovery/);
  assert.match(serviceWorker, /canfenci-cache-v86/);
});

test('guest trial mode is clearly labeled and isolated from account-local records', async () => {
  const [auth, store, profile, resources, reminders, serviceWorker] = await Promise.all([
    readProjectFile('auth.js'),
    readProjectFile('store.js'),
    readProjectFile('teacher-profile.js'),
    readProjectFile('resource-books.js'),
    readProjectFile('lesson-reminders.js'),
    readProjectFile('sw.js')
  ]);

  assert.match(auth, /Misafir Olarak Dene/);
  assert.match(auth, /yalnızca bu cihazda saklanır ve bulut hesaplarıyla paylaşılmaz/);
  assert.match(auth, /store\.isGuestMode = true/);
  assert.match(store, /GUEST_STORAGE_PREFIX/);
  assert.match(store, /localDataKey\(STORAGE_KEY\)/);
  assert.match(store, /localDataKey\(SCHEDULE_KEY\)/);
  assert.match(store, /localDataKey\(DERS_KAYITLARI_KEY\)/);
  assert.match(store, /localDataKey\(GROUPS_KEY\)/);
  assert.match(profile, /localDataKey\('teacher_name_v1'\)/);
  assert.match(profile, /!store\.isGuestMode/);
  assert.match(resources, /window\.store\?\.isGuestMode/);
  assert.match(reminders, /window\.localDataKey/);
  assert.match(serviceWorker, /canfenci-cache-v86/);
});

test('resource books sync per verified teacher while guest books remain local', async () => {
  const [rules, firebaseConfig, store, resources, serviceWorker] = await Promise.all([
    readProjectFile('firestore.rules'),
    readProjectFile('firebase-config.js'),
    readProjectFile('store.js'),
    readProjectFile('resource-books.js'),
    readProjectFile('sw.js')
  ]);

  assert.match(rules, /match \/resourceBooks\/\{bookId\}/);
  assert.match(firebaseConfig, /collection\("resourceBooks"\)\.where\("userId", "==", user\.uid\)/);
  assert.match(firebaseConfig, /localDataOwner === user\.uid/);
  assert.match(firebaseConfig, /doc\(`\$\{user\.uid\}_\$\{book\.id\}`\)/);
  assert.match(store, /globalResourceBooks: \[\]/);
  assert.match(resources, /window\.store\.globalResourceBooks/);
  assert.match(resources, /collection\('resourceBooks'\)/);
  assert.match(resources, /userId: user\.uid/);
  assert.match(resources, /window\.store\?\.isGuestMode/);
  assert.match(serviceWorker, /canfenci-cache-v86/);
});

test('first use requires a complete local teacher profile that remains editable in settings', async () => {
  const [index, profile, students, serviceWorker] = await Promise.all([
    readProjectFile('index.html'),
    readProjectFile('teacher-profile.js'),
    readProjectFile('students.js'),
    readProjectFile('sw.js')
  ]);

  assert.match(index, /ensureTeacherProfile/);
  assert.match(profile, /Öğretmen Profilinizi Oluşturun/);
  assert.match(profile, /adınızı ve soyadınızı birlikte yazın/);
  assert.match(profile, /çalıştığınız okul veya kurumun adını yazın/);
  assert.match(profile, /en az bir dersi seçin/);
  assert.match(profile, /teacher_profile_completed_v1/);
  assert.match(profile, /name === 'Öğretmen Adı'/);
  assert.match(profile, /school === 'Belirtilmemiş Okul'/);
  assert.match(students, /saveTeacherProfileFromSettings/);
  assert.match(serviceWorker, /teacher-profile\.js/);
});

test('student progress UI includes timeline and upcoming lesson surfaces', async () => {
  const [students, serviceWorker] = await Promise.all([
    readProjectFile('students.js'),
    readProjectFile('sw.js')
  ]);

  assert.match(students, /Öğrenci Gelişim Merkezi/);
  assert.match(students, /Zaman Çizelgesi/);
  assert.match(students, /Yaklaşan ders/);
  assert.match(serviceWorker, /student-insights\.js/);
});

test('student detail includes explainable smart exam analysis', async () => {
  const students = await readProjectFile('students.js');

  assert.match(students, /Akıllı Deneme Analizi/);
  assert.match(students, /Ders Bazlı Son 5 Deneme/);
  assert.match(students, /Öncelikli Konular/);
  assert.match(students, /Veri tutarlılığı uyarıları/);
});

test('student pricing is presented as a per-lesson fee with legacy data fallback', async () => {
  const students = await readProjectFile('students.js');
  const finance = await readProjectFile('finance.js');
  const store = await readProjectFile('store.js');

  assert.doesNotMatch(students, /Aylık Ücret/);
  assert.match(students, /Bir Ders Ücreti/);
  assert.match(finance, /s\.dersUcreti/);
  assert.match(store, /dersUcreti: s\.dersUcreti \|\| s\.aylikUcret \|\| s\.ucret/);
});

test('lesson reminders require user action for WhatsApp and avoid duplicate notifications', async () => {
  const reminders = await readProjectFile('lesson-reminders.js');
  const serviceWorker = await readProjectFile('sw.js');

  assert.match(reminders, /Notification\.permission === 'granted'/);
  assert.match(reminders, /isNotified/);
  assert.match(reminders, /!reminder\.isDue/);
  assert.match(reminders, /markLessonReminderSent/);
  assert.match(reminders, /window\.open\(url, '_blank'/);
  assert.doesNotMatch(reminders, /fetch\([^)]*api\.whatsapp/);
  assert.match(reminders, /WhatsApp’tan Gönder/);
  assert.match(reminders, /Güvenlik nedeniyle WhatsApp gönderimi/);
  assert.match(reminders, /Ders başlamadan 2 saat önce/);
  assert.match(serviceWorker, /lesson-reminders\.js/);
});

test('finance excludes cancelled and excused lessons from billing', async () => {
  const finance = await readProjectFile('finance.js');
  const serviceWorker = await readProjectFile('sw.js');
  assert.match(finance, /calculateLessonFinance/);
  assert.match(finance, /Katılım Durumu/);
  assert.match(finance, /Ücret Yok/);
  assert.match(serviceWorker, /lesson-finance-insights\.js/);
});

test('release hardening adds validation, keyboard navigation and fresh core assets', async () => {
  const index = await readProjectFile('index.html');
  const students = await readProjectFile('students.js');
  const serviceWorker = await readProjectFile('sw.js');
  assert.match(index, /Ana içeriğe geç/);
  assert.match(index, /<main id="dynamic-content"/);
  assert.match(students, /validateStudentInput/);
  assert.match(serviceWorker, /isFreshnessCritical/);
  assert.match(serviceWorker, /data-validation\.js/);
});

test('settings navigation owns the all-student reminder center', async () => {
  const index = await readProjectFile('index.html');
  const students = await readProjectFile('students.js');
  const schedule = await readProjectFile('schedule.js');
  assert.match(index, /topbar-nav-general[^>]+>[\s\S]*<i class="fas fa-cog/);
  assert.match(students, /renderLessonReminderCenter/);
  assert.match(students, /app-page-title">Ayarlar/);
  assert.doesNotMatch(schedule, /renderLessonReminderCenter/);
});

test('home and settings are separate navigation destinations', async () => {
  const index = await readProjectFile('index.html');
  const students = await readProjectFile('students.js');
  assert.match(index, /sidebar-nav-reminders[^>]+renderReminderHome/);
  assert.match(index, /topbar-nav-general[^>]+renderGenelIslemler/);
  assert.match(students, /function renderReminderHome/);
  assert.match(students, /mobile-nav-reminders/);
  assert.match(students, /app-page-title">Ayarlar/);
});

test('lesson records link to the canonical homework workflow without duplicate entry fields', async () => {
  const [finance, homework, store] = await Promise.all([
    readProjectFile('finance.js'),
    readProjectFile('homework.js'),
    readProjectFile('store.js')
  ]);

  assert.match(finance, /openHomeworkForLesson/);
  assert.match(finance, /Bağlantılı Ödev/);
  assert.doesNotMatch(finance, /id="yeniOdev"/);
  assert.doesNotMatch(finance, /window\.addOdevToList/);
  assert.match(homework, /kaynakDers/);
  assert.match(homework, /Ders kaydına bağlı ödev/);
  assert.match(store, /odevler: Array\.isArray\(s\.odevler\) \? s\.odevler : \[\]/);
});

test('future lesson records default to planned attendance and schedule labels omit school names', async () => {
  const [finance, attendance, schedule] = await Promise.all([
    readProjectFile('finance.js'),
    readProjectFile('lesson-finance-insights.js'),
    readProjectFile('schedule.js')
  ]);

  assert.match(attendance, /planlandi: 'Planlandı \/ Henüz İşlenmedi'/);
  assert.match(finance, /Ders önceden giriliyorsa “Planlandı” olarak bırakın/);
  assert.doesNotMatch(schedule, /escapeHtml\(s\.adSoyad\)\} \(\$\{escapeHtml\(s\.okul\)\}\)/);
});

test('lesson attendance and payment statuses are editable with inline dropdowns', async () => {
  const finance = await readProjectFile('finance.js');
  assert.match(finance, /updateDersKatilimDurumu/);
  assert.match(finance, /updateDersUcretDurumu/);
  assert.match(finance, /<select id="attendance-/);
  assert.match(finance, /<select id="payment-/);
  assert.match(finance, /Durum \(Ücret\)/);
  assert.match(finance, />Bekliyor<\/option>/);
  assert.match(finance, />Ödendi<\/option>/);
  assert.doesNotMatch(finance, /confirm\("Ödendi mi\?/);
});

test('lesson editing uses an expandable inline form instead of browser prompts', async () => {
  const finance = await readProjectFile('finance.js');
  assert.match(finance, /toggleDersKayitEditor/);
  assert.match(finance, /saveDersKayitEditor/);
  assert.match(finance, /Değişiklikleri Kaydet/);
  assert.match(finance, /Vazgeç/);
  assert.match(finance, /edit-date-/);
  assert.match(finance, /edit-subject-/);
  assert.match(finance, /edit-topic-/);
  assert.doesNotMatch(finance, /prompt\("Tarih/);
  assert.doesNotMatch(finance, /prompt\("Konu/);
  assert.doesNotMatch(finance, /prompt\("İçerik/);
});

test('lesson-linked topic homework results feed topic exam progress', async () => {
  const [homework, exams, students, serviceWorker] = await Promise.all([
    readProjectFile('homework.js'),
    readProjectFile('exams.js'),
    readProjectFile('students.js'),
    readProjectFile('sw.js')
  ]);
  assert.match(homework, /odevTurSelect'\)\.value = 'Konu Denemesi'/);
  assert.match(homework, /calculateTopicTestNet/);
  assert.match(exams, /Konu Denemesi<\/button>/);
  assert.match(exams, /bransKonuAdi/);
  assert.match(students, /calculateTopicExamProgress/);
  assert.match(students, /Ort\. Doğru/);
  assert.match(students, /Ort\. Yanlış/);
  assert.match(students, /Ort\. Net/);
  assert.match(serviceWorker, /topic-exam-insights\.js/);
});

test('weekly schedule prevents conflicts across different students', async () => {
  const [schedule, serviceWorker] = await Promise.all([
    readProjectFile('schedule.js'),
    readProjectFile('sw.js')
  ]);
  assert.match(schedule, /findScheduleConflict/);
  assert.match(schedule, /getAllSchedulesByStudent/);
  assert.match(schedule, /buildScheduleConflictMessage/);
  assert.match(serviceWorker, /schedule-conflicts\.js/);
});

test('grade-specific resource books are selectable with a manual fallback', async () => {
  const [students, homework, exams, finance, serviceWorker] = await Promise.all([
    readProjectFile('students.js'), readProjectFile('homework.js'), readProjectFile('exams.js'), readProjectFile('finance.js'), readProjectFile('sw.js')
  ]);
  assert.match(students, /Kaynak Kitaplar/);
  assert.match(homework, /odevYayinSelect/);
  assert.match(exams, /bransKaynak/);
  assert.match(finance, /kayitKaynak/);
  assert.match(serviceWorker, /resource-books\.js/);
});

test('homework results capture main and optional subtopic errors', async () => {
  const [homework, students, serviceWorker] = await Promise.all([
    readProjectFile('homework.js'), readProjectFile('students.js'), readProjectFile('sw.js')
  ]);
  assert.match(homework, /Yanlış Yapılan Ana Konu/);
  assert.match(homework, /Alt Konu/);
  assert.match(homework, /manualWrongSubtopicText/);
  assert.doesNotMatch(homework, /id="manualWrongSubtopic"/);
  assert.match(homework, /yanlisKonular/);
  assert.match(students, /Alt Konu Hataları/);
  assert.match(serviceWorker, /homework-error-topics\.js/);
});

test('homework type separates activity from resource-book identity', async () => {
  const homework = await readProjectFile('homework.js');
  const typeSelect = homework.match(/<select id="odevTurSelect"[\s\S]*?<\/select>/)?.[0] || '';
  assert.doesNotMatch(typeSelect, /Soru Bankası/);
  assert.match(typeSelect, /<option value="Konu Tekrarı" selected>/);
});

test('homework assignment requires a resource work detail', async () => {
  const homework = await readProjectFile('homework.js');
  assert.match(homework, /id="odevCalismaDetayi"/);
  assert.match(homework, /1\. Deneme, Test 24-25 veya Sayfa 40-45/);
  assert.match(homework, /calismaDetayi,/);
  assert.match(homework, /kaynak ve çalışma detayı/);
});

test('homework tracking includes unified test and topic-exam performance chart', async () => {
  const [homework, serviceWorker] = await Promise.all([readProjectFile('homework.js'), readProjectFile('sw.js')]);
  assert.match(homework, /Çalışma Performansı/);
  assert.match(homework, /workPerformanceChart/);
  assert.match(homework, /Ort\. Doğru/);
  assert.match(homework, /Ort\. Yanlış/);
  assert.match(homework, /Ort\. Net/);
  assert.match(serviceWorker, /work-performance-insights\.js/);
});

test('student list and guidance open the same direct student cockpit', async () => {
  const [index, students, guidance, serviceWorker] = await Promise.all([
    readProjectFile('index.html'), readProjectFile('students.js'), readProjectFile('guidance.js'), readProjectFile('sw.js')
  ]);
  assert.match(index, /sidebar-nav-guidance/);
  assert.match(index, /Rehberlik/);
  assert.match(students, /renderStudentCockpit/);
  assert.match(students, /Öğrenci Kokpitini aç/);
  assert.match(students, /renderStudentCockpit/);
  assert.doesNotMatch(students, /Rehberlik Dosyasını Aç/);
  assert.match(students, /Rehberlik Planı/);
  assert.match(students, /window\.selectStudent = \(id\) => renderStudentCockpit\(id, 'home'\)/);
  assert.match(guidance, /openGuidanceStudent/);
  assert.match(serviceWorker, /guidance\.js/);
});

test('lesson records use the shared professional layout and mobile cards', async () => {
  const [index, finance, serviceWorker] = await Promise.all([
    readProjectFile('index.html'), readProjectFile('finance.js'), readProjectFile('sw.js')
  ]);
  assert.match(index, /\.app-page/);
  assert.match(index, /\.app-data-table/);
  assert.match(finance, /app-disclosure/);
  assert.match(finance, /mobile-attendance-/);
  assert.match(finance, /hidden md:block app-panel/);
  assert.match(serviceWorker, /canfenci-cache-v86/);
});

test('the shared palette uses indigo actions and semantic status colors', async () => {
  const [index, finance, serviceWorker] = await Promise.all([
    readProjectFile('index.html'), readProjectFile('finance.js'), readProjectFile('sw.js')
  ]);
  assert.match(index, /--brand-600: #394B87/);
  assert.match(index, /--success: #059669/);
  assert.match(index, /\.btn-primary/);
  assert.doesNotMatch(index, /sidebar-icon text-xl text-(?:blue|green|violet|purple|indigo|orange|pink|teal|amber)-500/);
  assert.match(finance, /Ders Kaydını Kaydet/);
  assert.match(serviceWorker, /canfenci-cache-v86/);
});

test('schedule groups and settings use the unified workspace design', async () => {
  const [schedule, groups, students, serviceWorker] = await Promise.all([
    readProjectFile('schedule.js'), readProjectFile('groups.js'), readProjectFile('students.js'), readProjectFile('sw.js')
  ]);
  assert.match(schedule, /app-page-title">Ders Programı/);
  assert.match(schedule, /Haftalık Çizelge/);
  assert.doesNotMatch(schedule, /Excel Çizelgesi/);
  assert.match(groups, /app-page-title">Sınıf & Gruplar/);
  assert.match(students, /app-page-title">Ayarlar/);
  assert.match(serviceWorker, /canfenci-cache-v86/);
});

test('exam assignment modal and student cockpit use shared professional surfaces', async () => {
  const [index, exams, students] = await Promise.all([
    readProjectFile('index.html'), readProjectFile('exams.js'), readProjectFile('students.js')
  ]);
  assert.match(index, /\.app-modal-backdrop/);
  assert.match(index, /\.app-segmented/);
  assert.match(exams, /app-modal max-w-2xl/);
  assert.match(exams, /classList\.add\('is-active'\)/);
  assert.match(students, /renderStudentCockpit/);
  assert.match(students, /Kritik içgörüler/);
  assert.match(students, /Son 5 Deneme Eğilimi/);
});

test('topic and general exam result editors use the shared workspace design', async () => {
  const exams = await readProjectFile('exams.js');
  assert.match(exams, /app-page-title">Konu Denemesi Sonucu/);
  assert.match(exams, /app-page-title">Genel Deneme Sonucu/);
  assert.match(exams, /Öğrenci Dosyasına Dön/);
  assert.match(exams, /Sonucu Kaydet/);
  assert.match(exams, /student-form-input genel-dogru/);
  assert.doesNotMatch(exams, /Genel Deneme Düzenle -/);
});

test('student growth center keeps headline metrics visible and details collapsible', async () => {
  const students = await readProjectFile('students.js');
  assert.match(students, /app-page-subtitle">Gelişim özeti, deneme analizi ve rehberlik planı/);
  assert.match(students, /<details class="app-panel app-disclosure">/);
  assert.match(students, /Zaman Çizelgesi/);
  assert.match(students, /Akıllı Deneme Analizi/);
  assert.match(students, /LGS Hedef Uyum Analizi/);
  assert.match(students, /classList\.toggle\('is-active', active\)/);
});

test('student and homework data-entry modals use shared modal actions', async () => {
  const [students, homework] = await Promise.all([
    readProjectFile('students.js'), readProjectFile('homework.js')
  ]);
  assert.match(students, /id="addStudentModal" class="app-modal-backdrop"/);
  assert.match(students, /Öğrenciyi Kaydet/);
  assert.match(students, /editStudentModal/);
  assert.match(homework, /homeworkResultModal/);
  assert.match(homework, /Ödev Sonucu Gir/);
  assert.match(homework, /id="odevAtaModal" class="app-modal-backdrop"/);
  assert.match(homework, /Seçilen Öğrencilere Ata/);
  assert.match(homework, /<option value="Konu Testi">Konu Testi<\/option>/);
  assert.doesNotMatch(homework, /<option value="Yaprak Test">/);
});

test('homework releases bypass stale browser and service-worker caches', async () => {
  const [index, uiHelpers] = await Promise.all([
    readProjectFile('index.html'), readProjectFile('ui-helpers.js')
  ]);
  assert.match(index, /import '\.\/homework\.js'/);
  assert.match(uiHelpers, /updateViaCache: 'none'/);
  assert.match(uiHelpers, /reg\.update\(\)/);
});

test('premium design system uses editorial typography and restrained product surfaces', async () => {
  const index = await readProjectFile('index.html');
  assert.match(index, /family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800/);
  assert.match(index, /--accent: #B58B4A/);
  assert.match(index, /class="app-sidebar/);
  assert.match(index, /class="app-workspace/);
  assert.match(index, /width: 280px !important/);
  assert.match(index, /border-width: 1px !important/);
  assert.match(index, /Premium product skin/);
});

test('students guidance and homework share the unified application surfaces', async () => {
  const [students, guidance, homework, index] = await Promise.all([
    readProjectFile('students.js'), readProjectFile('guidance.js'), readProjectFile('homework.js'), readProjectFile('index.html')
  ]);
  assert.match(students, /app-page-title">Öğrenciler/);
  assert.match(guidance, /app-page-title">Rehberlik/);
  assert.doesNotMatch(guidance, /bg-gradient-to-r from-violet-700/);
  assert.match(homework, /app-page-title">Ödev Takibi/);
  assert.match(homework, /buildHomeworkDashboard/);
  assert.match(homework, /Müdahale gerekiyor/);
  assert.match(homework, /statusStyles/);
  assert.match(index, /\.btn-primary/);
});

test('guidance study plans follow the teacher branches selected in settings', async () => {
  const [students, growth, serviceWorker] = await Promise.all([
    readProjectFile('students.js'),
    readProjectFile('growth.js'),
    readProjectFile('sw.js')
  ]);

  assert.match(students, /store\.teacherBranches/);
  assert.match(growth, /Branş Programı/);
  assert.match(growth, /Genel Çalışma Programı/);
  assert.match(students, /showStudyPlanSetup\('\$\{id\}'\)/);
  assert.match(growth, /Akıllı Çalışma Programı/);
  assert.match(growth, /STUDY_TECHNIQUES/);
  assert.match(growth, /Program süresi/);
  assert.match(growth, /mode\.startsWith\('branch:'\)/);
  assert.match(serviceWorker, /study-plan-engine\.js/);
});

test('printed study plans explain techniques and limit daily subject advice', async () => {
  const growth = await readProjectFile('growth.js');
  assert.match(growth, /ÇALIŞMA TEKNİKLERİ NASIL UYGULANIR/);
  assert.match(growth, /Türkçe · Günlük Paragraf Rutini/);
  assert.match(growth, /Matematik · Yeni Nesil Soru Rutini/);
  assert.match(growth, /40 veya daha fazla/);
  assert.doesNotMatch(growth, /DERS BAZLI GELİŞİM ÖNERİLERİ[\s\S]*İngilizce/);
  assert.doesNotMatch(growth, /DERS BAZLI GELİŞİM ÖNERİLERİ[\s\S]*Din Kültürü/);
});
