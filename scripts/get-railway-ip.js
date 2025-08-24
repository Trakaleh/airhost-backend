const https = require('https');

// Script para obtener la IP actual de Railway y configurar MongoDB Atlas
const getRailwayIP = async () => {
    return new Promise((resolve, reject) => {
        https.get('https://api.ipify.org?format=json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const ip = JSON.parse(data).ip;
                    console.log('🌐 IP actual de Railway:', ip);
                    console.log('📋 Agrega esta IP a MongoDB Atlas Network Access:');
                    console.log(`   ${ip}/32`);
                    console.log('🔗 https://cloud.mongodb.com/v2/PROJECT_ID#/security/network/accessList');
                    resolve(ip);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', reject);
    });
};

// Ejecutar si se llama directamente
if (require.main === module) {
    getRailwayIP().catch(console.error);
}

module.exports = { getRailwayIP };