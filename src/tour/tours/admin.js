const READONLY = {
    element: 'readonly-notice',
    title: 'Mode lihat saja',
    text: 'Izin mengubah data di halaman ini belum diberikan untuk peran Anda. Hubungi Super Admin bila perlu akses ubah.'
};

export const TOUR_STEPS = {
    'admin.pengenalan': [
        {
            title: 'Selamat datang di Lebur',
            text: 'Sebagai Admin Seksi, Anda mengelola data cuti divisi Anda: master data, pengajuan atas nama karyawan, saldo, laporan, dan audit trail. Semua data otomatis dibatasi ke divisi Anda.'
        },
        {
            element: 'menu-group:Master Data',
            title: 'Master Data',
            text: 'Karyawan, jenis cuti, kebijakan, hari libur, dan alur approval. Menu bergembok berarti izinnya belum diberikan; hubungi Super Admin.'
        },
        {
            element: 'menu-group:Transaksi',
            title: 'Transaksi',
            text: 'Buat pengajuan atas nama karyawan, pantau semua pengajuan divisi, dan sesuaikan saldo cuti.'
        },
        {
            element: 'menu-group:Laporan',
            title: 'Laporan',
            text: 'Rekap cuti dan saldo, serta jejak aktivitas di Audit Trail. Semuanya bisa diekspor ke Excel.'
        },
        {
            element: 'menu-mobile',
            title: 'Menu navigasi',
            text: 'Semua menu Master Data, Transaksi, dan Laporan ada di sini.'
        },
        {
            element: 'admin-stats',
            title: 'Ringkasan divisi',
            text: 'Angka utama cuti divisi Anda: karyawan aktif, pengajuan, dan hari libur tahun ini.'
        },
        {
            element: 'admin-calendar',
            title: 'Kalender divisi',
            text: 'Siapa saja yang cuti pada tanggal tertentu, untuk membantu mengatur kebutuhan tim.'
        },
        {
            element: 'notifications',
            title: 'Notifikasi',
            text: 'Kabar saat ada pengajuan baru di divisi Anda. Klik notifikasinya untuk membuka Pemantauan.'
        },
        {
            element: 'profile',
            title: 'Profil & akun',
            text: 'Ganti foto, kontak notifikasi, dan password di sini.'
        },
        {
            element: 'tour-button',
            title: 'Butuh panduan lagi?',
            text: 'Setiap halaman admin punya tur sendiri. Buka lewat tombol ini saat berada di halaman tersebut.'
        },
        {
            element: 'profile',
            ifHidden: 'tour-button',
            title: 'Butuh panduan lagi?',
            text: 'Buka menu profil, lalu pilih <b>Tur halaman ini</b> atau <b>Tur pengenalan</b>.'
        }
    ],
    'admin.pemantauan': [
        {
            element: 'mon-filters',
            title: 'Saring pengajuan',
            personas: ['admin'],
            text: 'Cari nomor pengajuan, nama, atau NIK, lalu saring per status, jenis cuti, dan rentang tanggal.'
        },
        {
            element: 'mon-filters',
            title: 'Saring pengajuan',
            personas: ['superadmin'],
            text: 'Cari nomor pengajuan, nama, atau NIK, lalu saring per status, jenis cuti, divisi, dan rentang tanggal.'
        },
        {
            element: 'mon-table',
            title: 'Daftar pengajuan',
            personas: ['admin'],
            text: 'Semua pengajuan di divisi Anda beserta statusnya.'
        },
        {
            element: 'mon-table',
            title: 'Daftar pengajuan',
            personas: ['superadmin'],
            text: 'Pengajuan dari seluruh divisi beserta statusnya.'
        },
        {
            element: 'mon-col-aksi',
            title: 'Detail',
            text: 'Lihat isi lengkap, dokumen pendukung, dan alur persetujuan setiap pengajuan.'
        },
        {
            element: 'export-excel',
            title: 'Ekspor Excel',
            text: 'Unduh daftar pengajuan sesuai filter yang sedang aktif.'
        }
    ],
    'admin.pengajuan-karyawan': [
        {
            element: 'create-employee',
            title: 'Pilih karyawan',
            personas: ['admin'],
            text: 'Hanya karyawan di divisi Anda yang muncul. Pengganti tugas nanti dipilih dari rekan karyawan ini.'
        },
        {
            element: 'create-employee',
            title: 'Pilih karyawan',
            personas: ['superadmin'],
            text: 'Pilih karyawan dari divisi mana pun. Pengganti tugas nanti dipilih dari rekan karyawan ini.'
        },
        {
            element: 'create-type',
            title: 'Jenis cuti',
            text: 'Pilih jenis cuti, lalu isi tanggal, pengganti tugas, dan alasan.'
        },
        {
            element: 'create-summary',
            title: 'Hari kerja & sisa saldo',
            text: 'Hari kerja dihitung otomatis: akhir pekan dan hari libur tidak dihitung. Sisa saldo karyawan tampil setelah karyawan dipilih.'
        },
        {
            element: 'create-submit',
            title: 'Buat Pengajuan',
            text: 'Pengajuan tetap melewati alur approval yang sama seperti pengajuan dari karyawan sendiri.'
        }
    ],
    'admin.saldo': [
        READONLY,
        {
            element: 'bal-filters',
            title: 'Cari & saring',
            text: 'Cari nama atau NIK, lalu pilih divisi dan tahun periode saldo.'
        },
        {
            element: 'bal-table',
            title: 'Saldo karyawan',
            text: 'Hak kuota, carry over, cuti terpakai, dan sisa saldo setiap karyawan.'
        },
        {
            element: 'bal-col-aksi',
            title: 'Riwayat & penyesuaian',
            text: 'Lihat riwayat mutasi saldo, atau sesuaikan saldo. Setiap penyesuaian <b>wajib disertai alasan</b> dan tercatat di riwayat mutasi.'
        }
    ],
    'admin.karyawan': [
        READONLY,
        {
            element: 'emp-filters',
            title: 'Cari & saring',
            text: 'Cari nama, NIK, atau email, lalu saring per divisi dan status akun.'
        },
        {
            element: 'emp-table',
            title: 'Data karyawan',
            text: 'NIK, kontak, jabatan, atasan langsung, dan masa kerja setiap karyawan.'
        },
        {
            element: 'emp-col-status',
            title: 'Status akun',
            text: 'Aktif, Nonaktif, atau Terkunci. Klik keterangan nonaktif untuk melihat riwayat perubahan status beserta alasannya.'
        },
        {
            element: 'export-excel',
            title: 'Ekspor Excel',
            text: 'Unduh data karyawan sesuai filter yang sedang aktif.'
        }
    ],
    'admin.jenis-cuti': [
        READONLY,
        {
            element: 'lt-add',
            title: 'Tambah jenis cuti',
            text: 'Buat jenis cuti baru beserta aturannya.'
        },
        {
            element: 'lt-col-quota',
            title: 'Kuota & dokumen',
            text: 'Apakah jenis cuti ini memotong kuota tahunan, dan apakah pengajuannya wajib melampirkan dokumen.'
        },
        {
            element: 'lt-col-rules',
            title: 'Aturan',
            text: 'Batas maksimal hari per pengajuan, boleh untuk tanggal yang sudah lewat, dan tenggat dokumen susulan.'
        },
        {
            element: 'lt-table',
            title: 'Ubah atau nonaktifkan',
            text: 'Gunakan tombol di setiap baris. Jenis cuti yang dinonaktifkan tidak bisa dipilih di pengajuan baru.'
        }
    ],
    'admin.kebijakan': [
        READONLY,
        {
            element: 'policy-fields',
            title: 'Kuota & carry over',
            text: 'Kuota cuti tahunan, batas sisa cuti yang boleh dibawa ke periode berikutnya (carry over), dan lama masa berlakunya.'
        },
        {
            element: 'policy-save',
            title: 'Simpan perubahan',
            text: 'Tombol aktif setelah ada perubahan. Periksa kembali angkanya sebelum menyimpan karena memengaruhi saldo karyawan.'
        }
    ],
    'admin.hari-libur': [
        READONLY,
        {
            element: 'hol-add',
            title: 'Tambah hari libur',
            text: 'Hari libur dan cuti bersama tidak dihitung sebagai hari kerja saat karyawan mengajukan cuti.'
        },
        {
            element: 'hol-import',
            title: 'Impor CSV',
            text: 'Tambahkan banyak hari libur sekaligus dari file CSV. Template-nya bisa diunduh di dialog impor.'
        },
        {
            element: 'hol-col-type',
            title: 'Kategori',
            text: 'Membedakan libur nasional dan cuti bersama.'
        }
    ],
    'admin.alur-approval': [
        READONLY,
        {
            element: 'flow-template',
            title: 'Templat approval',
            text: 'Setiap templat adalah satu alur persetujuan. Pilih templat untuk melihat tingkat dan anggotanya.'
        },
        {
            element: 'flow-levels',
            title: 'Tingkat approval',
            text: 'Urutan pemberi persetujuan; setiap tingkat diisi satu peran. Geser ikon ≡ atau pakai tombol naik/turun untuk mengubah urutan.'
        },
        {
            element: 'flow-add-level',
            title: 'Tambah tingkat',
            text: 'Tambah tingkat baru ke templat yang dipilih. Gunakan <b>Templat Baru</b> untuk membuat alur lain.'
        },
        {
            element: 'flow-members',
            title: 'Anggota templat',
            text: 'Karyawan yang pengajuan cutinya mengikuti alur ini. Kelola anggotanya lewat tombol di bagian ini.'
        }
    ],
    'admin.laporan': [
        {
            element: 'rep-tabs',
            title: 'Jenis laporan',
            text: 'Riwayat cuti, saldo karyawan, dan rekap penggunaan per jenis cuti.'
        },
        {
            element: 'rep-filters',
            title: 'Filter',
            text: 'Tahun, rentang tanggal, jenis cuti, status, dan pencarian. Filter yang terlihat di tab ini ikut terbawa saat ekspor.'
        },
        {
            element: 'rep-table',
            title: 'Hasil laporan',
            text: 'Data sesuai tab dan filter yang aktif.'
        },
        {
            element: 'rep-pdf',
            title: 'Ekspor PDF',
            text: 'Versi siap cetak dari tab yang sedang dibuka.'
        },
        {
            element: 'export-excel',
            title: 'Ekspor CSV',
            text: 'Unduh tab yang sedang dibuka beserta filter yang terlihat, dalam format CSV yang bisa dibuka di Excel.'
        }
    ],
    'admin.audit': [
        {
            element: 'audit-filters',
            title: 'Saring log',
            text: 'Cari user, aksi, IP, atau detail, lalu saring per aksi, entitas, dan rentang tanggal.'
        },
        {
            element: 'audit-table',
            title: 'Log aktivitas',
            personas: ['admin'],
            text: 'Siapa melakukan apa dan kapan: login, pengajuan, keputusan approval, dan perubahan master data di divisi Anda.'
        },
        {
            element: 'audit-table',
            title: 'Log aktivitas',
            personas: ['superadmin'],
            text: 'Siapa melakukan apa dan kapan di seluruh aplikasi: login, pengajuan, keputusan approval, perubahan master data, akun, dan hak akses.'
        },
        {
            element: 'audit-col-detail',
            title: 'Detail perubahan',
            text: 'Ringkasan perubahan. Tekan tombol detail untuk melihat isi lengkapnya.'
        },
        {
            element: 'export-excel',
            title: 'Ekspor CSV',
            text: 'Unduh log yang sudah dimuat sesuai filter (paling banyak 500 entri terbaru) sebagai CSV yang bisa dibuka di Excel.'
        }
    ]
};
