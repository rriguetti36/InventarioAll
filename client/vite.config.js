const { defineConfig } = require('vite');

module.exports = defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    allowedHosts: [
      'inventarios.local',
      'pos.local',
      'inventpos.local',
      'invenpos.local',
    ],
  },
  plugins: [
    {
      name: 'log-final-port',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const address = server.httpServer.address();
          const port = address && address.port ? address.port : 5173;
          console.log(`[VITE] Cliente iniciado en http://localhost:${port}`);
        });
      },
    },
  ],
});
