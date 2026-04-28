# 🌸 Glow PWA –

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
