# OCG Backend — Casino Online API

Backend para la gestión de juegos de casino online. Consume la API de proveedores externos, almacena los datos en PostgreSQL y expone endpoints REST para el frontend.

## Tecnologías

- **Runtime:** Node.js + TypeScript
- **Framework:** Express 5
- **ORM:** Prisma
- **Base de datos:** PostgreSQL (Neon)
- **Caché:** node-cache (en memoria)
- **Seguridad:** Helmet, CORS, express-rate-limit
- **Logging:** Winston
- **Validación:** Zod

---

## Instalación

```bash
# 1. clonar el repositorio
git clone <url-del-repo>
cd ocg-be

# 2. instalar dependencias
npm install

# 3. configurar variables de entorno
cp .env.example .env
# editar .env con tus valores (ver sección "Variables de Entorno")

# 4. sincronizar el schema con la base de datos
npx prisma db push

# 5. cargar los nombres reales de los proveedores predeterminados
npx prisma db seed

# 6. iniciar en modo desarrollo
npm run dev
```

### Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia el servidor en modo desarrollo con hot-reload |
| `npm run build` | Compila TypeScript a JavaScript |
| `npm start` | Inicia el servidor compilado (producción) |

---

## Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Puerto del servidor (default: 3000)
PORT=3000

# URL de conexión a PostgreSQL
DATABASE_URL=postgresql://usuario:password@host:5432/nombre_db

# Entorno: development | production | test
NODE_ENV=development

# Clave secreta para proteger el endpoint /sync (mínimo 10 caracteres)
API_KEY=tu-clave-secreta-aqui

# URL del frontend (se usa para CORS en producción)
FRONTEND_URL=http://localhost:5173

# (opcional) Expresión cron para sincronización automática (default: cada 6 horas)
SYNC_CRON=0 */6 * * *

# URL externa del servicio en Render (inyectada automáticamente o manual)
RENDER_EXTERNAL_URL=https://tu-servicio.onrender.com
```

> ⚠️ **Importante:** Cambiar `DATABASE_URL` y `API_KEY` antes de desplegar a producción.
> En Render, asegurarse de que `NODE_ENV=production` y `RENDER_EXTERNAL_URL` estén definidas.

---

## Priorización de Juegos (Destacados)

Por defecto, los juegos se ordenan alfabéticamente para garantizar una mezcla visual adecuada entre proveedores sin romper la paginación de la API. Sin embargo, el sistema cuenta con un campo `priority` (por defecto `0`) en la base de datos que permite destacar juegos manualmente.

**Cómo modificar la prioridad (Opción Manual):**
1. Abre tu terminal en la raíz de este proyecto y ejecuta `npx prisma studio`.
2. Se abrirá una interfaz web en tu navegador (usualmente en `http://localhost:5555`).
3. Ingresa al modelo **Game** y usa el buscador para encontrar el juego que deseas destacar.
4. Cambia el valor de la columna `priority` de `0` a un número mayor (ej. `10`, `50` o `100`). **Los números más altos siempre aparecerán primero.**
5. Haz clic en el botón verde de "Save" (Guardar cambios).

Los juegos modificados adoptarán sus nuevas posiciones instantáneamente en el frontend. El resto de juegos con prioridad `0` seguirán ordenándose alfabéticamente.

---

## Marcar juegos con Buy Feature / Bonus Buy

La API del proveedor no informa qué juegos tienen Buy Feature, por lo que este atributo se administra manualmente mediante el campo `hasBuyFeature` en la tabla `Game`.

1. Ejecutar `npx prisma studio` en la raíz del proyecto.
2. Abrir el modelo **Game** y buscar el juego deseado.
3. Cambiar el valor de la columna `hasBuyFeature` de `false` a `true`.
4. Guardar los cambios.

El sync automático (`POST /sync`) **nunca sobrescribe** este campo: solo se inicializa en `false` al crear un juego nuevo y queda tal cual quedó marcado manualmente en los updates siguientes.

Para consumir desde el frontend: `GET /api/games?hasBuyFeature=true` (combinable con `type`, `providerId`, `search`, etc.).

---
## Endpoints

Base URL: `http://localhost:3000`

### Health Check

```
GET /health
```

Respuesta:
```json
{
  "status": "OK",
  "timestamp": "2026-03-20T12:00:00.000Z"
}
```

---

### Obtener juegos (con filtros y paginación)

```
GET /api/games
```

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `page` | number | No | Página actual (default: 1) |
| `limit` | number | No | Juegos por página (default: 20) |
| `search` | string | No | Buscar por nombre del juego |
| `type` | string | No | Filtrar por categoría (ej: `SLOTS`, `ROULETTE`, `LIVE`) |
| `providerId` | string | No | Filtrar por ID del proveedor |
| `isLive` | boolean | No | Filtrar juegos en vivo (`true` / `false`) |
| `hasBuyFeature` | boolean | No | Filtrar juegos con Buy Feature / Bonus Buy (`true` / `false`) |

**Ejemplo:**
```
GET /api/games?page=1&limit=10&type=SLOTS&search=dragon
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": "12345",
      "name": "Dragon's Fire",
      "type": "SLOTS",
      "providerId": "9",
      "launchUrl": "https://...",
      "demoUrl": "https://...",
      "thumbnail": "https://...",
      "rtp": 96.5,
      "isLive": false,
      "isActive": true,
      "createdAt": "2026-03-18T...",
      "updatedAt": "2026-03-18T..."
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15
  }
}
```

---

### Obtener juegos para la página principal

```
GET /api/games/home
```

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `limit` | number | No | Cantidad de juegos por bloque (default: 12) |

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "live": [ /* juegos en vivo */ ],
    "recent": [ /* últimos juegos agregados */ ],
    "randomSlots": [ /* selección aleatoria de slots */ ]
  }
}
```

---

### Obtener categorías

```
GET /api/games/categories
```

**Respuesta:**
```json
{
  "success": true,
  "data": ["LIVE", "BACCARAT", "BLACKJACK", "ROULETTE", "SLOTS"]
}
```

> La categoría `LIVE` es virtual — agrupa todos los juegos con `isLive: true`.

---

### Obtener proveedores

```
GET /api/games/providers
```

Solo devuelve los proveedores permitidos: **PragmaticPlay** (4), **Fugaso** (7), **TurboGames** (58), **PGSoft** (64).

**Respuesta:**
```json
{
  "success": true,
  "data": [
    { "id": "7", "name": "Fugaso" },
    { "id": "4", "name": "PragmaticPlay" },
    { "id": "64", "name": "PGSoft" },
    { "id": "58", "name": "TurboGames" }
  ]
}
```

---

### Obtener un juego por ID

```
GET /api/games/:id
```

**Ejemplo:**
```
GET /api/games/12345
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "id": "12345",
    "name": "Dragon's Fire",
    "type": "SLOTS",
    "providerId": "9",
    "providerName": "Fugaso",
    "launchUrl": "https://...",
    "thumbnail": "https://...",
    "rtp": 96.5,
    "isLive": false,
    "isActive": true,
    "createdAt": "2026-03-18T...",
    "updatedAt": "2026-03-18T..."
  }
}
```

**Juego no encontrado (404):**
```json
{
  "success": false,
  "message": "Game not found"
}
```

---

### Sincronizar juegos (protegido)

```
POST /api/games/sync
```

**Headers requeridos:**

| Header | Valor |
|--------|-------|
| `x-api-key` | El valor de `API_KEY` del `.env` |

**Parámetros opcionales (Query o Body):**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `env` | string | Enviar `production` para conectar a la API real, u omitir para usar staging. |

Ejemplo para producción: `POST /api/games/sync?env=production`

**Respuesta:**
```json
{
  "success": true,
  "message": "Successfully synchronized 250 games."
}
```

> Este endpoint descarga los juegos de la API del proveedor, filtra y guarda **únicamente** los juegos que pertenecen a proveedores ya registrados en la DB (los cargados en el paso de instalación), y marca como inactivos los que ya no existen. El caché se limpia automáticamente.

---

## Seguridad

| Capa | Descripción |
|------|-------------|
| **Helmet** | Headers HTTP de seguridad (XSS, clickjacking, etc.) |
| **CORS** | En producción solo acepta requests del `FRONTEND_URL` |
| **Rate Limiting** | Máximo 100 requests por minuto por IP en `/api/*` |
| **API Key** | El endpoint `/sync` requiere header `x-api-key` |

---

## Caché

Las respuestas se cachean en memoria para reducir consultas a la base de datos:

| Endpoint | TTL |
|----------|-----|
| `GET /games` | 5 minutos |
| `GET /games/:id` | 5 minutos |
| `GET /home` | 2 minutos |
| `GET /categories` | 10 minutos |
| `GET /providers` | 10 minutos |

El caché se invalida automáticamente después de cada sincronización (`POST /sync`).

---

## Filtro de proveedores y juegos

Los endpoints de lectura aplican un filtro global que:

- **Solo muestra juegos** de los proveedores: PragmaticPlay (`4`), Fugaso (`7`), TurboGames (`58`), PGSoft (`64`) + juegos en vivo (`isLive: true`).
- **Excluye juegos** que contengan "plinko" en el nombre (case-insensitive).

Los juegos de otros proveedores se sincronizan y almacenan en la DB, pero no se exponen en la API. Para agregar o quitar proveedores, modificar `ALLOWED_PROVIDER_IDS` en `src/repositories/game.repository.ts`.

---

## Keep-Alive (anti cold start)

En producción, el servidor se auto-pinguea cada 14 minutos al endpoint `/health` para evitar que Render apague el servicio por inactividad (plan Free).

Requiere la variable `RENDER_EXTERNAL_URL` configurada en Render.

---

## Sincronización automática

En producción (`NODE_ENV=production`), un cron job ejecuta la sincronización automáticamente cada 6 horas (configurable vía `SYNC_CRON` en `.env`).

En desarrollo, usar el endpoint `POST /api/games/sync` manualmente desde Postman.

---

## Pre-calentamiento del cache

Al iniciar el servidor, se pre-cargan en cache las queries más comunes (`getGames`, `getHomeGames`, `getCategories`, `getProviders`) para que la primera request de un usuario ya tenga datos en cache y no golpee la base de datos.

---

## Estructura del proyecto

```
src/
├── config/
│   ├── cron.ts           # tareas programadas
│   ├── env.config.ts     # validación de variables de entorno
│   └── prisma.ts         # instancia singleton de Prisma
├── controllers/
│   └── game.controller.ts
├── middlewares/
│   ├── auth.middleware.ts  # autenticación por API Key
│   └── error.middleware.ts # manejador global de errores
├── repositories/
│   └── game.repository.ts # acceso a datos (Prisma)
├── routes/
│   └── game.routes.ts
├── services/
│   ├── game.service.ts          # lógica de negocio + caché
│   └── lucky-streak.service.ts  # cliente API del proveedor
├── utils/
│   ├── cache.ts          # servicio de caché en memoria
│   ├── cache-warmup.ts   # pre-calentamiento del caché al iniciar
│   ├── keep-alive.ts     # self-ping para evitar cold start en Render
│   └── logger.ts         # configuración de Winston
├── app.ts      # configuración de Express
└── server.ts   # punto de entrada
```
