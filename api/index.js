// Vercel serverless entry point
// Re-exports the request handler from server.js
const handler = require('../server.js');
module.exports = handler;
