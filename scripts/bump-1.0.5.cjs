const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version = '1.0.5';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
const lock = JSON.parse(fs.readFileSync('package-lock.json','utf8'));
lock.version = '1.0.5';
if (lock.packages && lock.packages['']) lock.packages[''].version = '1.0.5';
fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log('1.0.5');
