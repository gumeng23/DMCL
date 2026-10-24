import os, zipfile, time
root = r'F:\amcluncher\release'
folder = os.path.join(root, 'AMCL-1.0.0-win-x64')
out = os.path.join(root, 'AMCL-1.0.0-win-x64.zip')
if os.path.exists(out):
    os.remove(out)
start = time.time()
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=5, allowZip64=True) as z:
    for base, dirs, files in os.walk(folder):
        for name in files:
            full = os.path.join(base, name)
            rel = os.path.join('AMCL', os.path.relpath(full, folder))
            z.write(full, rel)
print('zip written', os.path.getsize(out), 'in', round(time.time()-start,1), 's')
