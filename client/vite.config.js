const { defineConfig } = require('vite');

module.exports = defineConfig({
  server: {
    port: 5173,
    strictPort: false,
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
