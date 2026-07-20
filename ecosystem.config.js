module.exports = {
  apps: [
    {
      name: 'bill-api',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'bill-scheduler',
      script: 'src/services/scheduler.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '150M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
