/* eslint-disable no-undef */
module.exports = {
  apps: [
    {
      name: "waf-bot",
      script: "dist/index.js",
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
