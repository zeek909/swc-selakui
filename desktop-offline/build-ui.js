/**
 * Builds ui/index.html from the Google version's Index.html, Styles.html and App.html,
 * so both versions share the same screens. Usage: node build-ui.js <web-app folder> <out app folder>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const [webDir, outDir] = process.argv.slice(2);
const read = f => fs.readFileSync(path.join(webDir, f), 'utf8');
const here = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

let html = read('Index.html');
const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; ' +
  'style-src \'unsafe-inline\'; img-src data: blob:; font-src data:">';
html = html.replace('<base target="_top">', csp);
html = html.replace("<?!= include('Styles'); ?>", () => read('Styles.html'));
html = html.replace("<?!= include('App'); ?>", () => here('ui-src/desktop-shim.html') + '\n' + read('App.html'));
if (/<\?/.test(html)) throw new Error('Index.html has a template tag this build does not know.');

fs.mkdirSync(path.join(outDir, 'ui'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'ui', 'index.html'), html);
fs.copyFileSync(path.join(__dirname, 'ui-src', 'prompt.html'), path.join(outDir, 'ui', 'prompt.html'));
fs.copyFileSync(path.join(webDir, 'Code.gs'), path.join(outDir, 'Code.gs'));
['main.js', 'preload.js', 'prompt-preload.js', 'gas-runtime.js', 'package.json', 'icon.png']
  .forEach(f => fs.copyFileSync(path.join(__dirname, f), path.join(outDir, f)));
console.log('App files written to ' + outDir);
