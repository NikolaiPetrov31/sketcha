export const config = {
  // 🔗 Socket.io Server URL
  // Change this to your local IP address if testing on a local network (e.g., 'http://192.168.1.5:3001')
  // or to your domain name if hosting in production (e.g., 'https://api.sketcha.com')
  SOCKET_URL: 'http://127.0.0.1:3001',

  // ⚙️ Performance Settings
  // How many milliseconds to wait between sending drawing data (40ms = ~25 fps)
  DRAWING_THROTTLE_MS: 40,
};
