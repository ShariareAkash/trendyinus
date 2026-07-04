// Vercel serverless entry — delegates every dynamic route to the shared
// request handler in server.js (which uses Vercel KV + Blob when configured).
module.exports = require('../server.js');
