# Uji browser sicuti-sonar (Chrome DevTools)

Tanggal: 2026-11-11
Dasar: `anti-slop/audit-001-2026-11-11.md` (temuan #1 dan #2) dan `docs/js-analysis.md` (poin 1 sampai 8 dan tabel Kecil).
Lingkungan: Vite dev `http://localhost:5176` (server baru dengan `--force`; server lama di 5175 terus membalas 504 "Outdated Optimize Dep"), backend lokal `:3001`, Chrome dengan konteks terisolasi.
Akun: Karyawan OS24980032, PIC Approver 24011018, Approver 24010002, Kepala Seksi 24010007, Admin Super 24000000.
Metode: klik di UI, cek request di tab Network, dan baca `sicutiState` dengan `import('/src/service/sicutiService.js')` di halaman. Tidak ada kode aplikasi yang diubah.

Status setiap temuan di bawah: **perlu divalidasi ulang** sebelum diperbaiki.

## Temuan

### Q1. Poin 1 belum benar-benar tertutup: state global usang setelah submit dan batal cuti (MEDIUM)

- Bukti di browser (Karyawan):
  1. Kirim pengajuan REQ-SIT-0003/2026 dari `/leave/history`. Tabel langsung ter-update, tapi badge sidebar "Pengajuan Cuti" tetap kosong dan `sicutiState.leaveRequests.length` tetap `0`. Setelah POST tidak ada GET `/sicuti/leave-request?limit=1000`.
  2. Reload halaman, lalu badge baru muncul: "Pengajuan Cuti 1".
  3. Batalkan REQ-SIT-0003. Baris tabel berubah menjadi "Dibatalkan", tapi badge tetap "1" dan status di state tetap `submitted`.
- Penyebab (dari kode): perbaikan poin 1 dipasang di `createLeaveRequest`, `deleteLeaveRequest`, `approveLeaveRequest`, `rejectLeaveRequest` dan `returnLeaveRequest` (`src/service/sicutiService.js:490-550`). Kelima fungsi itu tidak dipanggil di `src/` maupun `test/`. UI yang sebenarnya memanggil service langsung:
  - `src/components/leave/LeaveFormDialog.vue:369`, `415` lewat `leaveService.createLeave` / `resubmitLeave`
  - `src/views/leave/LeaveHistory.vue:214` lewat `leaveService.cancelLeave`
  - `src/components/approval/ApprovalActionDialog.vue:76` lewat `approvalService.processApproval`
- Dampak: badge "Pengajuan Cuti" (`src/layout/composables/sidebarMenu.js:32`) dan pencarian detail notifikasi (`AppNotificationMenu.vue:138`) memakai data lama sampai halaman di-reload.
- Catatan: badge approver "Validasi Pengajuan" ter-update dengan benar setelah approve atau tolak (3 jadi 2, 1 jadi kosong) karena memakai `pendingApprovalCount` yang terpisah.
- Saran: panggil `syncFromBackend({ fresh: true })` di tiga jalur UI itu, atau arahkan UI ke fungsi pembungkus. Fungsi yang tetap tidak terpakai sebaiknya dihapus. Status "Diperbaiki" untuk poin 1 di `js-analysis.md` perlu dikoreksi.

### Q2. Notifikasi "Buka detail" untuk approver mendarat di Dashboard tanpa detail (MEDIUM)

- Bukti: login sebagai PIC Approver, buka notifikasi, lalu klik "Pengajuan dibatalkan ... REQ-SIT-0003/2026 Buka detail". Hasilnya halaman berpindah ke `/` (Dashboard Approval). Tidak ada dialog detail dan tidak ada pesan.
- Penyebab: `handleNotifClick` (`src/layout/AppNotificationMenu.vue:138-143`) mencari pengajuan di `sicutiState.leaveRequests`. Untuk approver, isinya hanya pengajuan miliknya sendiri (respons `/sicuti/leave-request` = 0 data), jadi kode jatuh ke `router.push('/leave/history')`. Rute itu butuh `requiresApplicant`, sehingga guard (`src/router/index.js`) diam-diam mengarahkan ke dashboard.
- Saran: untuk pengguna yang bukan pemohon, ambil detail berdasarkan `requestId` dari API, atau arahkan ke `/approval/history`.

### Q3. Tombol "Ekspor CSV" mengunduh file .xlsx (LOW)

- Bukti: Admin Super, `/admin/reports`, klik "Ekspor CSV". File yang diunduh `Laporan_Riwayat_Cuti_Semua_2026.xlsx` dengan tipe `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, tapi toast berbunyi "Berkas CSV diunduh (bisa dibuka di Excel)."
- Penyebab: `downloadExcel` (`src/utils/reportExport.js:4`) mengirim `format: 'xlsx'`. Sementara label tombol (`AdminReports.vue:331`), toast dan komentar (`:238-239`), serta nama file cadangan `.csv` (`:229-233`) masih menyebut CSV.
- Saran: samakan label, toast dan nama file cadangan menjadi Excel/.xlsx. Komentar "Backend mengirim text/csv" sudah tidak benar.

### Q4. Logout tidak mengosongkan `sicutiState` (LOW)

- Bukti: setelah Karyawan logout, `sicutiState.leaveRequests` masih berisi 1 pengajuan milik USR101 dan `holidays` masih 15. Saat PIC Approver (USR001) login, data USR101 masih ada di state selama sekitar 370 ms, termasuk sekitar 110 ms setelah halaman `/` tampil. Setelah itu sinkron selesai dan state diganti.
- Dampak: celahnya sempit. Yang paling berisiko adalah tampilan yang membaca state langsung, misalnya Dashboard Admin lewat `getDivisionRequests`.
- Temuan terkait dari membaca kode (belum direproduksi): `logout()` (`sicutiService.js:429`) mengosongkan `syncPromise` tapi tidak `rerunPromise`. Panggilan `fresh` milik sesi baru bisa ikut menunggu rantai sinkron dari sesi lama.
- Saran: di `logout()`, kosongkan `leaveRequests`, `users`, `balances` dan `approvalFlows`, lalu set `rerunPromise = null`.

### Q5. Teks aksesibilitas PrimeVue masih berbahasa Inggris (LOW, a11y)

- Bukti dari pohon aksesibilitas: "Enter a password" (live region di kolom kata sandi login), "Choose Date", "Previous Month", "Next Month", "First Page", "Rows per page", "Close", "24 results are available", "No selected item".
- Penyebab: `locale` di `src/main.js:78-87` hanya mengisi nama hari dan bulan. Objek `aria`, `passwordPrompt` dan `emptySearchMessage` belum diisi.
- Saran: lengkapi `locale.aria` dan `passwordPrompt` dalam bahasa Indonesia.

## Sudah dicek dan sesuai

| Rujukan | Hasil |
|---|---|
| js-analysis poin 4, audit #1 | Password `"password123 "` dikirim utuh (dicek di body request) dan ditolak backend. Username `"  OS24980032  "` di-trim lalu login berhasil. |
| audit #2 | Password yang hanya berisi spasi ditolak di client ("Isi kata sandi Anda."). Tidak ada request yang terkirim, jadi jatah percobaan tidak berkurang. |
| audit #1 (notifikasi pending) | Klik notifikasi "Pengajuan menunggu persetujuan Anda" membuka `/approval/pending`. |
| audit #1 (hari libur) | Tambah "QA Uji Libur" langsung menaikkan jumlah Libur Nasional dari 13 ke 14 dan masuk ke state. Setelah dihapus, kembali ke 13. |
| poin 2 | Hasil sinkron sesi lama tidak menimpa sesi baru: `currentUser` dan data akhir milik pengguna baru. Lihat Q4 untuk data sisa sebelum sinkron selesai. |
| poin 3 | Dengan sesi Approver, `/master/user` dan `/sicuti/leave-balance` mengembalikan 403. Mengubah `isSuper` di localStorage membuka tampilan `/admin/accounts`, tapi data tetap ditolak backend dan UI menampilkan pesan gagal. Hak akses dijaga backend. |
| poin 6 | Klik notifikasi tetap berfungsi setelah setter `appMode` dihapus. |
| poin 8 | `/validasi/abc/def%2Fxyz` tetap bisa dibuka tanpa login dan menampilkan "Format token validasi tidak valid". |
| Kecil: `approvalSearch` | Pencarian "0004" dan "zzz" di `/approval/pending` berjalan tanpa error di konsol. |
| Kecil: `annual_quota` / kuota | Halaman Kebijakan menampilkan 12/4/6 tanpa NaN atau "undefined". `getUserBalance` mengembalikan kuota 12. |
| Kecil: `requestBlob` / object URL | Unduhan laporan berhasil dan object URL dilepas (`revokeObjectURL` terpanggil). |
| Alur approval | PIC Approver menyetujui, lalu Approver menolak. Catatan wajib saat menolak divalidasi dan ditandai `aria-invalid`. Dialog konfirmasi muncul sebelum aksi dijalankan. |
| Kepala Seksi | Dashboard Approval tampil, antrean kosong, tanpa error. |

## Bukan bug (artefak pengujian)

- Ada dua request login ekstra berisi password lama (reqid 306 dan 307). Setelah dipasang logger `fetch`, satu klik hanya menghasilkan satu request. Penyebabnya kemungkinan alat `fill_form` (alat itu juga menambahkan teks ke kolom Password, bukan mengganti isinya). Tidak bisa direproduksi.
- Satu klik "Ajukan Cuti" tidak berpindah halaman. Log Vite menunjukkan "optimized dependencies changed. reloading" pada saat yang sama, jadi ini reload khusus mode dev.

## Yang tidak dicek

- Membuat pengajuan atas nama karyawan (`/admin/create-leave`): hanya tampilan saldo yang dicek, tidak di-submit.
- Impor CSV hari libur, simpan Kebijakan, unduh lampiran, sesi habis saat mengunduh (401 di `requestBlob`), dan data lebih dari 1000 baris.
- Pengujian hanya di mode dev, bukan pada hasil `vite build`.

## Jejak data uji di backend lokal

- REQ-SIT-0003/2026 (Karyawan, sudah dibatalkan) dan REQ-SIT-0004/2026 (disetujui PIC Approver, lalu ditolak Approver).
- Hari libur "QA Uji Libur" 30 Des 2026 sudah ditambah lalu dihapus.
- Percobaan login gagal: OS24980032 empat kali (request 304 sampai 307, sebelum login berhasil; perlu dicek apakah penghitungnya sudah direset) dan 24011018 satu kali.

## Status perbaikan (2026-11-11)

| Temuan | Status |
|---|---|
| Q1 | Diperbaiki. `LeaveFormDialog` (kirim, simpan draf, ajukan ulang), batal di `LeaveHistory`, `LeaveCompleteDocumentDialog` dan `ApprovalActionDialog` kini memanggil `syncFromBackend({ fresh: true })` setelah berhasil menulis. Lima fungsi pembungkus yang tidak terpakai dihapus dari `sicutiService.js`. Tes: `approvalActionDialog.test.js`. Dicek di browser: badge "Pengajuan Cuti" muncul tanpa reload setelah REQ-SIT-0005 dikirim, lalu hilang setelah dibatalkan. |
| Q2 | Diperbaiki. Notifikasi yang punya `requestId` selalu membuka `LeaveDetailDialog`. Kalau pengajuannya tidak ada di state, dialog mengambil detail lewat API. Dicek di browser sebagai PIC Approver: detail REQ-SIT-0005 terbuka. |
| Q3 | Diperbaiki. Tombol, toast, langkah tur dan nama file cadangan kini menyebut Excel (.xlsx). Ekspor Audit Trail tetap CSV karena memang membuat CSV di client. |
| Q4 | Diperbaiki. `logout()` mengosongkan `leaveRequests`, `users`, `leaveBalances`, `approvalFlows` dan `pendingApprovalCount`, mereset `pendingCountAt`, dan menyetel `rerunPromise = null`. Data global (hari libur, jenis cuti, kebijakan) tetap disimpan. Tes: `sicutiSync.test.js`. Dicek di browser lewat tombol Keluar: jumlah pengajuan di state turun dari 3 ke 0. |
| Q5 | Diperbaiki. `locale` di `main.js` dilengkapi teks bahasa Indonesia untuk kata sandi, pencarian dan `aria` (tutup, paginator, navigasi tanggal). Dicek di browser: "Masukkan kata sandi", "Tutup", "Pilih tanggal". |

Bukti: `vitest run` 304 tes lolos dan `vite build` berhasil.
Data uji tambahan: REQ-SIT-0005/2026 (Karyawan, sudah dibatalkan).
Di luar cakupan perbaikan ini: detail pengajuan yang dibatalkan masih menampilkan "Tingkat 1 Sedang Ditinjau" di alur persetujuan. Ini perlu dicek terpisah di data `steps` dari backend.
