import paramiko, sys, io, os

# Fix Windows cp1252 encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

hostname = '187.77.214.236'
username = 'root'
password = 'Eduardo0523/'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print('Connecting to VPS...')
client.connect(hostname, username=username, password=password, timeout=15)
print('Connected.\n')

print('=== STEP 1: npm run build ===')
stdin, stdout, stderr = client.exec_command('cd /var/www/gst && npm run build 2>&1', timeout=720)
while True:
    chunk = stdout.read(4096)
    if not chunk:
        break
    sys.stdout.write(chunk.decode('utf-8', errors='replace'))
    sys.stdout.flush()

exit_code = stdout.channel.recv_exit_status()
print(f'\n[BUILD EXIT CODE: {exit_code}]')

if exit_code == 0:
    print('\n=== STEP 2: pm2 restart gst ===')
    _, out2, _ = client.exec_command('pm2 restart gst 2>&1', timeout=30)
    print(out2.read().decode('utf-8', errors='replace'))
    print(f'[PM2 EXIT: {out2.channel.recv_exit_status()}]')
else:
    print('[BUILD FAILED — skipping restart]')

print('\n=== STEP 3: pm2 status ===')
_, out3, _ = client.exec_command('pm2 status 2>&1', timeout=15)
print(out3.read().decode('utf-8', errors='replace'))

client.close()
print('Done.')
