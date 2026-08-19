const path = require('path');

module.exports = {
  // Keep Chrome inside the deployed project instead of Render's ephemeral
  // home cache so the runtime can find the browser installed during build.
  cacheDirectory: path.join(__dirname, '.cache', 'puppeteer'),
};
