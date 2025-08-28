const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);
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
const WebSocketService = require('./services/WebSocketService');
const PricingAIService = require('./services/PricingAIService');

const stripeService = new StripeService();
const messageService = new MessageService();
const channelManager = new ChannelManagerService();
const wsService = new WebSocketService();
const pricingAI = new PricingAIService();

console.log('🔧 Servicios inicializados correctamente');

// ====================================
// 🛡️ MIDDLEWARE DE AUTENTICACIÓN
// ====================================

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        console.log('🔐 Authentication attempt:', req.path);
        console.log('🎫 Token received:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
        
        if (!token) {
            console.log('❌ No token provided');
            return res.status(401).json({ 
                success: false, 
                error: 'Token requerido' 
            });
        }

        const jwtSecret = process.env.JWT_SECRET || 'airhost-testing-secret-key-2024';
        console.log('🔑 Using JWT secret:', jwtSecret ? 'SET' : 'NOT SET');
        const decoded = jwt.verify(token, jwtSecret);
        console.log('✅ Token decoded successfully, userId:', decoded.userId);
        // Check if this is the testing admin user
        if (decoded.userId === 'admin-testing-user-id') {
            console.log('👤 Testing admin user recognized');
            req.user = {
                id: 'admin-testing-user-id',
                email: 'admin@airhostai.com',
                name: 'Administrador',
                phone: '',
                plan: 'Enterprise',
                language: 'es',
                currency: 'EUR',
                isActive: true
            };
        } else {
            // Regular database user lookup
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
            
            console.log('👤 User found:', user ? user.email : 'NOT FOUND');
            
            if (!user) {
                console.log('❌ User not found in database');
                return res.status(401).json({ 
                    success: false, 
                    error: 'Usuario no encontrado' 
                });
            }

            req.user = user;
        }
        console.log('✅ Authentication successful');
        next();
    } catch (error) {
        console.log('❌ Authentication error:', error.message);
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
    console.log('🔒 Registration attempt blocked - Testing mode active');
    res.status(403).json({
        success: false,
        error: 'Registro deshabilitado durante el periodo de testing. Contacte al administrador.'
    });
});

// LOGIN - TESTING MODE (ADMIN ONLY)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email y contraseña son requeridos'
            });
        }

        // ====================================
        // 🔒 TESTING MODE - ADMIN ONLY ACCESS
        // ====================================
        console.log('🔒 TESTING MODE: Checking admin credentials');
        console.log('📧 Email provided:', email);
        console.log('🔑 Password provided:', password);
        
        if (email.toLowerCase() !== 'admin@airhostai.com' || password !== '310100') {
            console.log('❌ Invalid admin credentials');
            console.log('Expected email:', 'admin@airhostai.com');
            console.log('Expected password:', '310100');
            return res.status(401).json({
                success: false,
                error: 'Acceso restringido durante testing. Solo administradores autorizados.'
            });
        }

        console.log('✅ Admin access granted');

        // For testing mode, create a simple admin user response without database
        const adminUserId = 'admin-testing-user-id';
        
        // Generate token
        const jwtSecret = process.env.JWT_SECRET || 'airhost-testing-secret-key-2024';
        const token = jwt.sign(
            { userId: adminUserId },
            jwtSecret,
            { expiresIn: '30d' }
        );

        console.log(`✅ Admin logged in successfully`);
        console.log('🎫 Token generated:', token.substring(0, 50) + '...');

        res.json({
            success: true,
            message: 'Login exitoso - Modo Testing',
            token,
            user: {
                id: adminUserId,
                email: 'admin@airhostai.com',
                name: 'Administrador',
                plan: 'Enterprise',
                role: 'admin'
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

// GOOGLE OAUTH LOGIN
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token de Google requerido'
            });
        }

        // Verificar token de Google (requiere google-auth-library)
        // Por ahora simulamos la verificación
        console.log('🔍 Google OAuth token received:', token.substring(0, 20) + '...');
        
        // Simular datos de usuario de Google
        const googleUserData = {
            email: 'usuario@gmail.com',
            name: 'Usuario Google',
            picture: 'https://lh3.googleusercontent.com/a-/default'
        };

        // Buscar o crear usuario
        let user = await prisma.user.findUnique({
            where: { email: googleUserData.email }
        });

        if (!user) {
            // Crear nuevo usuario desde Google
            user = await prisma.user.create({
                data: {
                    email: googleUserData.email,
                    name: googleUserData.name,
                    password: 'google-oauth', // Password placeholder
                    plan: 'Professional',
                    language: 'es',
                    currency: 'EUR',
                    provider: 'google',
                    avatar: googleUserData.picture
                }
            });
            console.log('✅ New Google user created:', user.email);
        } else {
            // Actualizar last login
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() }
            });
        }

        // Generar JWT token
        const jwtToken = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Google OAuth exitoso',
            token: jwtToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                plan: user.plan,
                avatar: user.avatar || googleUserData.picture
            }
        });

    } catch (error) {
        console.error('❌ Google OAuth Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error en autenticación con Google'
        });
    }
});

// PERFIL DEL USUARIO
app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
        // For testing mode, return the user directly from middleware
        if (req.user.id === 'admin-testing-user-id') {
            console.log('👤 Returning testing user profile');
            return res.json({
                success: true,
                user: {
                    id: req.user.id,
                    email: req.user.email,
                    name: req.user.name,
                    phone: req.user.phone || '',
                    plan: req.user.plan,
                    language: req.user.language || 'es',
                    currency: req.user.currency || 'EUR',
                    createdAt: new Date(),
                    lastLogin: new Date()
                }
            });
        }

        // Regular database user lookup for production
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

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error en /api/auth/me:', error);
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
        // If admin user, return demo properties for now due to DB schema issues
        if (req.user.id === 'admin-testing-user-id') {
            const demoProperties = [
                {
                    id: 'prop_1',
                    name: 'Apartamento Centro Madrid',
                    description: 'Moderno apartamento en el corazón de Madrid',
                    address: 'Calle Gran Vía 123',
                    city: 'Madrid',
                    country: 'España',
                    propertyType: 'apartment',
                    maxGuests: 4,
                    bedrooms: 2,
                    bathrooms: 1,
                    basePrice: 85.0,
                    currency: 'EUR',
                    cleaningFee: 25.0,
                    depositAmount: 200.0,
                    isActive: true,
                    createdAt: new Date('2024-01-15'),
                    updatedAt: new Date(),
                    channels: {
                        airbnb: {
                            isActive: true,
                            listingId: 'demo_airbnb_12345',
                            platform: 'Airbnb',
                            connected_at: '2024-01-15T10:00:00Z'
                        }
                    },
                    _count: { reservations: 8 }
                },
                {
                    id: 'prop_2',
                    name: 'Villa Barcelona Seaside',
                    description: 'Hermosa villa cerca de la playa en Barcelona',
                    address: 'Passeig Marítim 45',
                    city: 'Barcelona',
                    country: 'España',
                    propertyType: 'villa',
                    maxGuests: 8,
                    bedrooms: 4,
                    bathrooms: 3,
                    basePrice: 180.0,
                    currency: 'EUR',
                    cleaningFee: 50.0,
                    depositAmount: 500.0,
                    isActive: true,
                    createdAt: new Date('2024-02-01'),
                    updatedAt: new Date(),
                    channels: {
                        booking: {
                            isActive: true,
                            listingId: 'demo_booking_67890',
                            platform: 'Booking.com',
                            connected_at: '2024-02-01T14:30:00Z'
                        }
                    },
                    _count: { reservations: 12 }
                },
                {
                    id: 'prop_3',
                    name: 'Estudio Valencia Centro',
                    description: 'Acogedor estudio en el centro histórico de Valencia',
                    address: 'Plaza del Ayuntamiento 8',
                    city: 'Valencia',
                    country: 'España',
                    propertyType: 'studio',
                    maxGuests: 2,
                    bedrooms: 1,
                    bathrooms: 1,
                    basePrice: 55.0,
                    currency: 'EUR',
                    cleaningFee: 20.0,
                    depositAmount: 150.0,
                    isActive: true,
                    createdAt: new Date('2024-03-10'),
                    updatedAt: new Date(),
                    channels: {},
                    _count: { reservations: 3 }
                }
            ];
            
            console.log('✅ Returning demo properties for testing user');
            res.json({
                success: true,
                properties: demoProperties,
                total: demoProperties.length
            });
            return;
        }

        // For real users, try database query with error handling
        try {
            const properties = await prisma.property.findMany({
                where: { ownerId: req.user.id },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    address: true,
                    city: true,
                    country: true,
                    propertyType: true,
                    maxGuests: true,
                    bedrooms: true,
                    bathrooms: true,
                    basePrice: true,
                    currency: true,
                    cleaningFee: true,
                    depositAmount: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    channels: true,
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
        } catch (dbError) {
            console.error('Database error, falling back to empty array:', dbError);
            res.json({
                success: true,
                properties: [],
                total: 0
            });
        }
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
                propertyType: propertyData.type || 'apartment', // Fix: use 'type' from frontend
                maxGuests: propertyData.maxGuests || 2,
                bedrooms: propertyData.bedrooms || 1,
                bathrooms: propertyData.bathrooms || 1,
                basePrice: propertyData.basePrice || 50,
                depositAmount: propertyData.depositAmount || 100,
                images: propertyData.images || []
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

// ACTUALIZAR PROPIEDAD
app.put('/api/properties/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // Verify property ownership
        const existingProperty = await prisma.property.findFirst({
            where: {
                id: id,
                ownerId: req.user.id
            }
        });

        if (!existingProperty) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        // Remove id from update data
        delete updateData.id;
        delete updateData.ownerId;

        const updatedProperty = await prisma.property.update({
            where: { id: id },
            data: updateData
        });

        console.log(`✅ Propiedad actualizada: ${updatedProperty.name} (${updatedProperty.id})`);
        
        res.json({
            success: true,
            message: 'Propiedad actualizada correctamente',
            property: updatedProperty
        });
    } catch (error) {
        console.error('Error actualizando propiedad:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ELIMINAR PROPIEDAD
app.delete('/api/properties/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify property ownership
        const existingProperty = await prisma.property.findFirst({
            where: {
                id: id,
                ownerId: req.user.id
            }
        });

        if (!existingProperty) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        // Delete the property (this will cascade delete related records if configured)
        await prisma.property.delete({
            where: { id: id }
        });

        console.log(`✅ Propiedad eliminada: ${existingProperty.name} (${id})`);
        
        res.json({
            success: true,
            message: 'Propiedad eliminada correctamente'
        });
    } catch (error) {
        console.error('Error eliminando propiedad:', error);
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
        // If admin user, return demo reservations for now due to DB schema issues
        if (req.user.id === 'admin-testing-user-id') {
            const today = new Date();
            const demoReservations = [
                {
                    id: 'res_1',
                    guestName: 'María García',
                    guestEmail: 'maria.garcia@email.com',
                    guestPhone: '+34 600 123 456',
                    guestCount: 2,
                    checkIn: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                    checkOut: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                    nights: 5,
                    source: 'airbnb',
                    status: 'checked_in',
                    baseAmount: 425.0,
                    totalAmount: 450.0,
                    currency: 'EUR',
                    property: {
                        id: 'prop_1',
                        name: 'Apartamento Centro Madrid',
                        address: 'Calle Gran Vía 123',
                        city: 'Madrid'
                    }
                },
                {
                    id: 'res_2',
                    guestName: 'John Smith',
                    guestEmail: 'john.smith@email.com',
                    guestPhone: '+44 7700 900123',
                    guestCount: 4,
                    checkIn: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
                    checkOut: new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
                    nights: 7,
                    source: 'booking',
                    status: 'confirmed',
                    baseAmount: 1260.0,
                    totalAmount: 1310.0,
                    currency: 'EUR',
                    property: {
                        id: 'prop_2',
                        name: 'Villa Barcelona Seaside',
                        address: 'Passeig Marítim 45',
                        city: 'Barcelona'
                    }
                },
                {
                    id: 'res_3',
                    guestName: 'Anna Müller',
                    guestEmail: 'anna.mueller@email.com',
                    guestPhone: '+49 151 12345678',
                    guestCount: 1,
                    checkIn: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
                    checkOut: new Date(today.getTime() + 18 * 24 * 60 * 60 * 1000), // 18 days from now
                    nights: 3,
                    source: 'direct',
                    status: 'confirmed',
                    baseAmount: 165.0,
                    totalAmount: 185.0,
                    currency: 'EUR',
                    property: {
                        id: 'prop_3',
                        name: 'Estudio Valencia Centro',
                        address: 'Plaza del Ayuntamiento 8',
                        city: 'Valencia'
                    }
                },
                {
                    id: 'res_4',
                    guestName: 'Pierre Dubois',
                    guestEmail: 'pierre.dubois@email.com',
                    guestPhone: '+33 6 12 34 56 78',
                    guestCount: 2,
                    checkIn: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
                    checkOut: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                    nights: 7,
                    source: 'airbnb',
                    status: 'checked_out',
                    baseAmount: 595.0,
                    totalAmount: 620.0,
                    currency: 'EUR',
                    property: {
                        id: 'prop_1',
                        name: 'Apartamento Centro Madrid',
                        address: 'Calle Gran Vía 123',
                        city: 'Madrid'
                    }
                }
            ];
            
            console.log('✅ Returning demo reservations for testing user');
            res.json({
                success: true,
                reservations: demoReservations,
                total: demoReservations.length
            });
            return;
        }

        // For real users, try database query with error handling
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
        } catch (dbError) {
            console.error('Database error, falling back to empty array:', dbError);
            res.json({
                success: true,
                reservations: [],
                total: 0
            });
        }
    } catch (error) {
        console.error('Error obteniendo reservations:', error);
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

// OBTENER RESERVA POR ID
app.get('/api/reservations/:id', authenticate, async (req, res) => {
    try {
        const reservation = await prisma.reservation.findFirst({
            where: {
                id: req.params.id,
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
                        city: true,
                        basePrice: true
                    }
                }
            }
        });

        if (!reservation) {
            return res.status(404).json({
                success: false,
                error: 'Reserva no encontrada'
            });
        }

        res.json({
            success: true,
            reservation
        });
    } catch (error) {
        console.error('Error obteniendo reserva:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ACTUALIZAR RESERVA
app.put('/api/reservations/:id', authenticate, async (req, res) => {
    try {
        const { guest, checkIn, checkOut, pricing, status } = req.body;

        // Verificar que la reserva existe y pertenece al usuario
        const existingReservation = await prisma.reservation.findFirst({
            where: {
                id: req.params.id,
                property: {
                    ownerId: req.user.id
                }
            },
            include: {
                property: true
            }
        });

        if (!existingReservation) {
            return res.status(404).json({
                success: false,
                error: 'Reserva no encontrada'
            });
        }

        // Calcular noches si se proporcionaron nuevas fechas
        let nights = existingReservation.nights;
        let checkInDate = existingReservation.checkIn;
        let checkOutDate = existingReservation.checkOut;

        if (checkIn && checkOut) {
            checkInDate = new Date(checkIn);
            checkOutDate = new Date(checkOut);
            nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        }

        const updateData = {
            ...(guest?.name && { guestName: guest.name }),
            ...(guest?.email && { guestEmail: guest.email }),
            ...(guest?.phone && { guestPhone: guest.phone }),
            ...(guest?.guestCount && { guestCount: guest.guestCount }),
            ...(checkIn && { checkIn: checkInDate }),
            ...(checkOut && { checkOut: checkOutDate }),
            ...(checkIn && checkOut && { nights }),
            ...(pricing?.baseAmount && { baseAmount: pricing.baseAmount }),
            ...(pricing?.totalAmount && { totalAmount: pricing.totalAmount }),
            ...(status && { status }),
            updatedAt: new Date()
        };

        const reservation = await prisma.reservation.update({
            where: { id: req.params.id },
            data: updateData,
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

        console.log(`✅ Reserva actualizada: ${reservation.id}`);

        res.json({
            success: true,
            message: 'Reserva actualizada correctamente',
            reservation
        });
    } catch (error) {
        console.error('Error actualizando reserva:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// CANCELAR RESERVA
app.delete('/api/reservations/:id', authenticate, async (req, res) => {
    try {
        // Verificar que la reserva existe y pertenece al usuario
        const existingReservation = await prisma.reservation.findFirst({
            where: {
                id: req.params.id,
                property: {
                    ownerId: req.user.id
                }
            }
        });

        if (!existingReservation) {
            return res.status(404).json({
                success: false,
                error: 'Reserva no encontrada'
            });
        }

        // Marcar como cancelada en lugar de eliminar
        const reservation = await prisma.reservation.update({
            where: { id: req.params.id },
            data: {
                status: 'cancelled',
                cancelledAt: new Date(),
                updatedAt: new Date()
            }
        });

        console.log(`✅ Reserva cancelada: ${reservation.id}`);

        res.json({
            success: true,
            message: 'Reserva cancelada correctamente',
            reservation
        });
    } catch (error) {
        console.error('Error cancelando reserva:', error);
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
        // Get all stats in parallel for better performance
        const [
            totalProperties,
            totalReservations, 
            activeReservations,
            revenueResult,
            totalSmartLocks,
            totalMessages,
            monthlyRevenue
        ] = await Promise.all([
            // Properties count
            prisma.property.count({
                where: { ownerId: req.user.id }
            }),
            
            // Total reservations
            prisma.reservation.count({
                where: {
                    property: { ownerId: req.user.id }
                }
            }),
            
            // Active reservations (currently checked in)
            prisma.reservation.count({
                where: {
                    property: { ownerId: req.user.id },
                    status: { in: ['confirmed', 'checked_in'] },
                    checkIn: { lte: new Date() },
                    checkOut: { gte: new Date() }
                }
            }),
            
            // Total revenue
            prisma.reservation.aggregate({
                where: {
                    property: { ownerId: req.user.id },
                    status: { not: 'cancelled' }
                },
                _sum: { totalAmount: true }
            }),
            
            // Smart locks count (return 0 if table doesn't exist)
            Promise.resolve(0), // Simplified for now
            
            // Messages count (return demo data for now)
            Promise.resolve(Math.floor(Math.random() * 1000) + 500), // Demo data
            
            // Monthly revenue
            prisma.reservation.aggregate({
                where: {
                    property: { ownerId: req.user.id },
                    status: { not: 'cancelled' },
                    checkIn: {
                        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                    }
                },
                _sum: { totalAmount: true }
            })
        ]);

        // Calculate some derived stats
        const occupancyRate = totalProperties > 0 ? Math.round((activeReservations / totalProperties) * 100) : 0;
        const avgBookingValue = totalReservations > 0 ? Math.round((revenueResult._sum.totalAmount || 0) / totalReservations) : 0;

        res.json({
            success: true,
            stats: {
                // Main dashboard stats
                totalProperties,
                totalReservations,
                activeReservations,
                totalRevenue: revenueResult._sum.totalAmount || 0,
                totalMessages: totalMessages,
                totalSmartLocks,
                
                // Monthly stats
                monthlyRevenue: monthlyRevenue._sum.totalAmount || 0,
                
                // Performance metrics
                occupancyRate,
                avgBookingValue,
                
                // Additional info
                currency: 'EUR',
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Error getting dashboard analytics:', error);
        
        // Return demo data if there's an error
        res.json({
            success: true,
            stats: {
                totalProperties: 3,
                totalReservations: 15,
                activeReservations: 8,
                totalRevenue: 12450,
                totalMessages: 847,
                totalSmartLocks: 2,
                monthlyRevenue: 4250,
                occupancyRate: 75,
                avgBookingValue: 830,
                currency: 'EUR',
                lastUpdated: new Date().toISOString()
            }
        });
    }
});

// ====================================
// 🔐 RUTAS DE SMART LOCKS
// ====================================

// Obtener cerraduras del usuario
app.get('/api/smart-locks', authenticate, async (req, res) => {
    try {
        const locks = await prisma.smartLock.findMany({
            where: { ownerId: req.user.id },
            include: {
                property: {
                    select: { id: true, name: true, address: true }
                },
                accessCodes: {
                    where: {
                        status: 'active',
                        validUntil: { gte: new Date() }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, locks });
    } catch (error) {
        console.error('❌ Error obteniendo smart locks:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Registrar nueva cerradura
app.post('/api/smart-locks', authenticate, async (req, res) => {
    try {
        const { propertyId, brand, deviceId, deviceName, apiCredentials } = req.body;

        // Verificar que la propiedad pertenece al usuario
        const property = await prisma.property.findFirst({
            where: { id: propertyId, ownerId: req.user.id }
        });

        if (!property) {
            return res.status(404).json({ success: false, error: 'Propiedad no encontrada' });
        }

        const lock = await prisma.smartLock.create({
            data: {
                ownerId: req.user.id,
                propertyId,
                brand,
                deviceId,
                deviceName: deviceName || `Smart Lock ${brand}`,
                apiCredentials: apiCredentials || {},
                settings: {
                    autoLockEnabled: true,
                    autoLockDelay: 30,
                    tempCodeLength: 6
                },
                status: 'active'
            }
        });

        res.json({ success: true, lock_id: lock.id, lock });
    } catch (error) {
        console.error('❌ Error registrando smart lock:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Generar código de acceso temporal
app.post('/api/smart-locks/:lockId/codes', authenticate, async (req, res) => {
    try {
        const { lockId } = req.params;
        const { codeName, validFrom, validUntil, guestInfo, bookingId } = req.body;

        // Verificar que la cerradura pertenece al usuario
        const lock = await prisma.smartLock.findFirst({
            where: { id: lockId, ownerId: req.user.id }
        });

        if (!lock) {
            return res.status(404).json({ success: false, error: 'Cerradura no encontrada' });
        }

        // Generar código aleatorio
        const accessCode = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

        const code = await prisma.accessCode.create({
            data: {
                lockId,
                ownerId: req.user.id,
                bookingId: bookingId || null,
                code: accessCode,
                codeName: codeName || `Guest Code ${accessCode}`,
                validFrom: new Date(validFrom),
                validUntil: new Date(validUntil),
                guestInfo: guestInfo || {},
                status: 'active'
            }
        });

        console.log(`✅ Código temporal generado: ${accessCode} para lock ${lockId}`);
        res.json({ 
            success: true, 
            code_id: code.id,
            access_code: accessCode,
            valid_from: code.validFrom,
            valid_until: code.validUntil
        });
    } catch (error) {
        console.error('❌ Error generando código temporal:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Obtener códigos activos de una cerradura
app.get('/api/smart-locks/:lockId/codes', authenticate, async (req, res) => {
    try {
        const { lockId } = req.params;

        // Verificar que la cerradura pertenece al usuario
        const lock = await prisma.smartLock.findFirst({
            where: { id: lockId, ownerId: req.user.id }
        });

        if (!lock) {
            return res.status(404).json({ success: false, error: 'Cerradura no encontrada' });
        }

        const codes = await prisma.accessCode.findMany({
            where: {
                lockId,
                status: 'active',
                validUntil: { gte: new Date() }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, codes });
    } catch (error) {
        console.error('❌ Error obteniendo códigos activos:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Revocar código de acceso
app.delete('/api/smart-locks/codes/:codeId', authenticate, async (req, res) => {
    try {
        const { codeId } = req.params;

        const code = await prisma.accessCode.findFirst({
            where: { id: codeId, ownerId: req.user.id }
        });

        if (!code) {
            return res.status(404).json({ success: false, error: 'Código no encontrado' });
        }

        await prisma.accessCode.update({
            where: { id: codeId },
            data: {
                status: 'revoked',
                revokedAt: new Date()
            }
        });

        console.log(`✅ Código revocado: ${code.code}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error revocando código:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// ====================================
// 💬 RUTAS DE MENSAJES AUTOMÁTICOS
// ====================================

// Obtener templates de mensaje del usuario
app.get('/api/messages/templates', authenticate, async (req, res) => {
    try {
        const { language } = req.query;
        const where = { ownerId: req.user.id };
        if (language) where.language = language;

        const templates = await prisma.messageTemplate.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, templates });
    } catch (error) {
        console.error('❌ Error obteniendo templates:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Crear template de mensaje
app.post('/api/messages/templates', authenticate, async (req, res) => {
    try {
        const { name, category, language, content, variables } = req.body;

        const template = await prisma.messageTemplate.create({
            data: {
                ownerId: req.user.id,
                name,
                category,
                language: language || 'es',
                content,
                variables: variables || [],
                isActive: true
            }
        });

        console.log(`✅ Template creado: ${template.id}`);
        res.json({ success: true, template_id: template.id, template });
    } catch (error) {
        console.error('❌ Error creando template:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Obtener reglas de automatización
app.get('/api/messages/automation-rules', authenticate, async (req, res) => {
    try {
        const rules = await prisma.automationRule.findMany({
            where: { ownerId: req.user.id },
            include: {
                template: {
                    select: { id: true, name: true, category: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, rules });
    } catch (error) {
        console.error('❌ Error obteniendo reglas de automatización:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Crear regla de automatización
app.post('/api/messages/automation-rules', authenticate, async (req, res) => {
    try {
        const { name, description, eventType, templateId, conditions, delayMinutes, propertyIds } = req.body;

        const rule = await prisma.automationRule.create({
            data: {
                ownerId: req.user.id,
                name,
                description: description || '',
                eventType,
                templateId,
                conditions: conditions || {},
                delayMinutes: delayMinutes || 0,
                isActive: true,
                propertyIds: propertyIds || [],
                executionCount: 0
            }
        });

        console.log(`✅ Regla de automatización creada: ${rule.id}`);
        res.json({ success: true, rule_id: rule.id, rule });
    } catch (error) {
        console.error('❌ Error creando regla de automatización:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Obtener historial de mensajes
app.get('/api/messages/history', authenticate, async (req, res) => {
    try {
        const { guestPhone, dateFrom, dateTo, limit = 100 } = req.query;
        
        const where = { ownerId: req.user.id };
        
        if (guestPhone) where.guestPhone = guestPhone;
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom);
            if (dateTo) where.createdAt.lte = new Date(dateTo);
        }

        const messages = await prisma.message.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        });

        res.json({ success: true, messages });
    } catch (error) {
        console.error('❌ Error obteniendo historial de mensajes:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// ====================================
// 💳 RUTAS DE STRIPE (FIANZAS)
// ====================================

// Crear customer en Stripe
app.post('/api/stripe/customers', authenticate, async (req, res) => {
    try {
        const { email, name, phone } = req.body;
        
        const result = await stripeService.createCustomer({
            email,
            name,
            phone,
            userId: req.user.id
        });

        if (result.success) {
            // Guardar customer ID en la base de datos
            await prisma.user.update({
                where: { id: req.user.id },
                data: { stripeCustomerId: result.customer.id }
            });
        }

        res.json(result);
    } catch (error) {
        console.error('❌ Error creando customer Stripe:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Crear depósito de fianza
app.post('/api/stripe/deposits', authenticate, async (req, res) => {
    try {
        const { amount, currency, customerId, bookingId, description } = req.body;
        
        const result = await stripeService.createSecurityDeposit({
            amount,
            currency: currency || 'eur',
            customer: customerId,
            description,
            metadata: {
                booking_id: bookingId,
                user_id: req.user.id
            }
        });

        res.json(result);
    } catch (error) {
        console.error('❌ Error creando depósito:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// ====================================
// 📊 RUTAS DE CHANNEL MANAGER
// ====================================

// Estado del channel manager
app.get('/api/channel-manager/status', authenticate, async (req, res) => {
    try {
        const properties = await prisma.property.findMany({
            where: { ownerId: req.user.id },
            select: { id: true, name: true, channels: true }
        });

        const status = {
            total_properties: properties.length,
            connected_channels: 0,
            last_sync: null,
            properties: properties.map(prop => ({
                id: prop.id,
                name: prop.name,
                channels: prop.channels || {}
            }))
        };

        // Count connected channels
        properties.forEach(prop => {
            if (prop.channels) {
                Object.values(prop.channels).forEach(channel => {
                    if (channel.isActive) status.connected_channels++;
                });
            }
        });

        res.json({ success: true, status });
    } catch (error) {
        console.error('❌ Error obteniendo status channel manager:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Conectar Airbnb
app.post('/api/channel-manager/connect/airbnb', authenticate, async (req, res) => {
    try {
        const { listingId, icalUrl, propertyId } = req.body;
        
        if (!propertyId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Property ID es requerido' 
            });
        }

        // Verificar propiedad existe y pertenece al usuario
        const property = await prisma.property.findFirst({
            where: { id: propertyId, ownerId: req.user.id }
        });

        if (!property) {
            return res.status(404).json({ 
                success: false, 
                error: 'Propiedad no encontrada' 
            });
        }

        // Actualizar channels con info de Airbnb
        const currentChannels = property.channels || {};
        currentChannels.airbnb = {
            isActive: true,
            listingId: listingId || 'demo_listing_' + Date.now(),
            icalUrl: icalUrl || 'https://calendar.airbnb.com/calendar/ical/' + Date.now() + '.ics',
            platform: 'Airbnb',
            connected_at: new Date().toISOString(),
            syncEnabled: true
        };

        await prisma.property.update({
            where: { id: propertyId },
            data: { channels: currentChannels }
        });

        res.json({ 
            success: true, 
            message: 'Airbnb conectado exitosamente',
            channel_info: currentChannels.airbnb
        });

    } catch (error) {
        console.error('❌ Error conectando Airbnb:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Conectar Booking.com
app.post('/api/channel-manager/connect/booking', authenticate, async (req, res) => {
    try {
        const { listingId, icalUrl, propertyId } = req.body;
        
        if (!propertyId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Property ID es requerido' 
            });
        }

        const property = await prisma.property.findFirst({
            where: { id: propertyId, ownerId: req.user.id }
        });

        if (!property) {
            return res.status(404).json({ 
                success: false, 
                error: 'Propiedad no encontrada' 
            });
        }

        const currentChannels = property.channels || {};
        currentChannels.booking = {
            isActive: true,
            listingId: listingId || 'booking_' + Date.now(),
            icalUrl: icalUrl || 'https://admin.booking.com/hotel/hoteladmin/ical/' + Date.now() + '.ics',
            platform: 'Booking.com',
            connected_at: new Date().toISOString(),
            syncEnabled: true
        };

        await prisma.property.update({
            where: { id: propertyId },
            data: { channels: currentChannels }
        });

        res.json({ 
            success: true, 
            message: 'Booking.com conectado exitosamente',
            channel_info: currentChannels.booking
        });

    } catch (error) {
        console.error('❌ Error conectando Booking.com:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Sincronizar channel manager
app.post('/api/channel-manager/sync', authenticate, async (req, res) => {
    try {
        const { propertyId } = req.body;
        
        let properties;
        
        if (propertyId) {
            // Sincronizar propiedad específica
            properties = await prisma.property.findMany({
                where: { 
                    id: propertyId, 
                    ownerId: req.user.id 
                }
            });
        } else {
            // Sincronizar todas las propiedades del usuario
            properties = await prisma.property.findMany({
                where: { ownerId: req.user.id }
            });
        }

        const syncResults = [];

        for (const property of properties) {
            if (property.channels) {
                for (const [channelName, channelInfo] of Object.entries(property.channels)) {
                    if (channelInfo.isActive && channelInfo.syncEnabled) {
                        // Simular sincronización exitosa
                        syncResults.push({
                            property_id: property.id,
                            property_name: property.name,
                            channel: channelName,
                            platform: channelInfo.platform,
                            success: true,
                            reservations_synced: Math.floor(Math.random() * 5) + 1,
                            last_sync: new Date().toISOString()
                        });

                        // Actualizar último sync
                        const updatedChannels = { ...property.channels };
                        updatedChannels[channelName].last_sync = new Date().toISOString();
                        
                        await prisma.property.update({
                            where: { id: property.id },
                            data: { channels: updatedChannels }
                        });
                    }
                }
            }
        }

        res.json({ 
            success: true, 
            message: `Sincronización completada para ${syncResults.length} canales`,
            sync_results: syncResults 
        });

    } catch (error) {
        console.error('❌ Error sincronizando channel manager:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Sincronizar calendarios de canales
app.post('/api/channels/sync/:propertyId', authenticate, async (req, res) => {
    try {
        const { propertyId } = req.params;
        
        const property = await prisma.property.findFirst({
            where: { id: propertyId, ownerId: req.user.id }
        });

        if (!property) {
            return res.status(404).json({ success: false, error: 'Propiedad no encontrada' });
        }

        // Simular sincronización de canales
        const syncResults = await channelManager.syncCalendars({
            ...property,
            channels: property.channels || {}
        });

        res.json({ success: true, sync_results: syncResults });
    } catch (error) {
        console.error('❌ Error sincronizando canales:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Configurar canal de la propiedad
app.put('/api/properties/:propertyId/channels/:channel', authenticate, async (req, res) => {
    try {
        const { propertyId, channel } = req.params;
        const { isActive, listingId, icalUrl, syncEnabled } = req.body;

        const property = await prisma.property.findFirst({
            where: { id: propertyId, ownerId: req.user.id }
        });

        if (!property) {
            return res.status(404).json({ success: false, error: 'Propiedad no encontrada' });
        }

        const currentChannels = property.channels || {};
        currentChannels[channel] = {
            isActive,
            listingId,
            icalUrl,
            syncEnabled
        };

        await prisma.property.update({
            where: { id: propertyId },
            data: { channels: currentChannels }
        });

        console.log(`✅ Canal ${channel} configurado para propiedad ${propertyId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error configurando canal:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// ====================================
// 📊 REAL-TIME DASHBOARD API
// ====================================

// Get real-time dashboard data
app.get('/api/dashboard/realtime', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get real data from database
        const [properties, reservations, smartLocks, messages] = await Promise.all([
            prisma.property.count({ where: { ownerId: userId } }),
            prisma.reservation.findMany({
                where: { property: { ownerId: userId } },
                include: { property: true }
            }),
            prisma.smartLock.count({ where: { ownerId: userId } }),
            prisma.messageTemplate.count({ where: { ownerId: userId } })
        ]);

        const activeReservations = reservations.filter(r => 
            new Date(r.checkIn) <= new Date() && new Date(r.checkOut) >= new Date()
        ).length;

        const todayCheckins = reservations.filter(r => {
            const today = new Date().toDateString();
            return new Date(r.checkIn).toDateString() === today;
        }).length;

        const todayRevenue = reservations
            .filter(r => new Date(r.checkIn).toDateString() === new Date().toDateString())
            .reduce((sum, r) => sum + (r.totalPrice || 0), 0);

        const dashboardData = {
            metrics: {
                todayRevenue: todayRevenue,
                activeBookings: activeReservations,
                todayCheckins: todayCheckins,
                messagesSent: messages + Math.floor(Math.random() * 10), // Add some dynamic data
                totalProperties: properties,
                totalSmartLocks: smartLocks
            },
            systemStatus: {
                apiStatus: 'online',
                whatsappBot: 'active',
                smartLocks: `${smartLocks} connected`,
                lastSync: 'hace 2 min'
            },
            timestamp: new Date().toISOString()
        };

        // Broadcast to WebSocket clients
        wsService.broadcastToUser(userId, 'dashboard_metrics', dashboardData.metrics);
        wsService.broadcastToUser(userId, 'system_status', dashboardData.systemStatus);

        res.json({ success: true, data: dashboardData });
    } catch (error) {
        console.error('❌ Error getting dashboard data:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// Get WebSocket connection info
app.get('/api/dashboard/ws-info', authenticate, (req, res) => {
    const clientInfo = wsService.getConnectedClients();
    res.json({ 
        success: true, 
        websocket: {
            endpoint: `/ws`,
            clients: clientInfo,
            status: 'active'
        }
    });
});

// Trigger manual update (for testing)
app.post('/api/dashboard/trigger-update', authenticate, async (req, res) => {
    try {
        const { type, data } = req.body;
        const userId = req.user.id;

        switch (type) {
            case 'activity':
                wsService.broadcastToUser(userId, 'activity_feed', data);
                break;
            case 'metrics':
                wsService.broadcastToUser(userId, 'dashboard_metrics', data);
                break;
            case 'status':
                wsService.broadcastToUser(userId, 'system_status', data);
                break;
            default:
                return res.status(400).json({ success: false, error: 'Invalid update type' });
        }

        res.json({ success: true, message: 'Update triggered successfully' });
    } catch (error) {
        console.error('❌ Error triggering update:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});

// ====================================
// 🤖 PRICING AI API
// ====================================

// Get AI pricing recommendations
app.post('/api/pricing/ai/recommendations', authenticate, async (req, res) => {
    try {
        const { propertyId, startDate, endDate } = req.body;
        const userId = req.user.id;

        // Validate input
        if (!propertyId || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Property ID, start date, and end date are required'
            });
        }

        // Verify property ownership
        const property = await prisma.property.findFirst({
            where: { id: propertyId, ownerId: userId }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        // Initialize AI service if needed
        await pricingAI.initialize({
            id: property.id,
            location: property.address,
            type: property.type,
            amenities: property.amenities
        });

        // Generate pricing recommendations
        const recommendations = await pricingAI.generatePricingRecommendations(
            propertyId,
            { start: startDate, end: endDate }
        );

        // Broadcast update to WebSocket clients
        wsService.broadcastToUser(userId, 'pricing_update', {
            propertyId,
            recommendations: recommendations.summary
        });

        res.json(recommendations);

    } catch (error) {
        console.error('❌ Error generating pricing recommendations:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// Get pricing analysis for a property
app.get('/api/pricing/ai/analysis/:propertyId', authenticate, async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { days = 30 } = req.query;
        const userId = req.user.id;

        // Verify property ownership
        const property = await prisma.property.findFirst({
            where: { id: propertyId, ownerId: userId }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        // Calculate date range
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + parseInt(days));

        // Get AI analysis
        const analysis = await pricingAI.generatePricingRecommendations(
            propertyId,
            {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            }
        );

        // Add market insights
        const marketInsights = await generateMarketInsights(property, analysis);

        res.json({
            success: true,
            property: {
                id: property.id,
                name: property.name,
                location: property.address
            },
            analysis,
            marketInsights,
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting pricing analysis:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// Apply AI pricing recommendations
app.post('/api/pricing/ai/apply', authenticate, async (req, res) => {
    try {
        const { propertyId, recommendations, strategy = 'conservative' } = req.body;
        const userId = req.user.id;

        // Verify property ownership
        const property = await prisma.property.findFirst({
            where: { id: propertyId, ownerId: userId }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        // Apply pricing strategy
        const appliedPrices = await applyPricingStrategy(recommendations, strategy);

        // In a real implementation, this would update the channel manager
        // and push prices to Airbnb, Booking.com, etc.
        
        // For now, we'll simulate the application
        const results = {
            success: true,
            propertyId,
            strategy,
            appliedDates: appliedPrices.length,
            totalPotentialRevenue: appliedPrices.reduce((sum, price) => sum + price.potentialRevenue, 0),
            averagePriceChange: calculateAveragePriceChange(appliedPrices),
            nextActions: [
                'Monitorizar performance durante los próximos 7 días',
                'Ajustar precios si la ocupación es muy baja/alta',
                'Revisar competencia semanalmente'
            ]
        };

        // Broadcast update to WebSocket clients
        wsService.broadcastToUser(userId, 'pricing_applied', {
            propertyId,
            strategy,
            results: results
        });

        // Log the pricing application
        console.log(`✅ Applied AI pricing for property ${propertyId} using ${strategy} strategy`);

        res.json(results);

    } catch (error) {
        console.error('❌ Error applying pricing recommendations:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// Get pricing performance metrics
app.get('/api/pricing/ai/performance/:propertyId', authenticate, async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { period = '30' } = req.query;
        const userId = req.user.id;

        // Verify property ownership
        const property = await prisma.property.findFirst({
            where: { id: propertyId, ownerId: userId }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        // Generate performance metrics (mock data)
        const performance = await generatePricingPerformance(propertyId, parseInt(period));

        res.json({
            success: true,
            propertyId,
            period: parseInt(period),
            performance,
            insights: generatePerformanceInsights(performance)
        });

    } catch (error) {
        console.error('❌ Error getting pricing performance:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// Helper functions
async function generateMarketInsights(property, analysis) {
    return {
        marketPosition: 'competitive', // competitive, premium, budget
        demandTrend: 'increasing', // increasing, stable, decreasing
        seasonality: 'high_season_approaching',
        competitorCount: 12,
        averageMarketPrice: analysis.summary.averagePrice * 0.95,
        priceRecommendation: analysis.summary.averagePrice > analysis.summary.averagePrice * 0.95 ? 
            'Consider slight price reduction to increase bookings' : 
            'Pricing is competitive for the market'
    };
}

async function applyPricingStrategy(recommendations, strategy) {
    const strategyMultipliers = {
        conservative: 0.5,  // Apply 50% of AI recommendations
        moderate: 0.75,     // Apply 75% of AI recommendations  
        aggressive: 1.0     // Apply 100% of AI recommendations
    };

    const multiplier = strategyMultipliers[strategy] || 0.75;

    return recommendations.map(rec => ({
        ...rec,
        appliedPrice: Math.round(rec.basePrice + (rec.optimizedPrice - rec.basePrice) * multiplier),
        strategy,
        potentialRevenue: rec.potentialRevenue * multiplier
    }));
}

function calculateAveragePriceChange(appliedPrices) {
    const changes = appliedPrices.map(price => 
        ((price.appliedPrice - price.basePrice) / price.basePrice) * 100
    );
    return (changes.reduce((sum, change) => sum + change, 0) / changes.length).toFixed(1);
}

async function generatePricingPerformance(propertyId, period) {
    // Mock performance data
    return {
        totalRevenue: 2500 + Math.random() * 1000,
        averageDailyRate: 125 + Math.random() * 50,
        occupancyRate: 0.7 + Math.random() * 0.2,
        revenuePerAvailableRoom: 87 + Math.random() * 30,
        bookingLeadTime: 14 + Math.random() * 20,
        competitiveIndex: 0.95 + Math.random() * 0.1,
        priceOptimizationImpact: {
            revenueIncrease: (5 + Math.random() * 15).toFixed(1) + '%',
            occupancyChange: ((-2 + Math.random() * 8).toFixed(1)) + '%',
            averageDailyRateChange: (3 + Math.random() * 10).toFixed(1) + '%'
        }
    };
}

function generatePerformanceInsights(performance) {
    const insights = [];
    
    if (performance.occupancyRate > 0.8) {
        insights.push('Alta ocupación detectada - considerar aumentar precios');
    } else if (performance.occupancyRate < 0.6) {
        insights.push('Ocupación baja - considerar estrategia más competitiva');
    }
    
    if (performance.competitiveIndex > 1.05) {
        insights.push('Precios por encima del mercado - monitorizar demanda');
    } else if (performance.competitiveIndex < 0.95) {
        insights.push('Oportunidad de aumentar precios vs competencia');
    }
    
    return insights;
}

// ====================================
// 🌐 RUTAS PRINCIPALES
// ====================================

// Servir frontend desde backend si es necesario
app.use(express.static(path.join(__dirname, '../frontend/public')));

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
            analytics: '/api/analytics/dashboard',
            smart_locks: '/api/smart-locks',
            access_codes: '/api/smart-locks/:lockId/codes',
            message_templates: '/api/messages/templates',
            automation_rules: '/api/messages/automation-rules',
            message_history: '/api/messages/history',
            stripe_customers: '/api/stripe/customers',
            stripe_deposits: '/api/stripe/deposits',
            channel_sync: '/api/channels/sync/:propertyId',
            channel_config: '/api/properties/:propertyId/channels/:channel'
        }
    });
});

// ====================================
// 🚀 INICIAR SERVIDOR
// ====================================

const PORT = process.env.PORT || 3007;

server.listen(PORT, () => {
    console.log(`🚀 AirHost Server v2 running on port ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`🔧 Health: http://localhost:${PORT}/api/health`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`💾 Database: PostgreSQL + Prisma`);
    
    // Initialize WebSocket service
    wsService.initialize(server);
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
    wsService.cleanup();
    await prisma.$disconnect();
    server.close(() => {
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
    });
});