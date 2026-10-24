const https = require('https');
const fs = require('fs');
const path = require('path');
function get(url, redirects=0) {
  return new Promise((resolve, reject) => {
    https.get(url, { family: 4, timeout: 30000, headers: { 'User-Agent': 'AMCL-Build/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects > 8) return reject(new Error('too many redirects'));
        return resolve(get(new URL(res.headers.location, url).toString(), redirects+1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP '+res.statusCode+' '+url)); }
      const chunks=[]; res.on('data', c=>chunks.push(c)); res.on('end', ()=>resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}
(async()=>{
  const release = JSON.parse((await get('https://api.github.com/repos/electron/rcedit/releases/latest')).toString());
  const asset = release.assets.find(a => a.name === 'rcedit-x64.exe');
  if (!asset) throw new Error('rcedit asset not found: '+release.assets.map(a=>a.name).join(','));
  fs.writeFileSync(path.join('tools','rcedit.exe'), await get(asset.browser_download_url));
  console.log('rcedit', release.tag_name, asset.name);
  fs.writeFileSync(path.join('tools','7zr.exe'), await get('https://www.7-zip.org/a/7zr.exe'));
  console.log('7zr downloaded');
  fs.writeFileSync(path.join('tools','7z-extra.7z'), await get('https://www.7-zip.org/a/7z2501-extra.7z'));
  console.log('7z extra downloaded');
})().catch(e=>{console.error('ERR', e.message); process.exit(1)});
