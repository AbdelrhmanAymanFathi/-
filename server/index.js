require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const deliveriesRoutes = require('./routes/deliveries');
const importRoutes = require('./routes/import');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');
const queueRoutes = require('./routes/queue');
const contractorsRoutes = require('./routes/contractors');
const suppliersRoutes = require('./routes/suppliers');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
  crossOriginEmbedderPolicy: false,
  hsts: false // Disable HSTS for development
}));
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files with proper MIME types
app.use(express.static(path.join(__dirname, '../client/public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));



// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/deliveries', authenticateToken, deliveriesRoutes);
app.use('/api/import', authenticateToken, importRoutes);
app.use('/api/reports', authenticateToken, reportsRoutes);
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/queue', authenticateToken, queueRoutes);
app.use('/api/contractors', authenticateToken, contractorsRoutes);
app.use('/api/suppliers', authenticateToken, suppliersRoutes);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/index.html'));
});

// Error handling middleware
app.use(errorHandler);

// 404 handler - Serve index.html for frontend routes, JSON for API routes
app.use('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API route not found' });
  } else {
    // Serve index.html for frontend routes (SPA)
    res.sendFile(path.join(__dirname, '../client/public/index.html'));
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;

