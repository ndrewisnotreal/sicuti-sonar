export const TOUR_STEPS = {
    'super.pengenalan': [
        {
            title: 'Selamat datang di Lebur',
            text: 'Sebagai Super Admin, Anda mengelola seluruh aplikasi untuk semua divisi: master data, akun pengguna, hak akses, laporan, dan audit trail.'
        },
        {
            element: 'menu:/calendar',
            title: 'Kalender Cuti',
            text: 'Jadwal cuti seluruh karyawan dan hari libur dalam satu tampilan bulanan.'
        },
        {
            element: 'menu-group:Master Data',
            title: 'Master Data, Transaksi & Laporan',
            text: 'Sama seperti Admin Seksi, tetapi untuk seluruh divisi: karyawan, jenis cuti, kebijakan, hari libur, alur approval, pengajuan, saldo, laporan, dan audit trail.'
        },
        {
            element: 'menu-group:Keamanan',
            title: 'Keamanan',
            text: 'Kelola akun pengguna dan hak akses setiap peran. Perubahan di sini menentukan menu dan izin yang dimiliki pengguna.'
        },
        {
            element: 'menu-mobile',
            title: 'Menu navigasi',
            text: 'Semua menu, termasuk Keamanan, ada di sini.'
        },
        {
            element: 'admin-stats',
            title: 'Ringkasan organisasi',
            text: 'Angka utama cuti seluruh divisi: karyawan aktif, pengajuan, dan hari libur tahun ini.'
        },
        {
            element: 'notifications',
            title: 'Notifikasi',
            text: 'Kabar saat ada pengajuan baru. Klik notifikasinya untuk membuka Pemantauan.'
        },
        {
            element: 'profile',
            title: 'Profil & akun',
            text: 'Ganti foto, kontak notifikasi, dan password di sini.'
        },
        {
            element: 'tour-button',
            title: 'Butuh panduan lagi?',
            text: 'Setiap halaman punya tur sendiri. Buka lewat tombol ini saat berada di halaman tersebut.'
        },
        {
            element: 'profile',
            ifHidden: 'tour-button',
            title: 'Butuh panduan lagi?',
            text: 'Buka menu profil, lalu pilih <b>Tur halaman ini</b> atau <b>Tur pengenalan</b>.'
        }
    ],
    'super.akun': [
        {
            element: 'acc-add',
            title: 'Tambah akun',
            text: 'Buat akun pengguna baru beserta peran dan data kepegawaiannya.'
        },
        {
            element: 'acc-filters',
            title: 'Cari & saring',
            text: 'Cari nama, username, atau NIK, lalu saring per divisi.'
        },
        {
            element: 'acc-col-role',
            title: 'Peran akses',
            text: 'Menentukan menu dan izin yang dimiliki pengguna. Isi izin setiap peran diatur di <b>Manajemen Hak Akses</b>.'
        },
        {
            element: 'acc-col-aksi',
            title: 'Aksi akun',
            text: 'Ubah akun & peran, atur ulang kata sandi, lihat riwayat status, buka kunci akun yang terkunci karena salah password, dan nonaktifkan atau aktifkan kembali. Menonaktifkan <b>wajib disertai alasan</b>.'
        }
    ],
    'super.hak-akses': [
        {
            element: 'perm-roles',
            title: 'Pilih peran',
            text: 'Peran dikelompokkan per level: Super admin, Admin, Kepala/atasan, Approval, dan Karyawan. Pilih satu untuk melihat izinnya.'
        },
        {
            element: 'perm-role-header',
            title: 'Ringkasan peran',
            text: 'Jumlah pengguna yang memakai peran ini dan berapa izin yang aktif. Admin Super App selalu punya semua akses dan tidak bisa diubah.'
        },
        {
            element: 'perm-group',
            title: 'Kelompok peran',
            text: 'Level peran: Admin, Kepala/atasan, Approval, atau Karyawan.'
        },
        {
            element: 'perm-matrix',
            title: 'Izin per modul',
            text: 'Centang aksi yang boleh dilakukan peran ini. <b>Pilih semua</b> dan <b>Kosongkan modul</b> mengubah satu modul sekaligus.'
        },
        {
            element: 'perm-save',
            title: 'Simpan perubahan',
            text: 'Perubahan izin baru berlaku setelah disimpan. Tombol aktif bila ada perubahan.'
        },
        {
            element: 'perm-add-role',
            title: 'Tambah peran',
            text: 'Buat peran baru, lalu atur kelompok dan izinnya.'
        }
    ],
    kalender: [
        {
            element: 'cal-filters',
            title: 'Saring kalender',
            text: 'Pilih divisi, dan centang untuk ikut menampilkan cuti yang masih diproses.'
        },
        {
            element: 'cal-grid',
            title: 'Kalender bulanan',
            text: 'Hijau: cuti disetujui, kuning: masih diproses, merah: hari libur. Pindah bulan dengan tombol panah, lalu klik tanggal untuk melihat detailnya.'
        },
        {
            element: 'cal-day-detail',
            title: 'Detail tanggal',
            text: 'Siapa saja yang cuti dan hari libur pada tanggal yang dipilih.'
        },
        {
            element: 'cal-summary',
            title: 'Ringkasan bulan',
            text: 'Jumlah karyawan yang cuti, jumlah pengajuan, dan hari libur di bulan yang ditampilkan.'
        }
    ]
};
