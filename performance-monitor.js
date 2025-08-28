#!/usr/bin/env node
/**
 * Performance Monitor
 * Tracks deployment and build performance metrics
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            buildTime: null,
            deployTime: null,
            bundleSize: {},
            optimizationSavings: {}
        };
        this.startTime = performance.now();
    }

    startBuild() {
        this.buildStartTime = performance.now();
        console.log('⏱️  Build performance monitoring started');
    }

    endBuild() {
        if (this.buildStartTime) {
            this.metrics.buildTime = Math.round(performance.now() - this.buildStartTime);
            console.log(`✅ Build completed in ${this.metrics.buildTime}ms`);
        }
    }

    measureBundleSize() {
        const frontendPath = path.join(__dirname, 'frontend', 'public');
        
        try {
            // Measure JS files
            const jsFiles = ['js/api.js', 'js/auth.js'];
            let totalJSSize = 0;
            
            for (const file of jsFiles) {
                const filePath = path.join(frontendPath, file);
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    totalJSSize += stats.size;
                    this.metrics.bundleSize[file] = {
                        size: stats.size,
                        sizeKB: Math.round(stats.size / 1024 * 100) / 100
                    };
                }
            }

            this.metrics.bundleSize.totalJS = {
                size: totalJSSize,
                sizeKB: Math.round(totalJSSize / 1024 * 100) / 100
            };

            console.log(`📦 Total JS bundle size: ${this.metrics.bundleSize.totalJS.sizeKB}KB`);
            
        } catch (error) {
            console.warn('⚠️  Could not measure bundle size:', error.message);
        }
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            performance: this.metrics,
            optimizations: [
                'Multi-stage Docker build with caching',
                'Npm cache mounting for faster installs',
                'Optimized Prisma generation',
                'JS minification and compression',
                'HTML performance headers',
                'Reduced Docker context size'
            ],
            recommendations: [
                'Consider implementing CDN for static assets',
                'Add gzip compression in production',
                'Implement HTTP/2 server push for critical resources',
                'Consider service worker for offline caching'
            ]
        };

        fs.writeFileSync(
            path.join(__dirname, 'performance-report.json'),
            JSON.stringify(report, null, 2)
        );

        console.log('📊 Performance report generated');
        return report;
    }

    logSummary() {
        console.log('\n🎯 Performance Summary:');
        
        if (this.metrics.buildTime) {
            console.log(`   Build Time: ${this.metrics.buildTime}ms`);
        }
        
        if (this.metrics.bundleSize.totalJS) {
            console.log(`   JS Bundle Size: ${this.metrics.bundleSize.totalJS.sizeKB}KB`);
        }

        console.log('\n🚀 Optimizations Applied:');
        console.log('   ✓ Docker multi-stage build');
        console.log('   ✓ Build layer caching');
        console.log('   ✓ Asset minification');
        console.log('   ✓ Performance headers');
        console.log('   ✓ Memory-optimized Node.js flags');
        console.log('   ✓ Reduced build context');
    }
}

// CLI usage
if (require.main === module) {
    const monitor = new PerformanceMonitor();
    
    const action = process.argv[2];
    
    switch (action) {
        case 'start':
            monitor.startBuild();
            break;
        case 'end':
            monitor.endBuild();
            monitor.measureBundleSize();
            monitor.generateReport();
            monitor.logSummary();
            break;
        case 'measure':
            monitor.measureBundleSize();
            monitor.generateReport();
            monitor.logSummary();
            break;
        default:
            console.log('Usage: node performance-monitor.js [start|end|measure]');
    }
}

module.exports = PerformanceMonitor;