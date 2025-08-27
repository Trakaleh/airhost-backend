# 🚀 AirHost AI - Deployment Guide

Este proyecto incluye scripts automatizados para simplificar el proceso de deployment.

## 📋 Scripts de Deployment

### Windows (deploy.bat)
```cmd
deploy.bat "Your commit message here"
```

### Linux/Mac (deploy.sh)
```bash
./deploy.sh "Your commit message here"
```

## 🔄 Proceso Automatizado

Los scripts ejecutan automáticamente:

1. **📝 Git Add**: Agrega todos los cambios
2. **📦 Git Commit**: Hace commit con el mensaje proporcionado
3. **🚀 Git Push**: Sube cambios a GitHub (main branch)
4. **🚂 Railway Deploy**: Despliega a Railway automáticamente
5. **✅ Verificación**: Muestra URLs de verificación

## 🌐 URLs del Proyecto

- **Production API**: https://airhost-backend-production.up.railway.app
- **Health Check**: https://airhost-backend-production.up.railway.app/api/health
- **Frontend Local**: Conecta automáticamente a localhost:3007
- **GitHub Repo**: https://github.com/Trakaleh/airhost-backend

## 📝 Ejemplos de Uso

```cmd
# Arreglar un bug
deploy.bat "Fix user registration phone field validation"

# Nueva funcionalidad
deploy.bat "Add WhatsApp integration for automated messages"

# Actualización de dependencias
deploy.bat "Update Prisma and Node.js dependencies"
```

## ⚡ Desarrollo Local

Para desarrollo local, mantén el backend corriendo:

```bash
cd backend
node server.js
```

El backend local corre en: http://localhost:3007

## 🔧 Configuración Manual

Si necesitas hacer deployment manual:

```bash
# 1. Commit changes
git add .
git commit -m "Your message"

# 2. Push to GitHub
git push origin main

# 3. Deploy to Railway
railway up
```

## 📊 Verificación Post-Deployment

Después de cada deployment, verifica:

1. **Health Check**: https://airhost-backend-production.up.railway.app/api/health
2. **Registration Test**: Prueba crear una cuenta nueva
3. **Login Test**: Prueba el login
4. **Frontend Connection**: Verifica que el frontend conecte correctamente