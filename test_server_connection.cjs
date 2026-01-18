const { io } = require('socket.io-client');

const socket = io('http://127.0.0.1:3003');

console.log('Attempting to connect to http://127.0.0.1:3003...');

socket.on('connect', () => {
    console.log('✅ Connected to server with ID:', socket.id);
    console.log('Sending start_scroll_stream command...');
    socket.emit('start_scroll_stream');
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
});

socket.on('log_data', (data) => {
    console.log('📦 Received log data chunk:', data.substring(0, 50) + '...');
    // We received data, test successful
    console.log('✅ Simulation Test Passed: Receiving streaming data.');
    socket.disconnect();
    process.exit(0);
});

// Timeout after 5 seconds if no data
setTimeout(() => {
    console.error('❌ Timeout: Did not receive log_data within 5 seconds.');
    process.exit(1);
}, 5000);
