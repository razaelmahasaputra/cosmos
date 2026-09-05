/* eslint-disable no-undef */
module.exports = {
    apps: [
        {
            name: 'cosmos-bot',
            script: 'dist/index.js',
            watch: ['dist'],
            out_file: './storage/logs/cosmos-bot-out.log',
            error_file: './storage/logs/cosmos-bot-error.log',
            merge_logs: true,
            time: true,
            node_args: '--max-old-space-size=256',
            max_memory_restart: '300M',
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
