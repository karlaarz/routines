# 🌸 Glow PWA – Guía de Instalación

## Archivos del proyecto
```
skincare-pwa/
├── index.html       ← App principal
├── style.css        ← Estilos
├── app.js           ← Lógica de la app
├── sw.js            ← Service Worker (notificaciones + offline)
├── manifest.json    ← Configuración PWA
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🚀 Despliegue en tu servidor

### Opción 1 – Nginx (recomendado)

1. Sube todos los archivos a tu servidor (p.ej. `/var/www/glow/`)

2. Configura Nginx:
```nginx
server {
    listen 443 ssl;
    server_name glow.tudominio.com;

    root /var/www/glow;
    index index.html;

    # Headers necesarios para PWA
    add_header Cache-Control "no-cache";
    add_header Service-Worker-Allowed "/";

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

3. **⚠️ IMPORTANTE: La PWA necesita HTTPS** para las notificaciones.
   Usa Let's Encrypt (Certbot) si aún no tienes SSL:
   ```bash
   certbot --nginx -d glow.tudominio.com
   ```

### Opción 2 – Apache

```apache
<VirtualHost *:443>
    ServerName glow.tudominio.com
    DocumentRoot /var/www/glow

    <Directory /var/www/glow>
        Options -Indexes
        AllowOverride All
        Require all granted
    </Directory>

    Header set Service-Worker-Allowed "/"
    Header set Cache-Control "no-cache"
</VirtualHost>
```

### Opción 3 – Node.js (serve estático)

```bash
npm install -g serve
serve /var/www/glow -l 3000
```

---

## 📱 Instalar en el móvil

### Android (Chrome)
1. Abre `https://glow.tudominio.com` en Chrome
2. Espera que aparezca el banner "Agregar a pantalla de inicio"
   — o toca los tres puntos → **"Agregar a pantalla de inicio"**
3. Toca **Instalar** ✅

### iPhone (Safari)
1. Abre la URL en **Safari** (no Chrome ni otro navegador)
2. Toca el botón compartir ⬆️
3. Selecciona **"Agregar a pantalla de inicio"**
4. Toca **Agregar** ✅

---

## 🔔 Notificaciones

Las notificaciones push funcionan automáticamente:
- La primera vez que abras la app te pedirá permiso
- Cada cuidado se notifica a la hora configurada
- Funcionan aunque la app esté cerrada (Android)
- En iPhone, las notificaciones funcionan a partir de iOS 16.4+

---

## 💾 Datos

Todos los datos se guardan en **localStorage** del navegador (sin cuenta, sin servidor de base de datos). Si cambias de navegador o borras los datos del navegador, perderás la información.

Para respaldo, puedes exportar manualmente el valor de `glow-state` desde las DevTools del navegador.
