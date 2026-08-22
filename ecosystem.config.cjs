/* eslint-disable no-undef */
module.exports = {
  apps: [
    {
      name: "waf-bot",
      script: "pnpm",
      args: "run start",
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
