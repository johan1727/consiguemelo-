#!/usr/bin/env node
/**
 * Genera og-cover.png desde og-cover.svg
 * Uso: npx sharp-cli -i public/images/og-cover.svg -o public/images/og-cover.png
 * O:   npm install sharp --save-dev && node scripts/generate-og-png.js
 */
const fs = require('fs');
const path = require('path');

async function generate() {
    try {
        const sharp = require('sharp');
        const svgPath = path.join(__dirname, '..', 'public', 'images', 'og-cover.svg');
        const pngPath = path.join(__dirname, '..', 'public', 'images', 'og-cover.png');
        
        await sharp(svgPath)
            .resize(1200, 630)
            .png({ quality: 90 })
            .toFile(pngPath);
        
        const stats = fs.statSync(pngPath);
        console.log(`✅ og-cover.png generado (${(stats.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            console.log('sharp no está instalado. Instalando...');
            const { execSync } = require('child_process');
            execSync('npm install sharp --save-dev', { stdio: 'inherit' });
            console.log('Reintentando...');
            generate();
        } else {
            console.error('Error:', err.message);
            process.exit(1);
        }
    }
}

generate();
