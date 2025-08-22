const express = require('express');
const db = require('../database');
const { requireManager } = require('../middleware/auth');
const logger = require('../utils/logger');
const advancedReportService = require('../services/advancedReportService');

const router = express.Router();

// GET /api/reports/periods - Get available report periods
router.get('/periods', async (req, res) => {
  try {
    const periods = await advancedReportService.getAvailablePeriods();
    res.json({ periods });
  } catch (error) {
    logger.error('Error fetching report periods:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reports/generate - Generate period-based report
router.post('/generate', async (req, res) => {
  try {
    const { periodType, startDate, endDate, contractor_id, supplier_id } = req.body;

    if (!periodType || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Period type, start date, and end date are required' 
      });
    }

    // Validate period type
    const validPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validPeriods.includes(periodType)) {
      return res.status(400).json({ 
        error: 'Invalid period type. Must be one of: daily, weekly, monthly, yearly' 
      });
    }

    // Build filters
    const filters = {};
    if (contractor_id) filters.contractor_id = contractor_id;
    if (supplier_id) filters.supplier_id = supplier_id;

    // Generate the report
    const reportData = await advancedReportService.generatePeriodReport(
      periodType, 
      startDate, 
      endDate, 
      filters
    );

    res.json({
      message: 'Report generated successfully',
      report: reportData
    });

  } catch (error) {
    logger.error('Error generating period report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reports/export - Export report to Excel
router.post('/export', async (req, res) => {
  try {
    const { periodType, startDate, endDate, contractor_id, supplier_id } = req.body;

    if (!periodType || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Period type, start date, and end date are required' 
      });
    }

    // Build filters
    const filters = {};
    if (contractor_id) filters.contractor_id = contractor_id;
    if (supplier_id) filters.supplier_id = supplier_id;

    // Generate the report first
    const reportData = await advancedReportService.generatePeriodReport(
      periodType, 
      startDate, 
      endDate, 
      filters
    );

    // Export to Excel
    const excelBuffer = await advancedReportService.exportToExcel(reportData, periodType);

    // Set response headers for file download
    const filename = `تقرير_${periodType}_${startDate}_${endDate}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    res.send(excelBuffer);

  } catch (error) {
    logger.error('Error exporting Excel report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/quick-daily - Quick daily report (last 7 days)
router.get('/quick-daily', async (req, res) => {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const reportData = await advancedReportService.generatePeriodReport('daily', startDate, endDate, {});
    
    res.json({
      message: 'Daily report generated successfully',
      report: reportData
    });
  } catch (error) {
    logger.error('Error generating quick daily report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/quick-weekly - Quick weekly report (last 4 weeks)
router.get('/quick-weekly', async (req, res) => {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const reportData = await advancedReportService.generatePeriodReport('weekly', startDate, endDate, {});
    
    res.json({
      message: 'Weekly report generated successfully',
      report: reportData
    });
  } catch (error) {
    logger.error('Error generating quick weekly report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/quick-monthly - Quick monthly report (last 6 months)
router.get('/quick-monthly', async (req, res) => {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const reportData = await advancedReportService.generatePeriodReport('monthly', startDate, endDate, {});
    
    res.json({
      message: 'Monthly report generated successfully',
      report: reportData
    });
  } catch (error) {
    logger.error('Error generating quick monthly report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/quick-yearly - Quick yearly report (last 2 years)
router.get('/quick-yearly', async (req, res) => {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const reportData = await advancedReportService.generatePeriodReport('yearly', startDate, endDate, {});
    
    res.json({
      message: 'Yearly report generated successfully',
      report: reportData
    });
  } catch (error) {
    logger.error('Error generating quick yearly report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/summary - Get summary statistics
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start date and end date are required' 
      });
    }

    const summary = await advancedReportService.generateSummary(startDate, endDate);
    
    res.json({
      message: 'Summary generated successfully',
      summary
    });
  } catch (error) {
    logger.error('Error generating summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/period-breakdown - Get period breakdown
router.get('/period-breakdown', async (req, res) => {
  try {
    const { periodType, startDate, endDate } = req.query;
    
    if (!periodType || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Period type, start date, and end date are required' 
      });
    }

    const breakdown = await advancedReportService.generatePeriodBreakdown(
      periodType, 
      startDate, 
      endDate
    );
    
    res.json({
      message: 'Period breakdown generated successfully',
      breakdown
    });
  } catch (error) {
    logger.error('Error generating period breakdown:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/top-performers - Get top performers
router.get('/top-performers', async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start date and end date are required' 
      });
    }

    const performers = await advancedReportService.generateTopPerformers(
      startDate, 
      endDate, 
      parseInt(limit)
    );
    
    res.json({
      message: 'Top performers generated successfully',
      performers
    });
  } catch (error) {
    logger.error('Error generating top performers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/vehicle-performance - Get vehicle performance
router.get('/vehicle-performance', async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Start date and end date are required' 
      });
    }

    const performance = await advancedReportService.generateVehiclePerformance(
      startDate, 
      endDate, 
      parseInt(limit)
    );
    
    res.json({
      message: 'Vehicle performance generated successfully',
      performance
    });
  } catch (error) {
    logger.error('Error generating vehicle performance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

