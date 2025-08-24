const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app = express();
const prisma = new PrismaClient();

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
// 🗄️ CONEXIÓN POSTGRESQL
// ====================================

const connectDB = async () => {
    try {
        // Debug: Log DATABASE_URL para diagnóstico
        console.log('🔍 DATABASE_URL:', process.env.DATABASE_URL ? 'configurada' : 'NO CONFIGURADA');
        console.log('🔍 DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);
        
        await prisma.$connect();
        console.log('✅ PostgreSQL conectado correctamente');
        console.log('🚀 Prisma Client inicializado');
    } catch (error) {
        console.error('❌ Error conectando a PostgreSQL:', error);
        console.error('🔍 DATABASE_URL debug:', process.env.DATABASE_URL?.substring(0, 50) + '...');
        setTimeout(connectDB, 5000);
    }
};

// Inicializar conexión
connectDB();

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
const bcrypt = require('bcryptjs');

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
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                plan: true,
                language: true,
                currency: true,
                isActive: true
            }
        });
        
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

app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        await prisma.$queryRaw`SELECT 1`;
        
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            environment: process.env.NODE_ENV,
            database: 'connected',
            orm: 'prisma',
            services: {
                stripe: !!process.env.STRIPE_SECRET_KEY,
                email: !!process.env.SMTP_USER,
                twilio: !!process.env.TWILIO_ACCOUNT_SID
            }
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: error.message
        });
    }
});

app.get('/api/info', (req, res) => {
    res.json({
        name: 'AirHost Assistant API v2',
        description: 'Sistema completo de automatización para Airbnb con PostgreSQL',
        version: '2.0.0',
        database: 'PostgreSQL + Prisma',
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
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Ya existe una cuenta con este email'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Crear nuevo usuario
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name,
                phone
            }
        });

        // Generar token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        console.log(`✅ Nuevo usuario registrado: ${email}`);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado correctamente',
            token,
            user: {
                id: user.id,
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
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas'
            });
        }

        // Verificar contraseña
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas'
            });
        }

        // Actualizar último login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

        // Generar token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        console.log(`✅ Usuario logueado: ${email}`);

        res.json({
            success: true,
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
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
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                plan: true,
                language: true,
                currency: true,
                createdAt: true,
                lastLogin: true
            }
        });

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
        const properties = await prisma.property.findMany({
            where: { ownerId: req.user.id },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { reservations: true }
                }
            }
        });

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
            ownerId: req.user.id
        };

        // Validaciones básicas
        if (!propertyData.name || !propertyData.address || !propertyData.city) {
            return res.status(400).json({
                success: false,
                error: 'Nombre, dirección y ciudad son requeridos'
            });
        }

        const property = await prisma.property.create({
            data: {
                ownerId: req.user.id,
                name: propertyData.name,
                description: propertyData.description || '',
                address: propertyData.address,
                city: propertyData.city,
                country: propertyData.country || 'España',
                postalCode: propertyData.postalCode,
                propertyType: propertyData.propertyType || 'apartment',
                maxGuests: propertyData.maxGuests || 2,
                bedrooms: propertyData.bedrooms || 1,
                bathrooms: propertyData.bathrooms || 1,
                basePrice: propertyData.basePrice || 50,
                depositAmount: propertyData.depositAmount || 100
            }
        });

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
        const property = await prisma.property.findFirst({
            where: {
                id: req.params.id,
                ownerId: req.user.id
            },
            include: {
                reservations: {
                    orderBy: { checkIn: 'desc' },
                    take: 10
                }
            }
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

// ====================================
// 📅 RUTAS DE RESERVAS
// ====================================

// LISTAR RESERVAS
app.get('/api/reservations', authenticate, async (req, res) => {
    try {
        const reservations = await prisma.reservation.findMany({
            where: {
                property: {
                    ownerId: req.user.id
                }
            },
            include: {
                property: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true
                    }
                }
            },
            orderBy: { checkIn: 'desc' },
            take: 50
        });

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
        const { propertyId, guest, checkIn, checkOut, pricing } = req.body;

        // Verificar que la propiedad pertenece al usuario
        const property = await prisma.property.findFirst({
            where: {
                id: propertyId,
                ownerId: req.user.id
            }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        // Calcular noches
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

        const reservation = await prisma.reservation.create({
            data: {
                propertyId,
                guestName: guest.name,
                guestEmail: guest.email,
                guestPhone: guest.phone,
                guestCount: guest.guestCount || 1,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                nights,
                source: 'manual',
                status: 'confirmed',
                baseAmount: pricing.baseAmount || property.basePrice * nights,
                totalAmount: pricing.totalAmount || property.basePrice * nights
            },
            include: {
                property: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true
                    }
                }
            }
        });

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
        const totalProperties = await prisma.property.count({
            where: { ownerId: req.user.id }
        });

        const totalReservations = await prisma.reservation.count({
            where: {
                property: {
                    ownerId: req.user.id
                }
            }
        });

        const activeReservations = await prisma.reservation.count({
            where: {
                property: {
                    ownerId: req.user.id
                },
                status: { in: ['confirmed', 'checked_in'] },
                checkIn: { lte: new Date() },
                checkOut: { gte: new Date() }
            }
        });

        const revenueResult = await prisma.reservation.aggregate({
            where: {
                property: {
                    ownerId: req.user.id
                },
                status: { not: 'cancelled' }
            },
            _sum: {
                totalAmount: true
            }
        });

        res.json({
            success: true,
            stats: {
                totalProperties,
                totalReservations,
                activeReservations,
                totalRevenue: revenueResult._sum.totalAmount || 0,
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
        message: '🏠 AirHost Assistant API v2',
        status: 'running',
        version: '2.0.0',
        database: 'PostgreSQL + Prisma',
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
    console.log(`🚀 AirHost Server v2 running on port ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`🔧 Health: http://localhost:${PORT}/api/health`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`💾 Database: PostgreSQL + Prisma`);
});

// Manejo de errores
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Cerrando servidor...');
    await prisma.$disconnect();
    process.exit(0);
});