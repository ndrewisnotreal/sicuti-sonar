import { fileURLToPath, URL } from 'node:url';
import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

// `npm run dev:ssl` untuk backend yang dijalankan dengan start:dev:ssl (dibaca dari nama script,
// seperti backend/src/main.ts, supaya .env.development tetap dimuat di kedua mode).
const useSsl = process.env.npm_lifecycle_event === 'dev:ssl';

// https://vitejs.dev/config/
export default defineConfig(() => {
    const backend = useSsl ? 'https://localhost:3001' : 'http://localhost:3001';
    const base = process.env.VITE_BASE_URL || '/';
    return {
        base,
        // Dev: VITE_API_BASE_URL=/api → proxy ke Nest (prefix /api dibuang), seperti template-vuejs.
        // Localhost maupun perangkat lain (HP, laptop teman) memakai jalur yang sama.
        server: {
            port: 5175,
            host: true,
            proxy: {
                '/api': {
                    target: backend,
                    changeOrigin: true,
                    secure: false, // sertifikat self-signed backend mode SSL
                    rewrite: (path) => path.replace(/^\/api/, '')
                }
            }
        },
        optimizeDeps: {
            include: ['qrcode']
        },
        plugins: [
            vue(),
            tailwindcss(),
            Components({
                resolvers: [PrimeVueResolver()]
            })
        ],
        build: {
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (/node_modules[\\/](vue|@vue|vue-router)[\\/]/.test(id)) return 'vue';
                        if (/node_modules[\\/]@primeuix[\\/]/.test(id)) return 'primeuix';
                    }
                }
            }
        },
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url))
            }
        },
        css: {
            preprocessorOptions: {
                scss: {
                    api: 'modern-compiler'
                }
            }
        },
        // Unit test frontend (Vitest), sama seperti template-vuejs: `npm test` / `npm run test:cov`
        test: {
            environment: 'jsdom',
            globals: true,
            include: ['test/**/*.test.js'],
            // Runner CI lambat + instrumentasi coverage: import dingin modul (vi.resetModules) bisa >5 detik.
            testTimeout: 30000,
            hookTimeout: 30000,
            coverage: {
                provider: 'istanbul',
                reporter: ['text', 'html', 'lcov'],
                reportsDirectory: './coverage',
                include: ['src/**/*.{js,vue}'],
                exclude: ['src/main.js']
            }
        }
    };
});
