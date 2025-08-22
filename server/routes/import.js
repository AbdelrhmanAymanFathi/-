const express = require('express');
const Joi = require('joi');
const excelImportService = require('../services/excelImportService');
const { requireAccountant } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const importSchema = Joi.object({
  sheetName: Joi.string().required(),
  headerRowIndex: Joi.number().integer().min(1).required(),
  columns: Joi.array().items(Joi.object({
    excel_column: Joi.string().required(),
    suggested_field: Joi.string().required(),
    field_type: Joi.string().required(),
    transform_rule: Joi.string().required(),
    required: Joi.boolean().required(),
    notes: Joi.string()
  })).required()
});

// POST /api/import/excel - Upload and analyze Excel file
router.post('/excel', excelImportService.getUploadMiddleware(), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Analyze the uploaded file
    const analysis = await excelImportService.analyzeFile(req.file.path);
    
    res.json({
      message: 'File analyzed successfully',
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path
      },
      analysis
    });

  } catch (error) {
    logger.error('Excel analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/import/analyze - Analyze Excel file (alias for excel endpoint)
router.post('/analyze', excelImportService.getUploadMiddleware(), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Analyze the uploaded file
    const analysis = await excelImportService.analyzeFile(req.file.path);
    
    res.json({
      message: 'File analyzed successfully',
      file: {
        originalname: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path
      },
      analysis
    });

  } catch (error) {
    logger.error('Excel analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/import/process - Process import with mapping
router.post('/process', async (req, res) => {
  try {
    // Validate mapping configuration
    const { error, value } = importSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { filePath, mapping } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Process the import
    const results = await excelImportService.importData(filePath, mapping, req.user.id);
    
    res.json({
      message: 'Import processed successfully',
      results
    });

  } catch (error) {
    logger.error('Import processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/import/batches - List import batches
router.get('/batches', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = excelImportService.db('import_batches')
      .select('*')
      .orderBy('created_at', 'desc');

    if (status) {
      query = query.where('status', status);
    }

    const batches = await query.limit(limit).offset(offset);
    const total = await excelImportService.db('import_batches').count('* as count').first();

    res.json({
      batches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching import batches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/import/history - Get import history
router.get('/history', async (req, res) => {
  try {
    const batches = await excelImportService.db('import_batches')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(50);

    res.json(batches);
  } catch (error) {
    logger.error('Error fetching import history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/import/batches/:id - Get import batch details
router.get('/batches/:id', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;
    
    const batch = await excelImportService.db('import_batches')
      .where('id', id)
      .first();

    if (!batch) {
      return res.status(404).json({ error: 'Import batch not found' });
    }

    // Get conflicts for this batch
    const conflicts = await excelImportService.db('import_conflicts')
      .where('batch_id', id)
      .orderBy('created_at', 'desc');

    res.json({
      batch,
      conflicts
    });

  } catch (error) {
    logger.error('Error fetching import batch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/import/conflicts - List import conflicts
router.get('/conflicts', requireAccountant, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, batch_id } = req.query;
    const offset = (page - 1) * limit;

    let query = excelImportService.db('import_conflicts')
      .select('import_conflicts.*', 'import_batches.filename')
      .join('import_batches', 'import_conflicts.batch_id', 'import_batches.id')
      .orderBy('import_conflicts.created_at', 'desc');

    if (status) {
      query = query.where('import_conflicts.status', status);
    }

    if (batch_id) {
      query = query.where('import_conflicts.batch_id', batch_id);
    }

    const conflicts = await query.limit(limit).offset(offset);
    const total = await query.count('* as count').first();

    res.json({
      conflicts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching import conflicts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/import/conflicts/:id/resolve - Resolve import conflict
router.put('/conflicts/:id/resolve', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, resolution_data } = req.body;

    const conflict = await excelImportService.db('import_conflicts')
      .where('id', id)
      .first();

    if (!conflict) {
      return res.status(404).json({ error: 'Conflict not found' });
    }

    // Update conflict status
    await excelImportService.db('import_conflicts')
      .where('id', id)
      .update({
        status: 'resolved',
        resolved_by: req.user.id,
        resolved_at: new Date()
      });

    // Handle resolution based on action
    if (action === 'import' && resolution_data) {
      // Import the resolved data
      const deliveryId = await excelImportService.insertDelivery(
        resolution_data,
        req.user.id,
        conflict.source_sheet || 'resolved',
        conflict.delivery_row
      );

      // Recompute fields
      await excelImportService.recomputeService.recomputeDependentFields(deliveryId);
    }

    res.json({
      message: 'Conflict resolved successfully',
      conflict_id: id,
      action
    });

  } catch (error) {
    logger.error('Error resolving conflict:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

