module.exports = {
  apps: [
    {
      name: 'deliveries-accounting',
      script: 'server/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // PM2 Configuration
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Monitoring
      pmx: true,
      monitor: true,
      
      // Watch mode (development only)
      watch: process.env.NODE_ENV === 'development',
      ignore_watch: [
        'node_modules',
        'logs',
        'data',
        'uploads'
      ],
      
      // Environment variables
      env_file: '.env'
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:username/deliveries-transport-accounting.git',
      path: '/var/www/deliveries-accounting',
      'post-deploy': 'npm install && npm run migrate && pm2 reload ecosystem.config.js --env production'
    }
  }
};

