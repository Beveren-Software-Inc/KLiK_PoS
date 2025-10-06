import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'
import proxyOptions from './proxyOptions';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 8080,
		host: '0.0.0.0',
		proxy: proxyOptions
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src')
		}
	},
	build: {
		outDir: '../klik_pos/public/klik_spa',
		emptyOutDir: true,
		target: 'es2015',
	},
});



// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import { fileURLToPath, URL } from 'url';

// // https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   resolve: {
//     alias: {
//       '@': fileURLToPath(new URL('./src', import.meta.url))
//     },
//   },
//   server: {
//     proxy: {
//       '/api': {
//         target: 'https://m-alnakheel-test.frappe.cloud',
//         changeOrigin: true,
//         secure: true,
//         configure: (proxy, _options) => {
//           proxy.on('error', (err, _req, _res) => {
//             console.log('proxy error', err);
//           });
//           proxy.on('proxyReq', (proxyReq, req, _res) => {
//             console.log('Sending Request to the Target:', req.method, req.url);
//           });
//           proxy.on('proxyRes', (proxyRes, req, _res) => {
//             console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
//           });
//         },
//       }
//     }
//   }
// });
