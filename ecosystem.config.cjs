/* eslint-disable no-undef */
module.exports = {
  apps: [
    {
      name: "waf-bot",
      script: "dist/index.js",
      watch: false,
      out_file: "./storage/logs/waf-bot-out.log",
      error_file: "./storage/logs/waf-bot-error.log",
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
