const fs=require('fs');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
lock.name=pkg.name; lock.version=pkg.version;
if(lock.packages['']) { lock.packages[''].name=pkg.name; lock.packages[''].version=pkg.version; }
fs.writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
console.log(pkg.name,pkg.version);
