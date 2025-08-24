const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();

// ====================================
// 🔧 MIDDLEWARES
// ====================================

app.use(helmet());
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://airhostai.com',
        'https://www.airhostai.com',
        /https:\/\/.*\.railway\.app$/,
        /https:\/\/.*\.netlify\.app$/,
        process.env.FRONTEND_URL
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ====================================
// 🗄️ CONEXIÓN MONGODB
// ====================================

// Conexión segura con retry logic
const connectDB = async (retries = 5) => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10, // Máximo 10 conexiones
            serverSelectionTimeoutMS: 5000, // Timeout de 5 segundos
            socketTimeoutMS: 45000, // Socket timeout
            family: 4 // Usar IPv4
        });
        
        console.log('✅ MongoDB conectado correctamente');
        console.log('📁 Base de datos:', mongoose.connection.name);
        console.log('🔒 IP Actual:', require('os').networkInterfaces());
        
    } catch (error) {
        console.error(`❌ Error conectando a MongoDB (${retries} reintentos restantes):`, error.message);
        
        if (retries > 0) {
            console.log('🔄 Reintentando conexión en 5 segundos...');
            setTimeout(() => connectDB(retries - 1), 5000);
        } else {
            console.error('💥 No se pudo conectar a MongoDB después de varios intentos');
            // No terminar el proceso, mantener la API funcionando
        }
    }
};

// Manejar desconexiones
mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB desconectado. Intentando reconectar...');
    connectDB();
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Error de MongoDB:', err);
});

// Iniciar conexión
connectDB();

// ====================================
// 📊 MODELOS
// ====================================

const User = require('./models/User');
const Property = require('./models/Property');
const Reservation = require('./models/Reservation');
const Incident = require('./models/Incident');

// ====================================
// 🔧 SERVICIOS
// ====================================

const StripeService = require('./services/StripeService');
const MessageService = require('./services/MessageService');
const ChannelManagerService = require('./services/ChannelManagerService');

const stripeService = new StripeService();
const messageService = new MessageService();
const channelManager = new ChannelManagerService();

console.log('🔧 Servicios inicializados correctamente');

// ====================================
// 🛡️ MIDDLEWARE DE AUTENTICACIÓN
// ====================================

const jwt = require('jsonwebtoken');

const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'Token requerido' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Usuario no encontrado' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            error: 'Token inválido' 
        });
    }
};

// ====================================
// 🏥 HEALTH CHECK
// ====================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        services: {
            stripe: !!process.env.STRIPE_SECRET_KEY,
            email: !!process.env.SMTP_USER,
            twilio: !!process.env.TWILIO_ACCOUNT_SID
        }
    });
});

app.get('/api/info', (req, res) => {
    res.json({
        name: 'AirHost Assistant API',
        description: 'Sistema completo de automatización para Airbnb',
        version: '1.0.0',
        features: [
            'Autenticación JWT',
            'Gestión de propiedades',
            'Sistema de reservas',
            'Channel Manager',
            'Smart Lock Integration',
            'Automated Messaging',
            'Payment Processing',
            'Analytics Dashboard'
        ]
    });
});

// ====================================
// 🔐 RUTAS DE AUTENTICACIÓN
// ====================================

const bcrypt = require('bcryptjs');

// REGISTRO
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone } = req.body;

        // Validaciones
        if (!email || !password || !name || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Todos los campos son requeridos'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'La contraseña debe tener al menos 6 caracteres'
            });
        }

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Ya existe una cuenta con este email'
            });
        }

        // Crear nuevo usuario
        const user = new User({
            email: email.toLowerCase(),
            password,
            name,
            phone
        });

        await user.save();

        // Generar token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        console.log(`✅ Nuevo usuario registrado: ${email}`);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado correctamente',
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                plan: user.plan
            }
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email y contraseña son requeridos'
            });
        }

        // Buscar usuario
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas'
            });
        }

        // Verificar contraseña
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas'
            });
        }

        // Generar token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Actualizar último login
        user.lastLogin = new Date();
        await user.save();

        console.log(`✅ Usuario logueado: ${email}`);

        res.json({
            success: true,
            message: 'Login exitoso',
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                plan: user.plan
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// PERFIL DEL USUARIO
app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ====================================
// 🏠 RUTAS DE PROPIEDADES
// ====================================

// LISTAR PROPIEDADES
app.get('/api/properties', authenticate, async (req, res) => {
    try {
        const properties = await Property.find({ owner: req.user._id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            properties,
            total: properties.length
        });
    } catch (error) {
        console.error('Error obteniendo propiedades:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// CREAR PROPIEDAD
app.post('/api/properties', authenticate, async (req, res) => {
    try {
        const propertyData = {
            ...req.body,
            owner: req.user._id
        };

        // Validaciones básicas
        if (!propertyData.name || !propertyData.address || !propertyData.city) {
            return res.status(400).json({
                success: false,
                error: 'Nombre, dirección y ciudad son requeridos'
            });
        }

        const property = new Property(propertyData);
        await property.save();

        console.log(`✅ Nueva propiedad creada: ${property.name}`);

        res.status(201).json({
            success: true,
            message: 'Propiedad creada correctamente',
            property
        });
    } catch (error) {
        console.error('Error creando propiedad:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// OBTENER PROPIEDAD POR ID
app.get('/api/properties/:id', authenticate, async (req, res) => {
    try {
        const property = await Property.findOne({
            _id: req.params.id,
            owner: req.user._id
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        res.json({
            success: true,
            property
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ACTUALIZAR PROPIEDAD
app.put('/api/properties/:id', authenticate, async (req, res) => {
    try {
        const property = await Property.findOneAndUpdate(
            { _id: req.params.id, owner: req.user._id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Propiedad actualizada correctamente',
            property
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ====================================
// 📅 RUTAS DE RESERVAS
// ====================================

// LISTAR RESERVAS
app.get('/api/reservations', authenticate, async (req, res) => {
    try {
        const properties = await Property.find({ owner: req.user._id }).select('_id');
        const propertyIds = properties.map(p => p._id);

        const reservations = await Reservation.find({
            property: { $in: propertyIds }
        })
        .populate('property', 'name address city')
        .sort({ check_in: -1 })
        .limit(50);

        res.json({
            success: true,
            reservations,
            total: reservations.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// CREAR RESERVA MANUAL
app.post('/api/reservations', authenticate, async (req, res) => {
    try {
        const { propertyId, guest, check_in, check_out, pricing } = req.body;

        // Verificar que la propiedad pertenece al usuario
        const property = await Property.findOne({
            _id: propertyId,
            owner: req.user._id
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        const reservation = new Reservation({
            property: propertyId,
            guest,
            check_in: new Date(check_in),
            check_out: new Date(check_out),
            pricing,
            source: 'manual',
            status: 'confirmed'
        });

        await reservation.save();
        await reservation.populate('property');

        console.log(`✅ Nueva reserva creada: ${guest.name}`);

        res.status(201).json({
            success: true,
            message: 'Reserva creada correctamente',
            reservation
        });
    } catch (error) {
        console.error('Error creando reserva:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ====================================
// 📊 RUTAS DE ANALYTICS
// ====================================

app.get('/api/analytics/dashboard', authenticate, async (req, res) => {
    try {
        const properties = await Property.find({ owner: req.user._id });
        const propertyIds = properties.map(p => p._id);

        const totalProperties = properties.length;

        const totalReservations = await Reservation.countDocuments({
            property: { $in: propertyIds }
        });

        const activeReservations = await Reservation.countDocuments({
            property: { $in: propertyIds },
            status: { $in: ['confirmed', 'checked_in'] },
            check_in: { $lte: new Date() },
            check_out: { $gte: new Date() }
        });

        const totalRevenue = await Reservation.aggregate([
            {
                $match: {
                    property: { $in: propertyIds },
                    status: { $ne: 'cancelled' }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$pricing.total_amount' }
                }
            }
        ]);

        res.json({
            success: true,
            stats: {
                totalProperties,
                totalReservations,
                activeReservations,
                totalRevenue: totalRevenue[0]?.total || 0,
                currency: 'EUR'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ====================================
// 🌐 RUTA PRINCIPAL
// ====================================

app.get('/', (req, res) => {
    res.json({
        message: '🏠 AirHost Assistant API',
        status: 'running',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            info: '/api/info',
            auth: '/api/auth/*',
            properties: '/api/properties',
            reservations: '/api/reservations',
            analytics: '/api/analytics/dashboard'
        }
    });
});

// ====================================
// 🚀 INICIAR SERVIDOR
// ====================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 AirHost Server running on port ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`🔧 Health: http://localhost:${PORT}/api/health`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`💾 Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
});

// Manejo de errores
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});