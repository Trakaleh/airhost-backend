const nodemailer = require('nodemailer');

class MessageService {
    constructor() {
        // Configurar transportador de email
        this.emailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Templates de mensajes
        this.messageTemplates = {
            es: {
                welcome: '¡Hola {{guest_name}}! 👋 Bienvenido a {{property_name}}. Tu código de acceso es: {{access_code}}',
                access_info: '🏠 Información de acceso:\n🔑 Código: {{access_code}}\n📶 WiFi: {{wifi_name}}\n🔐 Contraseña: {{wifi_password}}',
                checkout_reminder: '🕐 Recordatorio: Check-out hoy a las {{checkout_time}}. ¡Esperamos tu reseña de 5⭐!',
                review_request: '⭐ ¡Esperamos que hayas disfrutado tu estadía en {{property_name}}! Nos encantaría recibir tu reseña.'
            },
            en: {
                welcome: 'Hello {{guest_name}}! 👋 Welcome to {{property_name}}. Your access code is: {{access_code}}',
                access_info: '🏠 Access information:\n🔑 Code: {{access_code}}\n📶 WiFi: {{wifi_name}}\n🔐 Password: {{wifi_password}}',
                checkout_reminder: '🕐 Reminder: Check-out today at {{checkout_time}}. We hope for your 5⭐ review!',
                review_request: '⭐ We hope you enjoyed your stay at {{property_name}}! We would love to receive your review.'
            }
        };
    }

    // Enviar email
    async sendEmail(emailData) {
        try {
            const { to, subject, html, text } = emailData;

            const mailOptions = {
                from: `"AirHost Assistant" <${process.env.SMTP_USER}>`,
                to: to,
                subject: subject,
                html: html,
                text: text || this.stripHtml(html)
            };

            const result = await this.emailTransporter.sendMail(mailOptions);

            console.log(`✅ Email enviado a ${to}: ${subject}`);

            return { 
                success: true, 
                message_id: result.messageId,
                platform: 'email'
            };
        } catch (error) {
            console.error('❌ Error enviando email:', error);
            return { 
                success: false, 
                error: error.message,
                platform: 'email'
            };
        }
    }

    // Enviar email de bienvenida
    async sendWelcomeEmail(guest, property, reservation) {
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Bienvenido a ${property.name}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
                .access-code { font-size: 24px; font-weight: bold; color: #667eea; text-align: center; padding: 15px; background: #e8f4f8; border-radius: 8px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>¡Bienvenido ${guest.name}! 🏠</h1>
                    <p>Tu reserva en ${property.name} está confirmada</p>
                </div>
                
                <div class="content">
                    <div class="info-box">
                        <h3>📅 Detalles de tu reserva</h3>
                        <p><strong>Check-in:</strong> ${new Date(reservation.check_in).toLocaleDateString('es-ES')}</p>
                        <p><strong>Check-out:</strong> ${new Date(reservation.check_out).toLocaleDateString('es-ES')}</p>
                        <p><strong>Dirección:</strong> ${property.address}, ${property.city}</p>
                    </div>

                    <div class="info-box">
                        <h3>📶 Información WiFi</h3>
                        <p><strong>Red:</strong> ${property.access_info?.wifi_name || 'Se enviará pronto'}</p>
                        <p><strong>Contraseña:</strong> ${property.access_info?.wifi_password || 'Se enviará pronto'}</p>
                    </div>

                    <div class="info-box">
                        <h3>📱 Contacto</h3>
                        <p>Si tienes alguna pregunta, responde a este email y te ayudaremos enseguida.</p>
                        <p>¡Esperamos que disfrutes tu estadía!</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        return await this.sendEmail({
            to: guest.email,
            subject: `Bienvenido a ${property.name} - Información de tu reserva`,
            html: html
        });
    }

    // Reemplazar variables en templates
    replaceVariables(template, variables) {
        let message = template;
        
        Object.keys(variables).forEach(key => {
            const value = variables[key] || '';
            const regex = new RegExp(`{{${key}}}`, 'g');
            message = message.replace(regex, value);
        });
        
        return message;
    }

    // Quitar HTML de texto
    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '');
    }

    // Verificar configuración de email
    async verifyEmailConfig() {
        try {
            await this.emailTransporter.verify();
            console.log('✅ Configuración de email verificada');
            return { success: true };
        } catch (error) {
            console.error('❌ Error en configuración de email:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = MessageService;