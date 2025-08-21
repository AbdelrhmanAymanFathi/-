const express = require('express');
const db = require('../database');
const { requireManager } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/users/activity - Get user activity summary
router.get('/activity', requireManager, async (req, res) => {
  try {
    const { from_date, to_date, user_id } = req.query;

    // Build base query
    let query = db('audit_logs').select('*');

    // Apply date filters
    if (from_date && to_date) {
      query = query.whereBetween('created_at', [from_date, to_date]);
    } else if (from_date) {
      query = query.where('created_at', '>=', from_date);
    } else if (to_date) {
      query = query.where('created_at', '<=', to_date);
    }

    if (user_id) {
      query = query.where('user_id', user_id);
    }

    // Get user activity summary
    const userActivity = await query
      .select(
        'users.name as user_name',
        'users.email as user_email',
        'users.role as user_role',
        db.raw('COUNT(*) as total_actions'),
        db.raw('COUNT(CASE WHEN action = "create" THEN 1 END) as create_count'),
        db.raw('COUNT(CASE WHEN action = "update" THEN 1 END) as update_count'),
        db.raw('COUNT(CASE WHEN action = "delete" THEN 1 END) as delete_count'),
        db.raw('COUNT(CASE WHEN action = "import" THEN 1 END) as import_count'),
        db.raw('MAX(created_at) as last_activity')
      )
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .groupBy('users.id', 'users.name', 'users.email', 'users.role')
      .orderBy('total_actions', 'desc');

    // Get recent activity by user
    const recentActivity = await db('audit_logs')
      .select(
        'audit_logs.*',
        'users.name as user_name',
        'users.email as user_email'
      )
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .orderBy('audit_logs.created_at', 'desc')
      .limit(50);

    res.json({
      user_activity: userActivity,
      recent_activity: recentActivity
    });

  } catch (error) {
    logger.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users - List all users
router.get('/', requireManager, async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'name', 'email', 'role', 'created_at')
      .orderBy('name');

    res.json({ users });

  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id - Get user details
router.get('/:id', requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await db('users')
      .select('id', 'name', 'email', 'role', 'created_at')
      .where('id', id)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's recent activity
    const recentActivity = await db('audit_logs')
      .select('*')
      .where('user_id', id)
      .orderBy('created_at', 'desc')
      .limit(20);

    // Get user's delivery count
    const deliveryCount = await db('deliveries')
      .where('created_by', id)
      .count('* as count')
      .first();

    res.json({
      user: {
        ...user,
        delivery_count: parseInt(deliveryCount.count) || 0
      },
      recent_activity: recentActivity
    });

  } catch (error) {
    logger.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id/deliveries - Get user's deliveries
router.get('/:id/deliveries', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, from_date, to_date } = req.query;
    const offset = (page - 1) * limit;

    // Check if user exists
    const user = await db('users').where('id', id).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build query for user's deliveries
    let query = db('deliveries')
      .select(
        'deliveries.*',
        'contractors.name as contractor_name',
        'suppliers.name as supplier_name'
      )
      .leftJoin('contractors', 'deliveries.contractor_id', 'contractors.id')
      .leftJoin('suppliers', 'deliveries.supplier_id', 'suppliers.id')
      .where('deliveries.created_by', id)
      .orderBy('deliveries.date', 'desc');

    // Apply date filters
    if (from_date && to_date) {
      query = query.whereBetween('deliveries.date', [from_date, to_date]);
    } else if (from_date) {
      query = query.where('deliveries.date', '>=', from_date);
    } else if (to_date) {
      query = query.where('deliveries.date', '<=', to_date);
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.count('* as count').first();

    // Apply pagination
    const deliveries = await query.limit(limit).offset(offset);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      deliveries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching user deliveries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id/imports - Get user's import batches
router.get('/:id/imports', requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    // Check if user exists
    const user = await db('users').where('id', id).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build query for user's import batches
    let query = db('import_batches')
      .where('created_by', id)
      .orderBy('created_at', 'desc');

    if (status) {
      query = query.where('status', status);
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.count('* as count').first();

    // Apply pagination
    const imports = await query.limit(limit).offset(offset);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      imports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching user imports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/stats - Get overall user statistics
router.get('/stats/overview', requireManager, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    // Build base query
    let baseQuery = db('audit_logs').select('*');

    // Apply date filters
    if (from_date && to_date) {
      baseQuery = baseQuery.whereBetween('created_at', [from_date, to_date]);
    } else if (from_date) {
      baseQuery = baseQuery.where('created_at', '>=', from_date);
    } else if (to_date) {
      baseQuery = baseQuery.where('created_at', '<=', to_date);
    }

    // Get overall statistics
    const overallStats = await baseQuery
      .select(
        db.raw('COUNT(DISTINCT user_id) as active_users'),
        db.raw('COUNT(*) as total_actions'),
        db.raw('COUNT(CASE WHEN action = "create" THEN 1 END) as total_creates'),
        db.raw('COUNT(CASE WHEN action = "update" THEN 1 END) as total_updates'),
        db.raw('COUNT(CASE WHEN action = "delete" THEN 1 END) as total_deletes'),
        db.raw('COUNT(CASE WHEN action = "import" THEN 1 END) as total_imports')
      )
      .first();

    // Get user role distribution
    const roleDistribution = await db('users')
      .select('role', db.raw('COUNT(*) as count'))
      .groupBy('role');

    // Get most active users
    const mostActiveUsers = await baseQuery
      .select(
        'users.name as user_name',
        'users.role as user_role',
        db.raw('COUNT(*) as action_count')
      )
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .groupBy('users.id', 'users.name', 'users.role')
      .orderBy('action_count', 'desc')
      .limit(10);

    // Get daily activity trend
    const dailyTrend = await baseQuery
      .select(
        db.raw('DATE(created_at) as date'),
        db.raw('COUNT(*) as action_count'),
        db.raw('COUNT(DISTINCT user_id) as active_users')
      )
      .groupBy('date')
      .orderBy('date', 'desc')
      .limit(30);

    res.json({
      overall: {
        active_users: parseInt(overallStats.active_users) || 0,
        total_actions: parseInt(overallStats.total_actions) || 0,
        total_creates: parseInt(overallStats.total_creates) || 0,
        total_updates: parseInt(overallStats.total_updates) || 0,
        total_deletes: parseInt(overallStats.total_deletes) || 0,
        total_imports: parseInt(overallStats.total_imports) || 0
      },
      role_distribution: roleDistribution,
      most_active_users: mostActiveUsers,
      daily_trend: dailyTrend
    });

  } catch (error) {
    logger.error('Error fetching user statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

