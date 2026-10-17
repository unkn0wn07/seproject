let serverless;
try {
  serverless = require('serverless-http');
} catch (e) {
  serverless = require('../../backend/node_modules/serverless-http');
}

const app = require('../../backend/server');

// Export serverless handler for Netlify
module.exports.handler = serverless(app);
