const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package-lock.json','utf8'));
p.version = '1.0.2';
if (p.packages && p.packages['']) p.packages[''].version = '1.0.2';
fs.writeFileSync('package-lock.json', JSON.stringify(p, null, 2) + '\n');
