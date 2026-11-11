# Analisa JavaScript sicuti-sonar

Tanggal: 2026-11-11
Cakupan: 39 file JS (sekitar 4.200 baris) di `src/`, `scripts/` dan `vite.config.mjs`. Folder `test/` tidak termasuk.
Metode: membaca kode. Tes dan lint tidak dijalankan (ESLint tidak ada di devDependencies). Tidak ada kode yang diubah.

Yang sudah baik: ESM dipakai konsisten, GET yang sama digabung dan hasilnya disalin dengan `structuredClone`, dan HTML untuk cetak (`leaveFormPrint.js`, `reportExport.js`) sudah di-escape.

## Perlu diperbaiki

### 1. Data bisa usang setelah submit, approve atau batal cuti

- Lokasi: `src/service/sicutiService.js:218-226`, `507-577`
- Masalah: setelah menulis data, kode menunggu `syncFromBackend()`. Kalau sinkronisasi lain sedang berjalan, fungsi ini mengembalikan proses lama yang GET-nya dikirim sebelum POST.
- Contoh: pengguna membuka halaman (enam view memanggil `syncFromBackend()` saat dibuka) lalu langsung mengajukan cuti. Pengajuannya belum muncul di daftar sampai sinkronisasi berikutnya.
- Saran: kalau ada penulisan saat sinkronisasi masih berjalan, jalankan sinkronisasi sekali lagi setelah yang lama selesai.

### 2. Logout tidak menghentikan sinkronisasi yang sedang berjalan

- Lokasi: `src/service/sicutiService.js:438-444`
- Masalah: `runSync` yang belum selesai tetap mengisi `sicutiState` dengan data pengguna lama dan mengubah `syncStatus` menjadi `'ready'`.
- Contoh: pengguna A logout saat sinkronisasi masih jalan, lalu pengguna B login di tab yang sama. Data A masih terlihat sebentar, dan `syncFromBackend()` bisa mengembalikan proses milik A.
- Saran: catat nomor generasi sesi dan abaikan hasil `runSync` dari generasi lama. `syncPromise` juga perlu dikosongkan saat logout.

### 3. "Enkripsi" localStorage sebenarnya hanya XOR + base64

- Lokasi: `src/utils/encryption.js:1`
- Masalah: kuncinya diambil dari `VITE_*`, jadi ikut terbawa ke bundle, dan ada kunci cadangan yang tertulis di kode. Siapa pun bisa membalik isinya, termasuk mengubah `abilities` atau `isSuper`.
- Dampak: tidak masalah selama hak akses di frontend (`can()`, router guard) hanya untuk tampilan. Backend tetap harus memeriksa setiap endpoint, dan itu perlu dipastikan di backend.
- Saran: ganti nama modul menjadi obfuscation agar tidak menyesatkan, atau hapus lapisan ini.

### 4. Password di-`trim()` saat login

- Lokasi: `src/service/authService.js:43`
- Masalah: password yang diawali atau diakhiri spasi diubah sebelum dikirim. Kalau halaman ganti password tidak melakukan trim yang sama, pengguna seperti itu tidak bisa login.
- Saran: jangan trim password. Trim username saja.

### 5. Tanggal ISO dipotong dengan `split('T')[0]`

- Lokasi: 14 tempat, misalnya `src/service/sicutiService.js:266`, `src/utils/leaveFormValidation.js:4`
- Masalah: kalau backend mengirim `DATE` sebagai `2026-11-10T17:00:00.000Z` (tengah malam WIB), hasilnya mundur satu hari. Padahal `formatDate` mengonversinya ke waktu lokal, jadi tampilan dan perhitungan hari kerja bisa beda satu hari.
- Status: belum dicek. Bergantung pada format tanggal dari backend.
- Saran: buat satu helper tanggal yang dipakai di semua tempat.

## Kode mati atau menyesatkan

### 6. `appMode` tidak pernah memakai pilihan pengguna

- Lokasi: `src/service/sicutiService.js:178-191`, `src/utils/roleUtils.js:54`
- Masalah: `isApprovalOnly` sama persis dengan `isApprover`, jadi getter selalu mengembalikan `'approval'` atau `'user'` berdasarkan peran, dan `storedMode` tidak pernah dibaca. Akibatnya `appMode.value = 'approval'` di `src/layout/AppNotificationMenu.vue:131` tidak berpengaruh apa-apa.

### 7. Fungsi yang diekspor tapi tidak dipanggil

Tidak dipanggil di `src/` maupun `test/`:

- `saveToLocalStorage` (badannya kosong)
- `updateLeaveRequest` (sekaligus salah: parameter `id` diabaikan dan fungsi ini malah membuat pengajuan baru lewat `createLeave`)
- `switchRole`
- `getDivisionBalances`
- `updateUserAccount`
- `toggleUserStatus`

Semuanya ada di `src/service/sicutiService.js` dan aman dihapus.

### 8. Rute validasi dengan alias yang redundan

- Lokasi: `src/router/index.js:144-145`, `170`
- Masalah: rute `/validasi/:secret(.*)` sudah mencakup alias `/validasi/:secret`, dan pengecekan `to.name === 'document-validation'` sudah tercakup oleh `meta.public`.

## Kecil

| Lokasi | Temuan |
|---|---|
| `sicutiService.js:234`, `adminService.js:45` | `limit: 1000`: kalau datanya lebih dari 1000, sisanya terpotong tanpa peringatan dan angka dashboard jadi salah. |
| `sicutiService.js:481` | `getUserBalance` memakai angka 12 tertulis langsung, padahal sudah ada `defaultAnnualQuota()`. |
| `sicutiService.js:334` | Kalau `annual_quota` tidak ada di respons policy, `annualQuota` jadi `NaN` dan deskripsinya berisi "undefined". |
| `api.js:92-103` | `requestBlob` tidak menangani 401 seperti `request`, jadi sesi habis saat unduh tidak mengarahkan ke login. `decodeURIComponent` juga bisa melempar error kalau nama file tidak valid. |
| `attachmentUtils.js:17` | `openAttachment` tidak pernah melepas object URL-nya. `LeaveAttachment.vue` sudah melakukannya dengan benar. |
| `approvalSearch.js:5` | Akan error kalau `id` berupa angka, karena `.toLowerCase()` dipanggil pada number. |
| `dateUtils.js:1-3` | `CURRENT_YEAR` dan `YEAR_OPTIONS` dihitung sekali saat modul dimuat, jadi tab yang terbuka saat pergantian tahun memakai tahun lama. |
| `router/index.js:169` | Router guard masih memakai callback `next()`, yang sudah usang di vue-router 4. Sebaiknya diganti `return`. |

## Yang tidak dicek

- File data tour (`src/tour/tours/*.js`) dan `scripts/test-rbac-menu.js` hanya dibaca sekilas.
- Poin 1, 2 dan 5 disimpulkan dari membaca kode, belum dicoba langsung di aplikasi.

## Status perbaikan (2026-11-11)

| Poin | Status |
|---|---|
| 1 | Diperbaiki: `syncFromBackend({ fresh: true })` dipanggil setelah menulis. Perbaikan pertama hanya dipasang di fungsi pembungkus yang tidak dipakai UI; jalur UI yang sebenarnya baru dibenahi lewat `docs/qa-browser-2026-11-11.md` Q1. Tes di `test/service/sicutiSync.test.js` dan `test/components/approvalActionDialog.test.js`. |
| 2 | Diperbaiki: logout menaikkan nomor sesi dan hasil sinkron lama dibuang; tes baru. |
| 3 | Dilewati atas permintaan pengguna. |
| 4 | Diperbaiki setelah cek backend (`cuti-backend` meng-hash password apa adanya): `authService.js` dan `Login.vue` tidak lagi trim password; tes baru. |
| 5 | Ditutup tanpa perubahan: backend mengirim DATE sebagai teks `YYYY-MM-DD` (`setTypeParser(1082)` dan `::text`). |
| 6 | Diperbaiki: `appMode` jadi computed baca-saja; setter di `AppNotificationMenu.vue` dihapus. |
| 7 | Diperbaiki: enam fungsi mati dihapus. |
| 8 | Diperbaiki: alias rute dihapus, guard memakai `return`. |
| Kecil | `limit: 1000` kini mengambil semua halaman sampai `total`; kuota cadangan memakai `defaultAnnualQuota()`; `annual_quota` kosong tidak lagi jadi `NaN`; `requestBlob` menangani 401 dan nama file rusak; object URL lampiran dilepas; pencarian aman untuk id angka. `CURRENT_YEAR` hanya diberi komentar `shortcut:` (31 pemakai). |

## Urutan perbaikan yang disarankan

1. Poin 7: hapus kode mati. Paling murah dan tanpa risiko.
2. Poin 1 dan 2: sinkronisasi data setelah tulis dan setelah logout.
3. Poin 4 dan 5: setelah format password dan tanggal dicek dengan backend.
4. Poin 3: pastikan backend memeriksa hak akses di setiap endpoint.
