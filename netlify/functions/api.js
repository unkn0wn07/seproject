const serverless = require('serverless-http');
const app = require('../../backend/server');

// Export serverless handler for Netlify
module.exports.handler = serverless(app);
