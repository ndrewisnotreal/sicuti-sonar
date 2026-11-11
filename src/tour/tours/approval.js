export const TOUR_STEPS = {
    'approval.pengenalan': [
        {
            title: 'Selamat datang di Lebur',
            text: 'Sebagai approver, Anda memeriksa dan memutuskan pengajuan cuti yang masuk ke antrean Anda sesuai urutan di Alur Approval. Tur singkat ini menunjukkan bagian-bagian utamanya.'
        },
        {
            element: 'menu:/approval/pending',
            title: 'Validasi Pengajuan',
            text: 'Pengajuan yang menunggu keputusan Anda. Angka di menu menunjukkan jumlah antrean.'
        },
        {
            element: 'menu:/approval/history',
            title: 'Riwayat Approval',
            text: 'Semua keputusan yang pernah Anda berikan beserta catatannya.'
        },
        {
            element: 'menu-mobile',
            title: 'Menu navigasi',
            text: 'Menu Validasi Pengajuan dan Riwayat Approval ada di sini.'
        },
        {
            element: 'appr-stats',
            title: 'Ringkasan',
            text: 'Jumlah pengajuan yang menunggu validasi, yang sudah Anda setujui, dan total yang sudah Anda proses.'
        },
        {
            element: 'appr-today',
            title: 'Sedang cuti hari ini',
            text: 'Siapa saja yang sedang cuti hari ini. Berguna sebelum menyetujui cuti baru agar tim tidak kekurangan orang.'
        },
        {
            element: 'appr-queue',
            title: 'Antrean menunggu validasi',
            text: 'Klik <b>Proses</b> untuk menyetujui, menolak, atau mengembalikan pengajuan langsung dari Dashboard.'
        },
        {
            element: 'notifications',
            title: 'Notifikasi',
            text: 'Kabar saat ada pengajuan baru yang menunggu keputusan Anda. Klik notifikasinya untuk langsung membuka antrean.'
        },
        {
            element: 'profile',
            title: 'Profil & akun',
            text: 'Ganti foto, kontak notifikasi, dan password di sini.'
        },
        {
            element: 'tour-button',
            title: 'Butuh panduan lagi?',
            text: 'Buka tur halaman yang sedang dibuka, atau ulangi tur ini, lewat tombol ini.'
        },
        {
            element: 'profile',
            ifHidden: 'tour-button',
            title: 'Butuh panduan lagi?',
            text: 'Buka menu profil, lalu pilih <b>Tur halaman ini</b> atau <b>Tur pengenalan</b>.'
        }
    ],
    'approval.validasi': [
        {
            element: 'pending-filters',
            title: 'Cari & saring',
            text: 'Cari berdasarkan nama karyawan atau nomor pengajuan, dan saring per divisi.'
        },
        {
            element: 'pending-table',
            title: 'Antrean pengajuan',
            text: 'Pengajuan yang menunggu keputusan Anda: pemohon, jenis cuti, periode, durasi hari kerja, dan dokumen lampiran bila ada.'
        },
        {
            element: 'pending-col-aksi',
            title: 'Detail atau Proses',
            text: '<b>Detail</b> menampilkan isi lengkap dan alur persetujuan. <b>Proses</b> membuka formulir keputusan; di sana ada tombol <b>?</b> untuk panduannya.'
        },
        {
            element: 'pending-list-mobile',
            title: 'Antrean pengajuan',
            text: 'Setiap pengajuan berisi pemohon, jenis cuti, periode, dan durasi. <b>Detail</b> menampilkan isi lengkap; <b>Proses</b> membuka formulir keputusan.'
        }
    ],
    'approval.proses': [
        {
            element: 'action-summary',
            title: 'Ringkasan pengajuan',
            text: 'Periksa pemohon, jenis cuti, durasi hari kerja, rentang tanggal, dan alasannya sebelum memutuskan.'
        },
        {
            element: 'action-attachment',
            title: 'Dokumen lampiran',
            text: 'Buka dokumen pendukung. Bila dokumen wajib belum diunggah pemohon, pengajuan belum bisa disetujui.'
        },
        {
            element: 'action-notes',
            title: 'Catatan',
            text: 'Opsional saat menyetujui, <b>wajib</b> saat menolak atau mengembalikan. Catatan ini dibaca pemohon.'
        },
        {
            element: 'action-return',
            title: 'Kembalikan',
            text: 'Minta pemohon memperbaiki pengajuan. Setelah diperbaiki, pemohon bisa mengajukan ulang.'
        },
        {
            element: 'action-reject',
            title: 'Tolak',
            text: 'Pengajuan selesai dengan status Ditolak dan tidak diproses lebih lanjut.'
        },
        {
            element: 'action-approve',
            title: 'Setujui',
            text: 'Meneruskan ke approver berikutnya, atau menyelesaikan persetujuan bila Anda tingkat terakhir. Nonaktif selama dokumen wajib belum diunggah. Setiap keputusan diminta konfirmasi dulu.'
        }
    ],
    'approval.detail': [
        {
            element: 'detail-summary',
            title: 'Ringkasan',
            text: 'Pemohon, NIK, divisi, dan status pengajuan saat ini.'
        },
        {
            element: 'detail-attachment',
            title: 'Dokumen pendukung',
            text: 'Dokumen yang dilampirkan pemohon, atau penanda bila dokumen masih ditunggu.'
        },
        {
            element: 'detail-timeline',
            title: 'Alur persetujuan',
            text: 'Urutan approver, siapa yang sudah memutuskan, dan catatan mereka.'
        },
        {
            element: 'detail-actions',
            title: 'Proses',
            text: 'Buka formulir keputusan langsung dari sini.'
        }
    ],
    'approval.riwayat': [
        {
            element: 'history-filters',
            title: 'Cari & saring',
            text: 'Cari berdasarkan nama, nomor pengajuan, jenis cuti, atau catatan, dan saring menurut status pengajuan sekarang.'
        },
        {
            element: 'history-col-status',
            title: 'Status sekarang',
            text: 'Status pengajuan saat ini, terpisah dari keputusan Anda. Pengajuan yang Anda setujui bisa masih menunggu approver berikutnya.'
        },
        {
            element: 'history-col-notes',
            title: 'Catatan Anda',
            text: 'Catatan yang Anda tulis saat memberi keputusan.'
        },
        {
            element: 'history-list-mobile',
            title: 'Riwayat keputusan',
            text: 'Setiap baris berisi pengajuan yang pernah Anda proses, keputusan Anda, status sekarang, dan catatan Anda.'
        }
    ]
};
