# DESIGN.md: Lebur

Arah desain untuk aplikasi cuti internal PT INALUM. Isinya mencatat keputusan yang sudah ada di kode, supaya perubahan berikutnya tidak melenceng. Alasan untuk font, ikon, dan label grup ditulis belakangan (2026-11-07) berdasarkan kode yang ada; koreksi bila alasan aslinya berbeda.

Reading: aplikasi kerja internal (pengajuan dan persetujuan cuti) untuk karyawan dan admin, bahasa visual korporat yang tenang, dial **ENERGY 1 / RHYTHM 1 / MOTION 1**. Dipakai berulang setiap hari, jadi kejelasan lebih penting daripada kesan.

## Warna

- **Inti:** biru INALUM, skala `primary` di `src/main.js` (`500` = `#0077b8`, `900` = `#00283f`). Satu-satunya warna merek.
- **Netral:** slate di mode terang (bawaan Aura), zinc/charcoal di mode gelap lewat alias `--p-surface-*` pada `:root.app-dark` di `src/assets/styles.scss`; preset di `src/main.js` tidak diubah. Alasan (koreksi dark mode 2026-11-07, [laporan](laporan/01-audit-dark-mode.md)): bidang netral membuat biru INALUM tetap terbaca sebagai aksen, bukan mewarnai setiap panel. Latar konten `surface-100` / gelap `surface-950`; kartu dan topbar `--p-content-background` (putih / `surface-900`).
- **Status:** warna status selalu disertai teks atau ikon, tidak boleh warna saja. Satu palet untuk semua tampilan status: token Tag PrimeVue (`--p-tag-success|danger|warn|primary|secondary-*`), termasuk timeline approval, sehingga hijau "Disetujui" di Tag dan di timeline sama. Tahap approval yang **aktif** sengaja biru merek (token Tag primary) karena menandai "giliran siapa sekarang", sedangkan status pengajuan "Diajukan" tetap oranye dari `getStatusSeverity` (`src/utils`, tidak diubah). Keputusan pengguna 2026-11-07, audit-008 #4.
- **Sidebar dan drawer navigasi:** navy `primary-900` di mode terang, charcoal `surface-900` dengan garis tepi `surface-800` di mode gelap. Alasan: di mode terang navy memisahkan navigasi dari konten dan membawa warna merek; di mode gelap sidebar ikut bidang netral, dan menu aktif ditandai tint biru 15% plus garis kiri `primary-400`. Warna isinya memakai variant `navy:`.

## Tipografi

- **Plus Jakarta Sans** (Google Fonts, `index.html`). Alasan: sans humanis yang tetap terbaca di ukuran kecil tabel dan form, sedikit lebih hangat daripada font sistem.
- Label grup menu memakai `uppercase tracking-wider` 11px. Alasan: pemisah antar kelompok menu, bukan judul; huruf kapital kecil membedakannya dari item menu tanpa menambah ukuran. Kontras di navy 4.79:1.

## Ikon

- **Phosphor** (`@phosphor-icons/vue`), menggantikan Lucide atas keputusan pengguna 2026-11-08 ([audit-026](anti-slop/audit-026-2026-11-08.md), opsi B). Alasan: Phosphor punya bobot (regular, bold, light, fill), jadi menu aktif bisa ditandai ikon berisi, bukan hanya warna latar; set Lucide tampil seperti bawaan banyak aplikasi lain dan garisnya pudar di ukuran kecil.
- **Empat ukuran, bobot mengikuti ukuran** supaya garis tampil ±1,3–1,9px dan setara batang huruf: `14` bold (di dalam teks kecil, badge), `16` bold (tombol, aksi baris, field), `22` regular (menu, topbar, judul halaman), `40` light (empty state). Menu aktif: `fill`. Tidak ada ukuran lain.
- **Satu arti = satu ikon.** Ikon menu dan ikon judul halaman sama persis (kamus di `src/layout/composables/sidebarMenu.js`). Contoh tetap: ubah `PhPencilSimple`, segarkan `PhArrowsClockwise`, riwayat `PhClockCounterClockwise`, persetujuan/validasi `PhSealCheck`, hak akses `PhShieldCheck`, ekspor Excel `PhFileXls`, dikembalikan `PhArrowUUpLeft`.
- Setiap ikon diberi `aria-hidden="true"` (Phosphor tidak menambahkannya sendiri); nama kontrol ada di teks atau `aria-label` tombolnya.

## Bentuk dan ruang

- Radius: kartu, field, dan tombol PrimeVue memakai token konten (`--p-content-border-radius`, 6px); overlay/dialog dan item menu sidebar 12px. Badge saja yang berbentuk pil. Elemen di dalam kartu tidak boleh punya radius lebih besar dari kartunya.
- Kartu (`.card`, `styles.scss`): datar, tanpa border dan shadow, dipisahkan dari latar oleh beda surface. Padding 1rem di mobile, 2rem mulai 576px; jarak antarkartu 2rem. Border tetap dipakai untuk fungsi: field, pemisah tabel, fokus, status ([laporan 02](laporan/02-token-card-global.md)).
- Aturan: shadow dipakai untuk lapisan yang melayang (popup, dialog), bukan sebagai bawaan setiap kartu.
- Membaca vs memutuskan: detail pengajuan cuti tampil sebagai panel kanan (Drawer modal, 34rem; layar penuh di mobile) agar daftar tetap terlihat dan timeline punya tinggi layar penuh. Keputusan (proses persetujuan, form) tetap dialog di tengah. Panel ditutup sebelum dialog proses dibuka, tidak bertumpuk.
- Dialog dan panel: satu bingkai saja (dialog/panel itu sendiri). Isi dikelompokkan dengan judul, jarak, dan pemisah `border-b`; kutipan seperti alasan cuti memakai tint `surface-100` tanpa garis. Tint warna status hanya untuk tahap yang perlu perhatian (dikembalikan, ditolak); tahap normal tetap netral dengan titik dan label status ([laporan 03](laporan/03-komponen-bersama.md)).
- Elemen yang tidak bisa diklik tidak diberi efek hover (naik, shadow, membesar).
- Status harus jujur: tahap approval sesudah penolakan ditulis "Tidak dilanjutkan", bukan "Menunggu"; data yang gagal dimuat diberi tahu di layar, bukan hanya di console.
- Panel detail: satu gaya judul bagian (h3 14px/600) dan satu gaya label field (14px/400 abu, kolom 9rem; di mobile label di atas nilai). Catatan approver selalu satu bentuk (latar `surface-100`, tanpa garis kiri); hanya judul catatannya yang berwarna status.
- Panel detail: hierarki dibangun dengan ukuran dan ketebalan huruf, bukan kotak. Angka utama (hari kerja) besar dan `tabular-nums`; rincian berupa daftar label/nilai; skala huruf 12/14/20/30px, tidak ada teks di bawah 12px.

- Warna status di luar komponen Tag (kalender, legenda, titik) memakai alias `--status-{success,warn,danger}-{bg,fg}` di `styles.scss`, bernilai sama dengan token Tag Aura. Alias dipakai karena token `--p-tag-*` baru dimuat PrimeVue setelah ada Tag yang dirender ([audit-010](anti-slop/audit-010-2026-11-07.md)).

- Tombol success (Ekspor Excel, Setujui) di mode terang memakai `green-700`, override token di `styles.scss`, karena `green-500` dengan teks putih hanya 2.28:1.
- Warna hanya untuk status. Kategori seperti kode divisi ditulis sebagai teks biasa, bukan badge berwarna.
- Tabel dan kalender membedakan tiga keadaan kosong: gagal dimuat (pesan dan Coba lagi), tidak cocok dengan filter, dan memang belum ada data ([audit-011](anti-slop/audit-011-2026-11-07.md)).

- Form: setiap field punya `label for` dan `id`. Kesalahan validasi ditulis di bawah field (`text-(--status-danger-fg)`, `aria-invalid`, `aria-describedby`), lalu fokus pindah ke field salah yang pertama. Toast tidak dipakai untuk kesalahan validasi.
- Tombol ikon di baris tabel minimal 36px, dengan `aria-label` yang menyebut nama barisnya (misalnya "Ubah Cuti Haid") ([audit-012](anti-slop/audit-012-2026-11-07.md)).

- Urutan yang bisa diseret selalu punya alternatif tombol naik/turun (WCAG 2.5.7). Aksi yang melepas data (keluarkan, hapus) selalu dikonfirmasi.
- Select PrimeVue diberi nama lewat `ariaLabelledby` ke id label, karena `label for` tidak menamai combobox berupa `span` ([audit-015](anti-slop/audit-015-2026-11-07.md)).

- Setelah aksi yang mengubah daftar (pindah, keluarkan, hapus), fokus keyboard dikembalikan ke kontrol yang masuk akal. Tombol pemicu tidak di-`disabled` selama menyimpan, karena fokus akan hilang dan diambil toast.
- Konfirmasi destruktif memakai `defaultFocus: 'reject'` sehingga fokus awal ada di Batal ([audit-016](anti-slop/audit-016-2026-11-07.md)).
- Editor dengan perubahan belum tersimpan menahan pindah halaman (`onBeforeRouteLeave` + `beforeunload`) dan menampilkan bilah simpan lengket; aksi yang tidak tersedia ditulis alasannya, bukan ditolak lewat toast setelah diklik ([audit-025](anti-slop/audit-025-2026-11-08.md)).

- Select PrimeVue dengan opsi `{label, value}` selalu memakai `optionLabel` dan `optionValue`. Tanpa itu nilai yang tersimpan adalah objek opsi, lalu terkirim sebagai `[object Object]` ([audit-021](anti-slop/audit-021-2026-11-08.md) #1).
- Tabel angka (saldo): angka netral `tabular-nums` dengan satuan di header; satu angka per baris yang menjadi fokus (sisa) dicetak tebal; warna hanya bila butuh perhatian (Tag "Habis").
- Ekspor CSV yang dibuat di browser menetralkan sel berawalan `= + - @` (formula injection) dan menulis batas datanya bila tidak memuat semua baris ([audit-023](anti-slop/audit-023-2026-11-08.md)).
- Tab memakai `Tabs` PrimeVue (tablist/tabpanel, panah/Home/End bawaan), bukan tombol buatan sendiri. Ekspor hanya membawa filter yang terlihat di tab aktif, dan ditolak bila data tab gagal dimuat atau kosong ([audit-022](anti-slop/audit-022-2026-11-08.md)).

## Aksesibilitas (wajib)

- Kontras teks minimal 4.5:1 dan elemen non-teks 3:1, dicek dengan skrip, bukan perkiraan.
- Target sentuh minimal 44px untuk kontrol navigasi.
- Outline fokus 2px yang terlihat di setiap kontrol (`outline-primary`, putih di atas navy). Untuk komponen PrimeVue lewat `--p-focus-ring-width: 2px` di `styles.scss`.
- Animasi berhenti di bawah `prefers-reduced-motion` (termasuk animasi Drawer dan Toast PrimeVue, lewat `styles.scss`).
- Setiap halaman punya satu `h1` terlihat dengan subjudul `text-xs text-muted-color`, termasuk ketiga varian Dashboard.
- Tidak ada layar tunggu buatan: sapaan setelah login berupa Toast yang tidak mengunci layar, tanpa langkah atau progres yang tidak benar-benar terjadi ([audit-009](anti-slop/audit-009-2026-11-07.md)).
- Tidak ada em dash di teks UI.

## Mode gelap

Toggle terang/gelap wajib berfungsi di kedua mode. Komponen memakai varian `dark:` dan token surface yang sama; sidebar memakai `surface-900` dengan garis tepi `surface-800` di mode gelap.
