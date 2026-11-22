const { join } = require("path");

/** @type {import('puppeteer').Configuration} */
module.exports = {
  // Changes the cache location to be inside the project folder so it persists on Render
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
