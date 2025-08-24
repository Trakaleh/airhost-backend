# 🏠 AirHost AI - Sistema de Automatización para Airbnb

Sistema completo de automatización para propiedades de alquiler vacacional con gestión inteligente de huéspedes, smart locks y channel manager.

## 🚀 Características Principales

- **Gestión de Propiedades**: Administra múltiples propiedades desde un panel centralizado
- **Channel Manager**: Sincronización automática con Airbnb, Booking.com y VRBO
- **Smart Lock Integration**: Compatible con Nuki, August y Yale
- **Mensajería Automatizada**: Templates personalizables en múltiples idiomas
- **Gestión de Fianzas**: Integración con Stripe para preautorizaciones
- **Analytics**: Dashboard con métricas de ocupación y ingresos
- **API REST**: Backend completo con autenticación JWT

## 🛠️ Tecnologías

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- Stripe API
- JWT Authentication
- Nodemailer + Twilio
- Helmet + CORS

**Frontend:**
- HTML5 + CSS3 + JavaScript
- Bootstrap 5
- Responsive Design

## 📦 Instalación Local

1. Clona el repositorio:
```bash
git clone https://github.com/tu-usuario/airhost-ai.git
cd airhost-ai
```

2. Instala las dependencias:
```bash
cd backend
npm install
```

3. Configura las variables de entorno:
```bash
cp .env.example .env
# Edita .env con tus credenciales
```

4. Inicia el servidor:
```bash
npm start
```

## 🌐 Deploy en Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template)

### Variables de Entorno Requeridas:

- `MONGODB_URI`: URL de conexión a MongoDB Atlas
- `JWT_SECRET`: Secreto para tokens JWT
- `STRIPE_SECRET_KEY`: Clave secreta de Stripe
- `SMTP_USER`: Email para notificaciones
- `SMTP_PASS`: Contraseña del email

## 📖 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Perfil del usuario

### Propiedades  
- `GET /api/properties` - Listar propiedades
- `POST /api/properties` - Crear propiedad
- `PUT /api/properties/:id` - Actualizar propiedad

### Reservas
- `GET /api/reservations` - Listar reservas
- `POST /api/reservations` - Crear reserva manual

### Analytics
- `GET /api/analytics/dashboard` - Estadísticas generales

## 🔒 Seguridad

- Autenticación JWT
- Validación de datos con Mongoose
- Rate limiting
- Helmet para headers de seguridad
- Encriptación de contraseñas con bcrypt

## 📞 Soporte

Para soporte técnico o consultas comerciales:
- Email: soporte@airhostai.com
- Web: https://airhostai.com

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para más detalles.