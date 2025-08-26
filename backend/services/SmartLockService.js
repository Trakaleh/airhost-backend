const { ObjectId } = require('mongodb');

class SmartLockService {
    constructor(db) {
        this.db = db;
        this.locksCollection = db.collection('smart_locks');
        this.codesCollection = db.collection('access_codes');
        
        // Supported smart lock brands and their APIs
        this.supportedBrands = {
            yale: {
                name: 'Yale Connect',
                api_endpoint: 'https://api.yale.com',
                features: ['temporary_codes', 'permanent_codes', 'remote_unlock']
            },
            august: {
                name: 'August Home',
                api_endpoint: 'https://api.august.com',
                features: ['temporary_codes', 'permanent_codes', 'remote_unlock', 'doorbell']
            },
            schlage: {
                name: 'Schlage Encode',
                api_endpoint: 'https://api.schlage.com',
                features: ['temporary_codes', 'permanent_codes']
            },
            kwikset: {
                name: 'Kwikset Halo',
                api_endpoint: 'https://api.kwikset.com',
                features: ['temporary_codes', 'permanent_codes']
            }
        };
    }

    // Registrar nueva cerradura inteligente
    async registerSmartLock(userId, lockData) {
        try {
            const lock = {
                user_id: new ObjectId(userId),
                property_id: new ObjectId(lockData.property_id),
                brand: lockData.brand,
                device_id: lockData.device_id,
                device_name: lockData.device_name || `Smart Lock ${lockData.brand}`,
                
                // API credentials (encrypted in production)
                api_credentials: {
                    api_key: lockData.api_key,
                    api_secret: lockData.api_secret,
                    access_token: lockData.access_token || null
                },

                // Lock configuration
                settings: {
                    auto_lock_enabled: lockData.auto_lock_enabled || true,
                    auto_lock_delay: lockData.auto_lock_delay || 30, // seconds
                    temporary_code_length: lockData.temporary_code_length || 6,
                    code_expiry_notification: true
                },

                // Status
                status: 'active',
                last_sync: null,
                battery_level: null,
                connection_status: 'unknown',

                created_at: new Date(),
                updated_at: new Date()
            };

            const result = await this.locksCollection.insertOne(lock);
            console.log(`✅ Smart Lock registrado: ${result.insertedId}`);

            // Test connection
            await this.testConnection(result.insertedId);

            return { 
                success: true, 
                lock_id: result.insertedId,
                lock: { ...lock, _id: result.insertedId }
            };
        } catch (error) {
            console.error('❌ Error registrando smart lock:', error);
            return { success: false, error: error.message };
        }
    }

    // Generar código de acceso temporal
    async generateTemporaryCode(lockId, userId, codeData) {
        try {
            // Generate random code
            const codeLength = codeData.code_length || 6;
            const accessCode = Math.floor(Math.random() * Math.pow(10, codeLength))
                .toString().padStart(codeLength, '0');

            const code = {
                lock_id: new ObjectId(lockId),
                user_id: new ObjectId(userId),
                booking_id: codeData.booking_id ? new ObjectId(codeData.booking_id) : null,
                
                code: accessCode,
                code_name: codeData.code_name || `Guest Code ${accessCode}`,
                
                // Validity period
                valid_from: new Date(codeData.valid_from),
                valid_until: new Date(codeData.valid_until),
                
                // Usage tracking
                max_uses: codeData.max_uses || null,
                current_uses: 0,
                
                // Guest information
                guest_info: {
                    name: codeData.guest_name || '',
                    email: codeData.guest_email || '',
                    phone: codeData.guest_phone || ''
                },

                // Status
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
            };

            const result = await this.codesCollection.insertOne(code);

            // Program code in smart lock (simulate API call)
            await this.programCodeInLock(lockId, accessCode, code.valid_from, code.valid_until);

            console.log(`✅ Código temporal generado: ${accessCode} para lock ${lockId}`);
            return { 
                success: true, 
                code_id: result.insertedId,
                access_code: accessCode,
                valid_from: code.valid_from,
                valid_until: code.valid_until
            };
        } catch (error) {
            console.error('❌ Error generando código temporal:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener códigos activos de una cerradura
    async getActiveCodes(lockId, userId) {
        try {
            const codes = await this.codesCollection
                .find({
                    lock_id: new ObjectId(lockId),
                    user_id: new ObjectId(userId),
                    status: 'active',
                    valid_until: { $gte: new Date() }
                })
                .sort({ created_at: -1 })
                .toArray();

            return { success: true, codes };
        } catch (error) {
            console.error('❌ Error obteniendo códigos activos:', error);
            return { success: false, error: error.message };
        }
    }

    // Revocar código de acceso
    async revokeAccessCode(codeId, userId) {
        try {
            const code = await this.codesCollection.findOne({
                _id: new ObjectId(codeId),
                user_id: new ObjectId(userId)
            });

            if (!code) {
                return { success: false, error: 'Código no encontrado' };
            }

            // Remove code from smart lock (simulate API call)
            await this.removeCodeFromLock(code.lock_id, code.code);

            // Update status in database
            await this.codesCollection.updateOne(
                { _id: new ObjectId(codeId) },
                { 
                    $set: { 
                        status: 'revoked',
                        revoked_at: new Date(),
                        updated_at: new Date()
                    }
                }
            );

            console.log(`✅ Código revocado: ${code.code}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error revocando código:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener cerraduras del usuario
    async getUserLocks(userId) {
        try {
            const locks = await this.locksCollection
                .find({ user_id: new ObjectId(userId) })
                .sort({ created_at: -1 })
                .toArray();

            return { success: true, locks };
        } catch (error) {
            console.error('❌ Error obteniendo cerraduras:', error);
            return { success: false, error: error.message };
        }
    }

    // Actualizar estado de la cerradura
    async updateLockStatus(lockId, userId) {
        try {
            // Simulate API call to check lock status
            const status = await this.checkLockStatus(lockId);

            await this.locksCollection.updateOne(
                { _id: new ObjectId(lockId), user_id: new ObjectId(userId) },
                {
                    $set: {
                        battery_level: status.battery_level,
                        connection_status: status.connection_status,
                        last_sync: new Date(),
                        updated_at: new Date()
                    }
                }
            );

            return { success: true, status };
        } catch (error) {
            console.error('❌ Error actualizando estado de cerradura:', error);
            return { success: false, error: error.message };
        }
    }

    // Unlock remoto
    async remoteUnlock(lockId, userId, unlockData) {
        try {
            const lock = await this.locksCollection.findOne({
                _id: new ObjectId(lockId),
                user_id: new ObjectId(userId)
            });

            if (!lock) {
                return { success: false, error: 'Cerradura no encontrada' };
            }

            // Simulate API call for remote unlock
            const unlockResult = await this.performRemoteUnlock(lock, unlockData);

            // Log the unlock event
            await this.db.collection('lock_events').insertOne({
                lock_id: new ObjectId(lockId),
                user_id: new ObjectId(userId),
                event_type: 'remote_unlock',
                event_data: unlockData,
                success: unlockResult.success,
                timestamp: new Date()
            });

            console.log(`✅ Unlock remoto ${unlockResult.success ? 'exitoso' : 'fallido'} para lock ${lockId}`);
            return unlockResult;
        } catch (error) {
            console.error('❌ Error en unlock remoto:', error);
            return { success: false, error: error.message };
        }
    }

    // Limpiar códigos expirados
    async cleanupExpiredCodes() {
        try {
            const result = await this.codesCollection.updateMany(
                { 
                    valid_until: { $lt: new Date() },
                    status: 'active'
                },
                { 
                    $set: { 
                        status: 'expired',
                        updated_at: new Date()
                    }
                }
            );

            console.log(`✅ ${result.modifiedCount} códigos marcados como expirados`);
            return { success: true, expired_count: result.modifiedCount };
        } catch (error) {
            console.error('❌ Error limpiando códigos expirados:', error);
            return { success: false, error: error.message };
        }
    }

    // Métodos privados para simulación de API calls

    async testConnection(lockId) {
        // Simulate API connection test
        console.log(`🔗 Probando conexión con cerradura ${lockId}...`);
        return { success: true, connection_status: 'connected' };
    }

    async programCodeInLock(lockId, code, validFrom, validUntil) {
        // Simulate programming code in smart lock via API
        console.log(`🔧 Programando código ${code} en cerradura ${lockId}`);
        console.log(`   Válido desde: ${validFrom}`);
        console.log(`   Válido hasta: ${validUntil}`);
        return { success: true };
    }

    async removeCodeFromLock(lockId, code) {
        // Simulate removing code from smart lock via API
        console.log(`🗑️ Removiendo código ${code} de cerradura ${lockId}`);
        return { success: true };
    }

    async checkLockStatus(lockId) {
        // Simulate checking lock status via API
        return {
            battery_level: Math.floor(Math.random() * 100),
            connection_status: Math.random() > 0.1 ? 'connected' : 'disconnected'
        };
    }

    async performRemoteUnlock(lock, unlockData) {
        // Simulate remote unlock via API
        console.log(`🔓 Desbloqueando remotamente cerradura ${lock._id}`);
        return { 
            success: Math.random() > 0.05, // 95% success rate
            unlock_time: new Date()
        };
    }
}

module.exports = SmartLockService;