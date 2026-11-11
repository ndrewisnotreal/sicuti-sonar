export const TOUR_STEPS = {
    'karyawan.pengenalan': [
        {
            title: 'Selamat datang di Lebur',
            text: 'Lebur adalah sistem pengajuan cuti PT Inalum. Tur singkat ini menunjukkan bagian-bagian utama. Anda bisa menutupnya kapan saja.'
        },
        {
            element: 'menu:/leave/history',
            title: 'Pengajuan Cuti',
            text: 'Buat pengajuan baru dan pantau prosesnya sampai disetujui.'
        },
        {
            element: 'menu:/leave/balance',
            title: 'Saldo Cuti',
            text: 'Lihat sisa saldo, kuota tahunan, sisa tahun lalu, dan riwayat perubahannya.'
        },
        {
            element: 'menu-mobile',
            title: 'Menu navigasi',
            text: 'Semua menu (Pengajuan Cuti, Saldo Cuti) ada di sini.'
        },
        {
            element: 'dash-ajukan',
            title: 'Ajukan cuti',
            text: 'Mulai pengajuan baru langsung dari Dashboard.'
        },
        {
            element: 'dash-riwayat',
            title: 'Riwayat terbaru',
            text: 'Pengajuan terakhir Anda beserta statusnya. Klik salah satu untuk melihat detail dan alur persetujuannya.'
        },
        {
            element: 'notifications',
            title: 'Notifikasi',
            text: 'Kabar saat pengajuan disetujui, ditolak, atau dikembalikan untuk diperbaiki.'
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
    'karyawan.pengajuan': [
        {
            element: 'leave-add',
            title: 'Tambah Pengajuan',
            text: 'Buka formulir pengajuan cuti baru. Di dalam formulir ada tombol <b>?</b> untuk panduan pengisiannya.'
        },
        {
            element: 'leave-status-tabs',
            title: 'Saring per status',
            text: 'Tampilkan pengajuan berdasarkan status. Angka di tiap pilihan adalah jumlah pengajuannya.'
        },
        {
            element: 'leave-search',
            title: 'Cari pengajuan',
            text: 'Cari berdasarkan nomor pengajuan, jenis cuti, atau alasan.'
        },
        {
            element: 'leave-col-status',
            title: 'Arti status',
            text: '<b>Draf</b>: belum dikirim.<br><b>Menunggu Approval</b>: sedang diproses atasan.<br><b>Dikembalikan</b>: perlu diperbaiki lalu diajukan ulang.<br><b>Disetujui</b>, <b>Ditolak</b>, <b>Dibatalkan</b>: proses selesai.'
        },
        {
            element: 'leave-col-aksi',
            title: 'Aksi',
            text: 'Lihat detail dan alur persetujuan, ubah atau kirim draf, dan batalkan pengajuan yang masih Draf atau belum diproses.'
        },
        {
            element: 'leave-list-mobile',
            title: 'Daftar pengajuan',
            text: 'Setiap pengajuan menampilkan status dan tombol aksinya. <b>Dikembalikan</b> berarti perlu diperbaiki lalu diajukan ulang; pengajuan Draf atau yang belum diproses masih bisa dibatalkan.'
        }
    ],
    'karyawan.formulir': [
        {
            element: 'form-type',
            title: 'Jenis cuti',
            text: 'Pilih jenis cuti. Saldo tersedia tampil di kanan; aturan jenis cuti (maksimal hari, boleh tanggal lampau, dokumen wajib) muncul di bawahnya.'
        },
        {
            element: 'form-dates',
            title: 'Tanggal cuti',
            text: 'Durasi dihitung otomatis dalam hari kerja: akhir pekan dan hari libur tidak dihitung. Perkiraan sisa saldo ikut ditampilkan.'
        },
        {
            element: 'form-substitute',
            title: 'Pengganti tugas',
            text: 'Rekan yang menggantikan tugas selama Anda cuti. Bertanda <b>*</b> bila wajib untuk jabatan Anda.'
        },
        {
            element: 'form-reason',
            title: 'Alasan',
            text: 'Tuliskan keperluan cuti. Alasan ini dibaca approver saat memproses pengajuan.'
        },
        {
            element: 'form-attachment',
            title: 'Dokumen pendukung',
            text: 'Muncul untuk jenis cuti yang membutuhkan dokumen. Bila diizinkan, dokumen boleh menyusul dari halaman Pengajuan Cuti.'
        },
        {
            element: 'form-actions',
            title: 'Simpan atau kirim',
            text: '<b>Simpan Draf</b> menyimpan tanpa mengirim, belum diproses siapa pun. <b>Kirim Pengajuan</b> meneruskannya ke approver.'
        }
    ],
    'karyawan.detail': [
        {
            element: 'detail-summary',
            title: 'Ringkasan',
            text: 'Nama, NIK, divisi, dan status pengajuan saat ini.'
        },
        {
            element: 'detail-attachment',
            title: 'Dokumen pendukung',
            text: 'Dokumen yang dilampirkan, atau pengingat bila dokumen masih harus dilengkapi.'
        },
        {
            element: 'detail-timeline',
            title: 'Alur persetujuan',
            text: 'Siapa saja yang memproses pengajuan ini, urutannya, dan catatan dari setiap approver.'
        },
        {
            element: 'detail-actions',
            title: 'Tindakan',
            text: '<b>Cetak Surat Cuti</b> muncul setelah disetujui, lengkap dengan QR untuk validasi. Bila dikembalikan, gunakan <b>Ajukan Ulang / Ubah</b>.'
        }
    ],
    'karyawan.saldo': [
        {
            element: 'balance-stats',
            title: 'Ringkasan saldo',
            text: 'Kuota tahunan, sisa cuti tahun lalu, cuti yang sudah terpakai, dan sisa saldo Anda.'
        },
        {
            element: 'balance-mutasi',
            title: 'Riwayat perubahan saldo',
            text: 'Setiap perubahan saldo: potongan dari cuti yang disetujui dan penyesuaian oleh admin beserta alasannya.'
        }
    ]
};
