const { spawn } = require('child_process')
const path = require('path')
const dir = __dirname
const viteBin = path.join(dir, 'node_modules', 'vite', 'bin', 'vite.js')
const child = spawn(process.execPath, [viteBin, '--port', '5173', '--host', '127.0.0.1'], {
  cwd: dir,
  stdio: 'inherit',
})
child.on('exit', (code) => process.exit(code || 0))
