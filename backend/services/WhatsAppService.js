const axios = require('axios');

class WhatsAppService {
    constructor() {
        // Services now use Prisma directly instead of MongoDB collections
        
        // WhatsApp Business API configuration
        this.whatsappConfig = {
            api_url: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
            phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
            access_token: process.env.WHATSAPP_ACCESS_TOKEN,
            webhook_verify_token: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
        };

        // Message templates for different scenarios
        this.defaultTemplates = {
            es: {
                booking_confirmation: {
                    text: '¡Hola {{guest_name}}! 👋 Tu reserva en {{property_name}} está confirmada.\n\n📅 Check-in: {{check_in_date}}\n📅 Check-out: {{check_out_date}}\n🔑 Código de acceso: {{access_code}}\n\n¿Tienes alguna pregunta?',
                    type: 'template'
                },
                pre_checkin: {
                    text: '¡Hola {{guest_name}}! 🏠 Tu check-in es mañana en {{property_name}}.\n\n🔑 Código de acceso: {{access_code}}\n📶 WiFi: {{wifi_name}}\n🔐 Contraseña: {{wifi_password}}\n\nInstrucciones de acceso: {{checkin_instructions}}',
                    type: 'template'
                },
                welcome_message: {
                    text: '¡Bienvenido {{guest_name}}! 🎉 Esperamos que disfrutes tu estancia en {{property_name}}.\n\nRecuerda:\n🚫 {{house_rules}}\n🕐 Check-out: {{check_out_time}}\n\n¿Necesitas algo? ¡Escríbeme!',
                    type: 'template'
                },
                checkout_reminder: {
                    text: 'Hola {{guest_name}} 👋 Tu check-out es hoy a las {{check_out_time}}.\n\nAntes de irte:\n✅ Deja las llaves en {{key_location}}\n✅ {{checkout_instructions}}\n\n¡Gracias por tu estancia! ⭐',
                    type: 'template'
                },
                post_checkout: {
                    text: '¡Gracias {{guest_name}} por elegir {{property_name}}! 🙏\n\n¿Nos ayudas con una reseña? Tu opinión es muy importante.\n\n⭐ {{review_link}}\n\n¡Esperamos verte pronto!',
                    type: 'template'
                }
            },
            en: {
                booking_confirmation: {
                    text: 'Hi {{guest_name}}! 👋 Your booking at {{property_name}} is confirmed.\n\n📅 Check-in: {{check_in_date}}\n📅 Check-out: {{check_out_date}}\n🔑 Access code: {{access_code}}\n\nAny questions?',
                    type: 'template'
                },
                pre_checkin: {
                    text: 'Hi {{guest_name}}! 🏠 Your check-in is tomorrow at {{property_name}}.\n\n🔑 Access code: {{access_code}}\n📶 WiFi: {{wifi_name}}\n🔐 Password: {{wifi_password}}\n\nAccess instructions: {{checkin_instructions}}',
                    type: 'template'
                },
                welcome_message: {
                    text: 'Welcome {{guest_name}}! 🎉 Hope you enjoy your stay at {{property_name}}.\n\nRemember:\n🚫 {{house_rules}}\n🕐 Check-out: {{check_out_time}}\n\nNeed anything? Just message me!',
                    type: 'template'
                },
                checkout_reminder: {
                    text: 'Hi {{guest_name}} 👋 Your check-out is today at {{check_out_time}}.\n\nBefore leaving:\n✅ Leave keys at {{key_location}}\n✅ {{checkout_instructions}}\n\nThank you for staying! ⭐',
                    type: 'template'
                },
                post_checkout: {
                    text: 'Thank you {{guest_name}} for choosing {{property_name}}! 🙏\n\nWould you help us with a review? Your feedback matters.\n\n⭐ {{review_link}}\n\nHope to see you soon!',
                    type: 'template'
                }
            }
        };
    }

    // Enviar mensaje de WhatsApp
    async sendWhatsAppMessage(to, message, messageType = 'text') {
        try {
            const payload = {
                messaging_product: 'whatsapp',
                to: to.replace(/[^0-9]/g, ''), // Clean phone number
                type: messageType
            };

            if (messageType === 'text') {
                payload.text = { body: message };
            } else if (messageType === 'template') {
                payload.template = message;
            }

            const response = await axios.post(
                `${this.whatsappConfig.api_url}/${this.whatsappConfig.phone_number_id}/messages`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.whatsappConfig.access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Mensaje WhatsApp enviado a ${to}:`, response.data);
            return { success: true, message_id: response.data.messages[0].id };
        } catch (error) {
            console.error('❌ Error enviando mensaje WhatsApp:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // Procesar mensaje automático basado en evento
    async processAutomaticMessage(userId, eventType, eventData) {
        try {
            // Get automation rules for this event type
            const rules = await this.automationRulesCollection.find({
                user_id: new ObjectId(userId),
                event_type: eventType,
                is_active: true
            }).toArray();

            for (const rule of rules) {
                // Check if rule conditions are met
                if (this.evaluateRuleConditions(rule.conditions, eventData)) {
                    await this.executeAutomationRule(rule, eventData);
                }
            }

            return { success: true };
        } catch (error) {
            console.error('❌ Error procesando mensaje automático:', error);
            return { success: false, error: error.message };
        }
    }

    // Ejecutar regla de automatización
    async executeAutomationRule(rule, eventData) {
        try {
            const template = await this.getMessageTemplate(rule.template_id);
            
            if (!template) {
                console.error('❌ Template no encontrado:', rule.template_id);
                return;
            }

            // Replace template variables
            const processedMessage = this.processTemplateVariables(template.content, eventData);

            // Send message with delay if specified
            if (rule.delay_minutes > 0) {
                setTimeout(async () => {
                    await this.sendAutomatedMessage(rule.user_id, eventData.guest_phone, processedMessage, rule, eventData);
                }, rule.delay_minutes * 60 * 1000);
            } else {
                await this.sendAutomatedMessage(rule.user_id, eventData.guest_phone, processedMessage, rule, eventData);
            }

            console.log(`✅ Regla de automatización ejecutada: ${rule.name}`);
        } catch (error) {
            console.error('❌ Error ejecutando regla de automatización:', error);
        }
    }

    // Enviar mensaje automático
    async sendAutomatedMessage(userId, guestPhone, message, rule, eventData) {
        try {
            const result = await this.sendWhatsAppMessage(guestPhone, message);

            // Log message in database
            await this.logMessage({
                user_id: userId,
                guest_phone: guestPhone,
                message: message,
                direction: 'outgoing',
                message_type: 'automated',
                automation_rule_id: rule._id,
                event_data: eventData,
                status: result.success ? 'sent' : 'failed',
                whatsapp_message_id: result.message_id,
                created_at: new Date()
            });

            return result;
        } catch (error) {
            console.error('❌ Error enviando mensaje automático:', error);
            return { success: false, error: error.message };
        }
    }

    // Procesar variables en template
    processTemplateVariables(template, data) {
        let processedMessage = template;
        
        // Replace common variables
        const variables = {
            guest_name: data.guest_name || 'Guest',
            property_name: data.property_name || 'Property',
            check_in_date: data.check_in_date ? new Date(data.check_in_date).toLocaleDateString() : '',
            check_out_date: data.check_out_date ? new Date(data.check_out_date).toLocaleDateString() : '',
            check_in_time: data.check_in_time || '15:00',
            check_out_time: data.check_out_time || '11:00',
            access_code: data.access_code || '',
            wifi_name: data.wifi_name || '',
            wifi_password: data.wifi_password || '',
            house_rules: data.house_rules || '',
            checkin_instructions: data.checkin_instructions || '',
            checkout_instructions: data.checkout_instructions || '',
            key_location: data.key_location || 'reception',
            review_link: data.review_link || ''
        };

        // Replace all variables in template
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            processedMessage = processedMessage.replace(regex, value);
        }

        return processedMessage;
    }

    // Crear template de mensaje personalizado
    async createMessageTemplate(userId, templateData) {
        try {
            const template = {
                user_id: new ObjectId(userId),
                name: templateData.name,
                category: templateData.category, // booking_confirmation, welcome, etc.
                language: templateData.language || 'es',
                content: templateData.content,
                variables: templateData.variables || [],
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            };

            const result = await this.templatesCollection.insertOne(template);
            console.log(`✅ Template creado: ${result.insertedId}`);
            
            return { success: true, template_id: result.insertedId };
        } catch (error) {
            console.error('❌ Error creando template:', error);
            return { success: false, error: error.message };
        }
    }

    // Crear regla de automatización
    async createAutomationRule(userId, ruleData) {
        try {
            const rule = {
                user_id: new ObjectId(userId),
                name: ruleData.name,
                description: ruleData.description || '',
                event_type: ruleData.event_type, // booking_created, check_in_tomorrow, etc.
                template_id: new ObjectId(ruleData.template_id),
                
                // Conditions for rule execution
                conditions: ruleData.conditions || {},
                
                // Timing
                delay_minutes: ruleData.delay_minutes || 0,
                
                // Settings
                is_active: ruleData.is_active !== false,
                property_ids: ruleData.property_ids ? ruleData.property_ids.map(id => new ObjectId(id)) : [],
                
                // Stats
                execution_count: 0,
                last_executed: null,
                
                created_at: new Date(),
                updated_at: new Date()
            };

            const result = await this.automationRulesCollection.insertOne(rule);
            console.log(`✅ Regla de automatización creada: ${result.insertedId}`);
            
            return { success: true, rule_id: result.insertedId };
        } catch (error) {
            console.error('❌ Error creando regla de automatización:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener templates del usuario
    async getUserTemplates(userId, language = null) {
        try {
            const query = { user_id: new ObjectId(userId) };
            if (language) {
                query.language = language;
            }

            const templates = await this.templatesCollection
                .find(query)
                .sort({ created_at: -1 })
                .toArray();

            return { success: true, templates };
        } catch (error) {
            console.error('❌ Error obteniendo templates:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener reglas de automatización del usuario
    async getUserAutomationRules(userId) {
        try {
            const rules = await this.automationRulesCollection
                .find({ user_id: new ObjectId(userId) })
                .sort({ created_at: -1 })
                .toArray();

            return { success: true, rules };
        } catch (error) {
            console.error('❌ Error obteniendo reglas de automatización:', error);
            return { success: false, error: error.message };
        }
    }

    // Obtener historial de mensajes
    async getMessageHistory(userId, filters = {}) {
        try {
            const query = { user_id: new ObjectId(userId) };
            
            if (filters.guest_phone) {
                query.guest_phone = filters.guest_phone;
            }
            
            if (filters.date_from) {
                query.created_at = { $gte: new Date(filters.date_from) };
            }
            
            if (filters.date_to) {
                query.created_at = { 
                    ...query.created_at,
                    $lte: new Date(filters.date_to)
                };
            }

            const messages = await this.messagesCollection
                .find(query)
                .sort({ created_at: -1 })
                .limit(filters.limit || 100)
                .toArray();

            return { success: true, messages };
        } catch (error) {
            console.error('❌ Error obteniendo historial de mensajes:', error);
            return { success: false, error: error.message };
        }
    }

    // Procesar webhook de WhatsApp
    async processWebhook(webhookData) {
        try {
            if (webhookData.object === 'whatsapp_business_account') {
                for (const entry of webhookData.entry) {
                    for (const change of entry.changes) {
                        if (change.field === 'messages') {
                            await this.processIncomingMessage(change.value);
                        }
                    }
                }
            }

            return { success: true };
        } catch (error) {
            console.error('❌ Error procesando webhook:', error);
            return { success: false, error: error.message };
        }
    }

    // Procesar mensaje entrante
    async processIncomingMessage(messageData) {
        try {
            if (messageData.messages) {
                for (const message of messageData.messages) {
                    await this.logIncomingMessage(message, messageData.metadata);
                    
                    // Process potential auto-replies
                    await this.processAutoReply(message);
                }
            }

            // Mark messages as read
            if (messageData.messages) {
                for (const message of messageData.messages) {
                    await this.markMessageAsRead(message.id);
                }
            }
        } catch (error) {
            console.error('❌ Error procesando mensaje entrante:', error);
        }
    }

    // Métodos auxiliares
    
    async getMessageTemplate(templateId) {
        return await this.templatesCollection.findOne({ _id: new ObjectId(templateId) });
    }

    evaluateRuleConditions(conditions, eventData) {
        // Simplified condition evaluation
        // In a real system, this would be more sophisticated
        return true;
    }

    async logMessage(messageData) {
        await this.messagesCollection.insertOne(messageData);
    }

    async logIncomingMessage(message, metadata) {
        const logData = {
            whatsapp_message_id: message.id,
            guest_phone: message.from,
            message: message.text?.body || message.type,
            message_type: message.type,
            direction: 'incoming',
            status: 'received',
            metadata: metadata,
            created_at: new Date(message.timestamp * 1000)
        };

        await this.messagesCollection.insertOne(logData);
    }

    async processAutoReply(message) {
        // Logic for automatic replies based on keywords, time, etc.
        console.log(`📱 Procesando posible auto-respuesta para mensaje de ${message.from}`);
    }

    async markMessageAsRead(messageId) {
        try {
            await axios.post(
                `${this.whatsappConfig.api_url}/${this.whatsappConfig.phone_number_id}/messages`,
                {
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: messageId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.whatsappConfig.access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (error) {
            console.error('❌ Error marcando mensaje como leído:', error);
        }
    }
}

module.exports = WhatsAppService;