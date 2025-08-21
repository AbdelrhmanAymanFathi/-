const express = require('express');
const db = require('../database');
const { requireManager } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/reports/summary - Get summary statistics
router.get('/summary', requireManager, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    // Build base query
    let query = db('deliveries').select('*');

    // Apply date filters
    if (from_date && to_date) {
      query = query.whereBetween('date', [from_date, to_date]);
    } else if (from_date) {
      query = query.where('date', '>=', from_date);
    } else if (to_date) {
      query = query.where('date', '<=', to_date);
    }

    // Get total counts and values
    const summary = await query
      .select(
        db.raw('COUNT(*) as total_deliveries'),
        db.raw('SUM(volume) as total_volume'),
        db.raw('SUM(gross_value) as total_gross_value'),
        db.raw('SUM(net_value) as total_net_value'),
        db.raw('SUM(discount) as total_discount')
      )
      .first();

    // Get top suppliers by volume
    const topSuppliers = await query
      .select(
        'suppliers.name as supplier_name',
        db.raw('SUM(deliveries.volume) as total_volume'),
        db.raw('SUM(deliveries.net_value) as total_value'),
        db.raw('COUNT(*) as delivery_count')
      )
      .leftJoin('suppliers', 'deliveries.supplier_id', 'suppliers.id')
      .groupBy('suppliers.id', 'suppliers.name')
      .orderBy('total_volume', 'desc')
      .limit(10);

    // Get top contractors by value
    const topContractors = await query
      .select(
        'contractors.name as contractor_name',
        db.raw('SUM(deliveries.net_value) as total_value'),
        db.raw('COUNT(*) as delivery_count')
      )
      .leftJoin('contractors', 'deliveries.contractor_id', 'contractors.id')
      .groupBy('contractors.id', 'contractors.name')
      .orderBy('total_value', 'desc')
      .limit(10);

    // Get monthly trends
    const monthlyTrends = await query
      .select(
        db.raw('strftime("%Y-%m", date) as month'),
        db.raw('COUNT(*) as delivery_count'),
        db.raw('SUM(volume) as total_volume'),
        db.raw('SUM(net_value) as total_value')
      )
      .groupBy('month')
      .orderBy('month', 'desc')
      .limit(12);

    res.json({
      summary: {
        total_deliveries: parseInt(summary.total_deliveries) || 0,
        total_volume: parseFloat(summary.total_volume) || 0,
        total_gross_value: parseFloat(summary.total_gross_value) || 0,
        total_net_value: parseFloat(summary.total_net_value) || 0,
        total_discount: parseFloat(summary.total_discount) || 0
      },
      top_suppliers: topSuppliers,
      top_contractors: topContractors,
      monthly_trends: monthlyTrends
    });

  } catch (error) {
    logger.error('Error generating summary report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/deliveries - Get detailed delivery report
router.get('/deliveries', requireManager, async (req, res) => {
  try {
    const {
      from_date,
      to_date,
      contractor_id,
      supplier_id,
      vehicle_no,
      page = 1,
      limit = 100
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query
    let query = db('deliveries')
      .select(
        'deliveries.*',
        'contractors.name as contractor_name',
        'suppliers.name as supplier_name',
        'users.name as created_by_name'
      )
      .leftJoin('contractors', 'deliveries.contractor_id', 'contractors.id')
      .leftJoin('suppliers', 'deliveries.supplier_id', 'suppliers.id')
      .leftJoin('users', 'deliveries.created_by', 'users.id')
      .orderBy('deliveries.date', 'desc');

    // Apply filters
    if (from_date && to_date) {
      query = query.whereBetween('deliveries.date', [from_date, to_date]);
    } else if (from_date) {
      query = query.where('deliveries.date', '>=', from_date);
    } else if (to_date) {
      query = query.where('deliveries.date', '<=', to_date);
    }

    if (contractor_id) {
      query = query.where('deliveries.contractor_id', contractor_id);
    }

    if (supplier_id) {
      query = query.where('deliveries.supplier_id', supplier_id);
    }

    if (vehicle_no) {
      query = query.where('deliveries.vehicle_no', 'like', `%${vehicle_no}%`);
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.count('* as count').first();

    // Apply pagination
    const deliveries = await query.limit(limit).offset(offset);

    res.json({
      deliveries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    });

  } catch (error) {
    logger.error('Error generating delivery report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/conflicts - Get conflict report
router.get('/conflicts', requireManager, async (req, res) => {
  try {
    const {
      from_date,
      to_date,
      status,
      reason,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query
    let query = db('import_conflicts')
      .select(
        'import_conflicts.*',
        'import_batches.filename',
        'import_batches.created_at as batch_created_at',
        'users.name as resolved_by_name'
      )
      .leftJoin('import_batches', 'import_conflicts.batch_id', 'import_batches.id')
      .leftJoin('users', 'import_conflicts.resolved_by', 'users.id')
      .orderBy('import_conflicts.created_at', 'desc');

    // Apply filters
    if (from_date && to_date) {
      query = query.whereBetween('import_batches.created_at', [from_date, to_date]);
    } else if (from_date) {
      query = query.where('import_batches.created_at', '>=', from_date);
    } else if (to_date) {
      query = query.where('import_batches.created_at', '<=', to_date);
    }

    if (status) {
      query = query.where('import_conflicts.status', status);
    }

    if (reason) {
      query = query.where('import_conflicts.reason', reason);
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.count('* as count').first();

    // Apply pagination
    const conflicts = await query.limit(limit).offset(offset);

    // Get conflict statistics
    const conflictStats = await db('import_conflicts')
      .select(
        'reason',
        'status',
        db.raw('COUNT(*) as count')
      )
      .groupBy('reason', 'status');

    res.json({
      conflicts,
      statistics: conflictStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    });

  } catch (error) {
    logger.error('Error generating conflict report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/activity - Get user activity report
router.get('/activity', requireManager, async (req, res) => {
  try {
    const {
      from_date,
      to_date,
      user_id,
      action,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query
    let query = db('audit_logs')
      .select(
        'audit_logs.*',
        'users.name as user_name',
        'users.email as user_email'
      )
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .orderBy('audit_logs.created_at', 'desc');

    // Apply filters
    if (from_date && to_date) {
      query = query.whereBetween('audit_logs.created_at', [from_date, to_date]);
    } else if (from_date) {
      query = query.where('audit_logs.created_at', '>=', from_date);
    } else if (to_date) {
      query = query.where('audit_logs.created_at', '<=', to_date);
    }

    if (user_id) {
      query = query.where('audit_logs.user_id', user_id);
    }

    if (action) {
      query = query.where('audit_logs.action', action);
    }

    // Get total count
    const totalQuery = query.clone();
    const total = await totalQuery.count('* as count').first();

    // Apply pagination
    const activities = await query.limit(limit).offset(offset);

    // Get activity statistics
    const activityStats = await db('audit_logs')
      .select(
        'action',
        db.raw('COUNT(*) as count')
      )
      .groupBy('action');

    const userStats = await db('audit_logs')
      .select(
        'users.name as user_name',
        db.raw('COUNT(*) as action_count')
      )
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .groupBy('users.id', 'users.name')
      .orderBy('action_count', 'desc')
      .limit(10);

    res.json({
      activities,
      statistics: {
        by_action: activityStats,
        by_user: userStats
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    });

  } catch (error) {
    logger.error('Error generating activity report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/export - Export report data
router.get('/export', requireManager, async (req, res) => {
  try {
    const { report_type, from_date, to_date, format = 'json' } = req.query;

    if (!report_type) {
      return res.status(400).json({ error: 'Report type is required' });
    }

    let data;
    let filename;

    switch (report_type) {
      case 'deliveries':
        data = await generateDeliveriesExport(from_date, to_date);
        filename = `deliveries_${from_date || 'all'}_${to_date || 'all'}.${format}`;
        break;
      
      case 'summary':
        data = await generateSummaryExport(from_date, to_date);
        filename = `summary_${from_date || 'all'}_${to_date || 'all'}.${format}`;
        break;
      
      case 'conflicts':
        data = await generateConflictsExport(from_date, to_date);
        filename = `conflicts_${from_date || 'all'}_${to_date || 'all'}.${format}`;
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    // Set response headers for download
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'csv') {
      res.send(convertToCSV(data));
    } else {
      res.json(data);
    }

  } catch (error) {
    logger.error('Error exporting report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions for export
async function generateDeliveriesExport(fromDate, toDate) {
  let query = db('deliveries')
    .select(
      'deliveries.*',
      'contractors.name as contractor_name',
      'suppliers.name as supplier_name',
      'users.name as created_by_name'
    )
    .leftJoin('contractors', 'deliveries.contractor_id', 'contractors.id')
    .leftJoin('suppliers', 'deliveries.supplier_id', 'suppliers.id')
    .leftJoin('users', 'deliveries.created_by', 'users.id')
    .orderBy('deliveries.date', 'desc');

  if (fromDate && toDate) {
    query = query.whereBetween('deliveries.date', [fromDate, toDate]);
  }

  return await query;
}

async function generateSummaryExport(fromDate, toDate) {
  // Implementation similar to summary report
  return { message: 'Summary export not implemented yet' };
}

async function generateConflictsExport(fromDate, toDate) {
  let query = db('import_conflicts')
    .select(
      'import_conflicts.*',
      'import_batches.filename'
    )
    .leftJoin('import_batches', 'import_conflicts.batch_id', 'import_batches.id')
    .orderBy('import_conflicts.created_at', 'desc');

  if (fromDate && toDate) {
    query = query.whereBetween('import_batches.created_at', [fromDate, toDate]);
  }

  return await query;
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

module.exports = router;

