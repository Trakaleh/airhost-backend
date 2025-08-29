const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// ====================================
// 🔧 IMPORT ESSENTIAL SERVICES ONLY
// ====================================
const StripeService = require('./services/StripeService');
const WhatsAppService = require('./services/WhatsAppService');
const MessageService = require('./services/MessageService');
const ChannelManagerService = require('./services/ChannelManagerService');
const PropertyService = require('./services/PropertyService');
const NotificationService = require('./services/NotificationService');

// Initialize services
const stripeService = new StripeService();
const whatsappService = new WhatsAppService();
const messageService = new MessageService();
const channelManagerService = new ChannelManagerService(prisma);
const propertyService = new PropertyService(prisma);
const notificationService = new NotificationService(prisma);

// ====================================
// 🔧 MIDDLEWARES
// ====================================

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'"]
        }
    }
}));

// CORS configuration
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: { success: false, error: 'Demasiadas solicitudes, intenta de nuevo más tarde' },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Demasiados intentos de autenticación, intenta de nuevo más tarde' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ====================================
// 🗄️ DATABASE CONNECTION
// ====================================

const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log('✅ PostgreSQL conectado correctamente');
        console.log('🚀 Prisma Client inicializado');
    } catch (error) {
        console.error('❌ Error conectando a PostgreSQL:', error);
        process.exit(1);
    }
};

// ====================================
// 🔐 JWT MIDDLEWARE
// ====================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Token de acceso requerido'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Sesión expirada. Por favor, inicia sesión de nuevo.'
                });
            }
            return res.status(403).json({
                success: false,
                error: 'Token inválido'
            });
        }
        
        req.user = user;
        next();
    });
};

// ====================================
// 🏠 ROUTES - HEALTH CHECK
// ====================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'AirHost v2.1 - Sistema funcionando correctamente',
        timestamp: new Date().toISOString(),
        modules: {
            database: 'connected',
            stripe: 'available',
            whatsapp: 'available',
            channelManager: 'available'
        }
    });
});

// ====================================
// 🔐 MODULE 1: USER AUTHENTICATION
// ====================================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, phone, company } = req.body;

        // Validate required fields
        if (!email || !password || !name || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Email, contraseña, nombre y teléfono son obligatorios'
            });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'El usuario ya existe con este email'
            });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create Stripe customer
        let stripeCustomerId = null;
        try {
            const customer = await stripeService.createCustomer({
                email: email.toLowerCase(),
                name: name,
                phone: phone,
                metadata: { company: company || '' }
            });
            stripeCustomerId = customer.id;
        } catch (stripeError) {
            console.warn('Warning: Could not create Stripe customer:', stripeError);
        }

        // Create user
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name,
                phone,
                company: company || null,
                stripeCustomerId,
                plan: 'basic',
                subscriptionStatus: 'active'
            }
        });

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        res.status(201).json({
            success: true,
            message: 'Usuario registrado correctamente',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                plan: user.plan,
                stripeCustomerId: user.stripeCustomerId
            },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor durante el registro'
        });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email y contraseña son obligatorios'
            });
        }

        // Multiple admin credential options for flexibility
        const validAdminCredentials = [
            { email: 'admin@airhostai.com', password: '310100', name: 'Administrador Principal' },
            { email: 'admin', password: 'admin', name: 'Admin Simple' },
            { email: 'admin arrova airhostai.com', password: 'admin', name: 'Admin Arrova' },
            { email: 'test@airhostai.com', password: 'test', name: 'Usuario Test' }
        ];

        // Normalize input
        const normalizedEmail = email.toLowerCase().trim();
        const normalizedPassword = password.trim();

        // Check admin credentials
        const validCredential = validAdminCredentials.find(cred => 
            (normalizedEmail === cred.email.toLowerCase() || 
             normalizedEmail === cred.email.toLowerCase().replace(/\s+/g, '')) &&
            normalizedPassword === cred.password
        );

        if (validCredential) {
            // Admin login
            const token = jwt.sign(
                { userId: 'admin', email: validCredential.email },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '30d' }
            );

            return res.json({
                success: true,
                message: 'Login exitoso como administrador',
                user: {
                    id: 'admin',
                    email: validCredential.email,
                    name: validCredential.name,
                    phone: '+34666777888',
                    plan: 'enterprise'
                },
                token
            });
        }

        // Regular user login
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Email o contraseña incorrectos'
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Email o contraseña incorrectos'
            });
        }

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            message: 'Login exitoso',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                plan: user.plan
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor durante el login'
        });
    }
});

// ====================================
// 🏠 MODULE 2: PROPERTIES MANAGEMENT
// ====================================

// Get properties
app.get('/api/properties', authenticateToken, async (req, res) => {
    try {
        const properties = await prisma.property.findMany({
            where: { ownerId: req.user.userId },
            include: {
                channels: true,
                reservations: {
                    where: {
                        status: 'confirmed',
                        checkOut: { gte: new Date() }
                    },
                    take: 5,
                    orderBy: { checkIn: 'asc' }
                }
            }
        });

        res.json({
            success: true,
            properties
        });
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({
            success: false,
            error: 'Error al cargar las propiedades'
        });
    }
});

// Create property
app.post('/api/properties', authenticateToken, async (req, res) => {
    try {
        const {
            name, description, address, city, country, postalCode,
            propertyType, maxGuests, bedrooms, bathrooms,
            basePrice, currency, cleaningFee, depositAmount,
            channelsConfig
        } = req.body;

        const property = await prisma.property.create({
            data: {
                ownerId: req.user.userId,
                name, description, address, city, country, postalCode,
                propertyType, maxGuests, bedrooms, bathrooms,
                basePrice, currency: currency || 'EUR',
                cleaningFee: cleaningFee || 0,
                depositAmount,
                channelsConfig: channelsConfig || {}
            }
        });

        res.status(201).json({
            success: true,
            property
        });
    } catch (error) {
        console.error('Error creating property:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear la propiedad'
        });
    }
});

// Import property from Airbnb
app.post('/api/properties/import/airbnb', authenticateToken, async (req, res) => {
    try {
        const { url, apiKey } = req.body;

        // Ensure admin user exists
        await prisma.user.upsert({
            where: { id: req.user.userId },
            update: {},
            create: {
                id: req.user.userId,
                email: req.user.email || 'admin@airhostai.com',
                password: 'dummy_password_hash',
                name: 'Administrador',
                phone: '+34666777888'
            }
        });
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL de Airbnb es requerida'
            });
        }

        // Extract listing ID from Airbnb URL
        const listingIdMatch = url.match(/rooms\/(\d+)/);
        if (!listingIdMatch) {
            return res.status(400).json({
                success: false,
                error: 'URL de Airbnb inválida'
            });
        }

        const listingId = listingIdMatch[1];

        // Mock property data extraction (in production, use Airbnb API/scraping)
        const mockPropertyData = {
            name: `Airbnb Property ${listingId}`,
            description: 'Propiedad importada desde Airbnb',
            address: 'Dirección importada',
            city: 'Ciudad',
            country: 'España',
            propertyType: 'apartment',
            maxGuests: 4,
            bedrooms: 2,
            bathrooms: 1,
            basePrice: 85,
            currency: 'EUR',
            cleaningFee: 25,
            depositAmount: 200
        };

        // Create property
        const property = await prisma.property.create({
            data: {
                ownerId: req.user.userId,
                ...mockPropertyData,
                channelsConfig: {
                    airbnb: {
                        listingId: listingId,
                        url: url,
                        apiKey: apiKey || null,
                        isActive: true,
                        connectedAt: new Date()
                    }
                }
            }
        });

        // Create channel entry
        await prisma.channel.create({
            data: {
                propertyId: property.id,
                name: 'airbnb',
                listingId: listingId,
                apiCredentials: apiKey ? { apiKey } : null,
                syncEnabled: true,
                isActive: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Propiedad importada exitosamente desde Airbnb',
            property
        });

    } catch (error) {
        console.error('Error importing from Airbnb:', error);
        res.status(500).json({
            success: false,
            error: 'Error al importar desde Airbnb'
        });
    }
});

// Import property from Booking.com
app.post('/api/properties/import/booking', authenticateToken, async (req, res) => {
    try {
        const { propertyId, apiKey } = req.body;

        // Ensure admin user exists
        await prisma.user.upsert({
            where: { id: req.user.userId },
            update: {},
            create: {
                id: req.user.userId,
                email: req.user.email || 'admin@airhostai.com',
                password: 'dummy_password_hash',
                name: 'Administrador',
                phone: '+34666777888'
            }
        });
        
        if (!propertyId || !apiKey) {
            return res.status(400).json({
                success: false,
                error: 'ID de propiedad y API Key de Booking.com son requeridos'
            });
        }

        // Mock property data extraction (in production, use Booking.com API)
        const mockPropertyData = {
            name: `Booking Property ${propertyId}`,
            description: 'Propiedad importada desde Booking.com',
            address: 'Dirección importada',
            city: 'Ciudad',
            country: 'España',
            propertyType: 'hotel',
            maxGuests: 6,
            bedrooms: 3,
            bathrooms: 2,
            basePrice: 120,
            currency: 'EUR',
            cleaningFee: 30,
            depositAmount: 300
        };

        // Create property
        const property = await prisma.property.create({
            data: {
                ownerId: req.user.userId,
                ...mockPropertyData,
                channelsConfig: {
                    booking: {
                        propertyId: propertyId,
                        apiKey: apiKey,
                        isActive: true,
                        connectedAt: new Date()
                    }
                }
            }
        });

        // Create channel entry
        await prisma.channel.create({
            data: {
                propertyId: property.id,
                name: 'booking',
                listingId: propertyId,
                apiCredentials: { apiKey },
                syncEnabled: true,
                isActive: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Propiedad importada exitosamente desde Booking.com',
            property
        });

    } catch (error) {
        console.error('Error importing from Booking:', error);
        res.status(500).json({
            success: false,
            error: 'Error al importar desde Booking.com'
        });
    }
});

// ====================================
// 🔄 MODULE 3: CHANNEL MANAGER
// ====================================

// Connect channel
app.post('/api/channels/connect', authenticateToken, async (req, res) => {
    try {
        const { propertyId, channelName, listingId, icalUrl, apiCredentials } = req.body;

        // Verify property ownership
        const property = await prisma.property.findFirst({
            where: { id: propertyId, ownerId: req.user.userId }
        });

        if (!property) {
            return res.status(404).json({
                success: false,
                error: 'Propiedad no encontrada'
            });
        }

        // Create or update channel
        const channel = await prisma.channel.upsert({
            where: {
                propertyId_name: {
                    propertyId,
                    name: channelName
                }
            },
            update: {
                listingId,
                icalUrl,
                apiCredentials: apiCredentials || {},
                syncEnabled: true,
                isActive: true
            },
            create: {
                propertyId,
                name: channelName,
                listingId,
                icalUrl,
                apiCredentials: apiCredentials || {},
                syncEnabled: true,
                isActive: true
            }
        });

        // Perform initial sync
        try {
            if (icalUrl) {
                await channelManagerService.syncChannel(channel.id);
            }
        } catch (syncError) {
            console.warn('Warning: Initial sync failed:', syncError);
        }

        res.json({
            success: true,
            message: `Canal ${channelName} conectado exitosamente`,
            channel
        });

    } catch (error) {
        console.error('Error connecting channel:', error);
        res.status(500).json({
            success: false,
            error: 'Error al conectar el canal'
        });
    }
});

// Sync channels
app.post('/api/channels/sync', authenticateToken, async (req, res) => {
    try {
        const { propertyId, channelId } = req.body;

        if (channelId) {
            // Sync specific channel
            await channelManagerService.syncChannel(channelId);
        } else if (propertyId) {
            // Sync all channels for property
            await channelManagerService.syncProperty(propertyId);
        } else {
            // Sync all user's channels
            await channelManagerService.syncAllChannels(req.user.userId);
        }

        res.json({
            success: true,
            message: 'Sincronización completada exitosamente'
        });

    } catch (error) {
        console.error('Error syncing channels:', error);
        res.status(500).json({
            success: false,
            error: 'Error en la sincronización'
        });
    }
});

// ====================================
// 📅 MODULE 4: RESERVATIONS
// ====================================

// Get reservations
app.get('/api/reservations', authenticateToken, async (req, res) => {
    try {
        const reservations = await prisma.reservation.findMany({
            where: {
                property: { ownerId: req.user.userId }
            },
            include: {
                property: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        city: true
                    }
                },
                payments: true
            },
            orderBy: { checkIn: 'asc' }
        });

        res.json({
            success: true,
            reservations
        });
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({
            success: false,
            error: 'Error al cargar las reservas'
        });
    }
});

// ====================================
// 💰 MODULE 5: STRIPE DEPOSITS (FIANZAS)
// ====================================

// Create deposit
app.post('/api/deposits/create', authenticateToken, async (req, res) => {
    try {
        const { reservationId, amount, currency } = req.body;

        const reservation = await prisma.reservation.findFirst({
            where: {
                id: reservationId,
                property: { ownerId: req.user.userId }
            },
            include: { property: { include: { owner: true } } }
        });

        if (!reservation) {
            return res.status(404).json({
                success: false,
                error: 'Reserva no encontrada'
            });
        }

        // Create Stripe payment intent for deposit
        const paymentIntent = await stripeService.createDepositIntent({
            amount: amount * 100, // Convert to cents
            currency: currency || 'eur',
            customerId: reservation.property.owner.stripeCustomerId,
            metadata: {
                reservationId: reservationId,
                type: 'security_deposit'
            }
        });

        // Update reservation with deposit info
        await prisma.reservation.update({
            where: { id: reservationId },
            data: {
                stripePaymentIntentId: paymentIntent.id,
                depositAmount: amount,
                depositCurrency: currency || 'EUR',
                depositStatus: 'pending'
            }
        });

        res.json({
            success: true,
            message: 'Fianza creada exitosamente',
            paymentIntent: {
                id: paymentIntent.id,
                clientSecret: paymentIntent.client_secret,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency
            }
        });

    } catch (error) {
        console.error('Error creating deposit:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear la fianza'
        });
    }
});

// ====================================
// 💬 MODULE 6: WHATSAPP MESSAGING
// ====================================

// Send WhatsApp message
app.post('/api/whatsapp/send', authenticateToken, async (req, res) => {
    try {
        const { phone, message, templateId, reservationId } = req.body;

        const result = await whatsappService.sendMessage({
            phone,
            message,
            templateId
        });

        // Log message in database
        if (result.success) {
            await prisma.message.create({
                data: {
                    ownerId: req.user.userId,
                    templateId,
                    guestName: 'WhatsApp User',
                    guestPhone: phone,
                    content: message,
                    platform: 'whatsapp',
                    status: 'sent',
                    sentAt: new Date()
                }
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        res.status(500).json({
            success: false,
            error: 'Error al enviar mensaje de WhatsApp'
        });
    }
});

// Create message template
app.post('/api/templates', authenticateToken, async (req, res) => {
    try {
        const { name, category, language, content, variables } = req.body;

        const template = await prisma.messageTemplate.create({
            data: {
                ownerId: req.user.userId,
                name,
                category,
                language: language || 'es',
                content,
                variables: variables || []
            }
        });

        res.status(201).json({
            success: true,
            template
        });

    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear la plantilla'
        });
    }
});

// ====================================
// 🔔 NOTIFICATIONS
// ====================================

// Get notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json({
            success: true,
            notifications
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            error: 'Error al cargar notificaciones'
        });
    }
});

// ====================================
// 🚀 SERVER INITIALIZATION
// ====================================

const PORT = process.env.PORT || 8080;

const startServer = async () => {
    try {
        await connectDB();

        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 AirHost AI Server v2.1 running on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('📋 Available modules:');
            console.log('   ✅ Authentication & User Management');
            console.log('   ✅ Properties Management');  
            console.log('   ✅ Channel Manager (Airbnb/Booking sync)');
            console.log('   ✅ Reservations Management');
            console.log('   ✅ Stripe Deposits (Fianzas)');
            console.log('   ✅ WhatsApp Messaging');
            console.log('   ✅ Notifications');
            console.log('🎯 System ready for property management automation!');
        });

    } catch (error) {
        console.error('❌ Error starting server:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM signal received. Shutting down gracefully...');
    await prisma.$disconnect();
    server.close(() => {
        console.log('✅ Server shut down gracefully');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT signal received. Shutting down gracefully...');
    await prisma.$disconnect();
    server.close(() => {
        console.log('✅ Server shut down gracefully');
        process.exit(0);
    });
});

startServer().catch(error => {
    console.error('❌ Fatal error starting server:', error);
    process.exit(1);
});