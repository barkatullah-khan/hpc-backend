const pty = require('node-pty');

// This function receives the 'io' instance from server.js
const initTerminal = (io) => {
  io.on('connection', (socket) => {
    console.log('Admin connected to Master Terminal:', socket.id);

    // 1. Spawn a real PTY (Pseudoterminal)
    const shell = pty.spawn('bash', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME || '/home/barkat',
      env: process.env
    });

    // 2. Stream Shell Output -> Frontend
    shell.onData((data) => {
      socket.emit('terminal-output', data);
    });

    // 3. Receive Input (Keys/Commands) -> Shell
    socket.on('terminal-input', (data) => {
      if (shell) shell.write(data);
    });

    // 4. Handle Window Resizing (Crucial for professional UI)
    socket.on('terminal-resize', (size) => {
      shell.resize(size.cols, size.rows);
    });

    // 5. Cleanup on Disconnect
    socket.on('disconnect', () => {
      console.log('Terminal session ended.');
      shell.kill();
    });
  });
};

module.exports = initTerminal;