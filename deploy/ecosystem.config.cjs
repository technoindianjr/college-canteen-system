// PM2 process file. From the repo root:
//   cd server && npm ci && npm run build && npm run db:migrate && cd ..
//   pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: 'canteen-api',
      cwd: __dirname + '/../server',
      script: 'dist/index.js',
      instances: 1, // keep 1: Socket.IO rooms and the no-show job live in this process
      autorestart: true,
      max_memory_restart: '600M',
      env: { NODE_ENV: 'production' },
      out_file: __dirname + '/../logs/api.out.log',
      error_file: __dirname + '/../logs/api.err.log',
      time: true,
    },
  ],
};
