const common_site_config = require('../../../sites/common_site_config.json');
const { webserver_port, default_site } = common_site_config;

export default {
	'^/(app|api|assets|files|private)': {
		target: `http://127.0.0.1:${webserver_port}`,
		ws: true,
		changeOrigin: true,
		secure: false,
		configure: (proxy, _options) => {
			proxy.on('error', (err, _req, _res) => {
				console.log('Proxy error:', err);
			});
			proxy.on('proxyReq', (proxyReq, req, _res) => {
				// Set the Host header to the default site for Frappe routing
				if (default_site) {
					proxyReq.setHeader('Host', `${default_site}:${webserver_port}`);
				}
				console.log('Proxying request:', req.method, req.url, '->', proxyReq.path);
			});
			proxy.on('proxyRes', (proxyRes, req, _res) => {
				console.log('Proxy response:', proxyRes.statusCode, req.url);
			});
		}
	}
};
