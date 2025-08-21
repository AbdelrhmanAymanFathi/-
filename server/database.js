const knex = require('knex');
const config = require('../knexfile');
const logger = require('./utils/logger');

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

// Create database connection
const db = knex(dbConfig);

// Test database connection
db.raw('SELECT 1')
  .then(() => {
    logger.info('Database connected successfully');
  })
  .catch((error) => {
    logger.error('Database connection failed:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', async () => {
  try {
    await db.destroy();
    logger.info('Database connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error closing database connection:', error);
    process.exit(1);
  }
});

module.exports = db;

