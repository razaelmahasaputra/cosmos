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
    },
    {
      name: "waf-api",
      script: "pnpm",
      args: "run start:api",
      watch: false,
      env: {
        NODE_ENV: "production",
        API_PORT: "4504"
      }
    },
    {
      name: "waf-tunnel",
      script: "cloudflared",
      args: "tunnel run --url http://localhost:4504 waf-api",
      watch: false
    }
  ]
};
