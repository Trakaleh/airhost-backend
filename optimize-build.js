#!/usr/bin/env node
/**
 * Build Optimization Script
 * Optimizes frontend assets for production deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BuildOptimizer {
    constructor() {
        this.frontendPath = path.join(__dirname, 'frontend', 'public');
        this.jsFiles = [];
        this.htmlFiles = [];
    }

    async optimize() {
        console.log('🚀 Starting build optimization...');
        
        try {
            this.findFiles();
            this.minifyJS();
            this.optimizeHTML();
            this.generateManifest();
            console.log('✅ Build optimization completed successfully!');
        } catch (error) {
            console.error('❌ Build optimization failed:', error);
            process.exit(1);
        }
    }

    findFiles() {
        console.log('📂 Scanning files...');
        this.scanDirectory(this.frontendPath);
        console.log(`Found ${this.jsFiles.length} JS files and ${this.htmlFiles.length} HTML files`);
    }

    scanDirectory(dir) {
        if (!fs.existsSync(dir)) return;

        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                this.scanDirectory(fullPath);
            } else if (file.endsWith('.js')) {
                this.jsFiles.push(fullPath);
            } else if (file.endsWith('.html')) {
                this.htmlFiles.push(fullPath);
            }
        }
    }

    minifyJS() {
        console.log('🗜️  Optimizing JavaScript files...');
        
        for (const jsFile of this.jsFiles) {
            try {
                let content = fs.readFileSync(jsFile, 'utf8');
                
                // Simple minification - remove comments and extra whitespace
                content = content
                    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
                    .replace(/\/\/.*$/gm, '') // Remove line comments
                    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                    .replace(/;\s*}/g, ';}') // Remove space before closing braces
                    .replace(/{\s*/g, '{') // Remove space after opening braces
                    .replace(/,\s*/g, ',') // Remove space after commas
                    .trim();

                fs.writeFileSync(jsFile, content);
                console.log(`✓ Optimized ${path.basename(jsFile)}`);
            } catch (error) {
                console.warn(`⚠️  Failed to optimize ${jsFile}:`, error.message);
            }
        }
    }

    optimizeHTML() {
        console.log('📄 Optimizing HTML files...');
        
        for (const htmlFile of this.htmlFiles) {
            try {
                let content = fs.readFileSync(htmlFile, 'utf8');
                
                // Add performance optimizations
                content = content.replace(
                    /<head>/i,
                    `<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
    <link rel="dns-prefetch" href="//fonts.googleapis.com">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta name="referrer" content="same-origin">`
                );

                // Add compression hints
                if (!content.includes('gzip')) {
                    content = content.replace(
                        /<script src="/g,
                        '<script defer src="'
                    );
                }

                fs.writeFileSync(htmlFile, content);
                console.log(`✓ Optimized ${path.basename(htmlFile)}`);
            } catch (error) {
                console.warn(`⚠️  Failed to optimize ${htmlFile}:`, error.message);
            }
        }
    }

    generateManifest() {
        console.log('📋 Generating build manifest...');
        
        const manifest = {
            buildTime: new Date().toISOString(),
            files: {
                js: this.jsFiles.map(f => path.relative(this.frontendPath, f)),
                html: this.htmlFiles.map(f => path.relative(this.frontendPath, f))
            },
            optimizations: [
                'JS minification',
                'HTML optimization',
                'Performance headers',
                'Asset preloading'
            ]
        };

        fs.writeFileSync(
            path.join(__dirname, 'build-manifest.json'),
            JSON.stringify(manifest, null, 2)
        );

        console.log('✓ Build manifest generated');
    }
}

// Run optimization if called directly
if (require.main === module) {
    const optimizer = new BuildOptimizer();
    optimizer.optimize().catch(console.error);
}

module.exports = BuildOptimizer;