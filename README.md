# Express + SQL Server Backend

Proyecto de ejemplo con Node.js, Express y SQL Server Express.

## Instalación

1. Instala dependencias:

```bash
npm install
```

2. Copia el archivo de ejemplo:

```bash
copy .env.example .env
```

3. Ajusta la conexión en `.env`.

4. Ejecuta el servidor:

```bash
npm run dev
```

## Estructura

- `server.js` - punto de entrada
- `config/db.js` - configuración de conexión SQL Server
- `models/UserModel.js` - acceso a datos
- `services/UserService.js` - lógica de negocio
- `controllers/UserController.js` - controladores HTTP
- `routes/userRoutes.js` - rutas REST
