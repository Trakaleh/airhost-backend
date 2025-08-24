# 🚂 Railway PostgreSQL Setup Guide

## 📋 Pasos para configurar Railway Database:

### 1. 🗄️ Crear PostgreSQL Database en Railway

1. Ve a tu **Railway Dashboard**: https://railway.app/dashboard
2. En tu proyecto AirHost, click **"+ Add Service"**
3. Selecciona **"Database"** → **"PostgreSQL"**
4. Espera a que se cree (2-3 minutos)
5. Una vez creado, ve a la pestaña **"Variables"** del database
6. Copia la **DATABASE_URL** (empieza con `postgresql://`)

### 2. ⚙️ Configurar Variables de Entorno

En tu **aplicación principal** (no el database), agrega estas variables:

```
DATABASE_URL=postgresql://[LA_URL_QUE_COPIASTE_DEL_DATABASE]
MONGODB_URI=[ELIMINAR ESTA VARIABLE - YA NO LA NECESITAS]
```

Mantén las demás variables (usa tus propias claves reales):
```
JWT_SECRET=tu_jwt_secret_super_seguro_aqui_cambialo_por_algo_unico_y_largo
STRIPE_SECRET_KEY=sk_test_[TU_CLAVE_STRIPE_AQUI]
STRIPE_PUBLISHABLE_KEY=pk_test_[TU_CLAVE_PUBLICA_AQUI]
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_app_password_de_16_caracteres
NODE_ENV=production
```

### 3. 🚀 Redeploy

Railway detectará automáticamente los cambios del código y redesplegará.
El nuevo build incluirá:
- ✅ Instalación de Prisma
- ✅ Generación del cliente
- ✅ Push del schema a PostgreSQL
- ✅ Servidor iniciado con Prisma

### 4. ✅ Verificación

Una vez deployado:
1. Accede a `https://tu-app.railway.app/api/health`
2. Deberías ver:
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected",
  "orm": "prisma",
  "version": "2.0.0"
}
```

### 5. 🎯 Administrar Database

Para ver los datos:
```bash
# Localmente (para desarrollo)
npx prisma studio

# O usa Railway Database GUI
# Ve a tu PostgreSQL service → Data tab
```

## ⚠️ ¡IMPORTANTE!

1. **Elimina MONGODB_URI** de Railway variables - ya no la necesitas
2. **La migración es automática** - Prisma creará las tablas
3. **Los datos existentes se perderán** - es una migración limpia
4. **Railway Database es privado** - solo tu app puede acceder

## 🔧 Comandos Útiles

```bash
# Ver datos (desarrollo local)
npx prisma studio

# Reset database (cuidado - borra todo)
npx prisma db push --force-reset

# Ver logs de Railway
railway logs
```

## 📊 Ventajas de esta migración:

- 🔒 **Seguridad máxima** - red privada
- ⚡ **Velocidad** - misma región que tu app
- 💰 **Costo predecible** - $5/mes por 1GB
- 🛠️ **Sin configuración** - funciona automáticamente
- 📈 **Escalabilidad** - crece con tu app