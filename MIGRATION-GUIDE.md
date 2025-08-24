# 🔄 Guía de Migración de Base de Datos

## 🎯 Opción 1: Railway PostgreSQL (RECOMENDADA)

### Ventajas
- ✅ Red privada segura
- ✅ Sin whitelist de IPs
- ✅ Backups automáticos  
- ✅ Escalado automático
- ✅ Zero-downtime deployments

### Pasos de Migración:

#### 1. Crear Database en Railway
```bash
1. Railway Dashboard → Add Service → Database → PostgreSQL
2. Espera a que se cree
3. Copia la DATABASE_URL desde Variables
```

#### 2. Instalar Prisma (ORM Moderno)
```bash
npm install prisma @prisma/client
npx prisma init
```

#### 3. Schema Conversion
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  phone     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  properties Property[]
  
  @@map("users")
}

model Property {
  id          String   @id @default(cuid())
  name        String
  address     String
  city        String
  country     String
  ownerId     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  owner        User           @relation(fields: [ownerId], references: [id])
  reservations Reservation[]
  
  @@map("properties")
}

model Reservation {
  id          String   @id @default(cuid())
  checkIn     DateTime
  checkOut    DateTime
  guestName   String
  guestEmail  String
  propertyId  String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  property Property @relation(fields: [propertyId], references: [id])
  
  @@map("reservations")
}
```

#### 4. Migrar Código
```javascript
// Reemplazar Mongoose por Prisma
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Antes (Mongoose):
const users = await User.find();

// Después (Prisma):
const users = await prisma.user.findMany();
```

## 🎯 Opción 2: PlanetScale MySQL

### Ventajas
- ✅ Branching como Git
- ✅ Sin IP whitelist
- ✅ Escalado serverless
- ✅ Compatible con Railway

### Setup:
```bash
1. Crear cuenta en planetscale.com
2. Crear database
3. Obtener connection string
4. No necesita whitelist de IPs
```

## 🎯 Opción 3: MongoDB Atlas Seguro

### IPs de Railway (Actualizar periódicamente):
```
# US West (us-west1)
35.232.0.0/16
35.230.0.0/16

# Europe West (europe-west1) 
35.188.0.0/16
35.195.0.0/16

# US Central (us-central1)
34.102.0.0/16
34.67.0.0/16
```

### Configuración Segura:
```javascript
// Agregar retry logic y security headers
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB conectado correctamente');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    // Retry en 5 segundos
    setTimeout(connectDB, 5000);
  }
};
```

## 💰 Comparación de Costos

| Servicio | Plan Gratuito | Plan Paid | Ventajas |
|----------|---------------|-----------|----------|
| Railway DB | 5GB | $5/mes por GB | Red privada, simple |
| PlanetScale | 10GB | $29/mes | Branching, escalado |
| MongoDB Atlas | 500MB | $9/mes | Familiar, NoSQL |
| Supabase | 500MB | $25/mes | Full-stack, Auth |

## 🚀 Recomendación Final

**Para tu SaaS Airbnb:** Railway PostgreSQL + Prisma
- Máxima seguridad
- Menor latencia  
- Escalado automático
- Desarrollo más rápido