const express = require('express');
const db = require('../database');
const { requireAccountant } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/suppliers - List all suppliers
router.get('/', requireAccountant, async (req, res) => {
  try {
    const suppliers = await db('suppliers')
      .select('*')
      .orderBy('name');

    res.json({ suppliers });

  } catch (error) {
    logger.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/suppliers/:id - Get supplier details
router.get('/:id', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await db('suppliers')
      .where('id', id)
      .first();

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({ supplier });

  } catch (error) {
    logger.error('Error fetching supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', requireAccountant, async (req, res) => {
  try {
    const { name, contact_info, address, material_type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const [supplierId] = await db('suppliers').insert({
      name,
      contact_info,
      address,
      material_type,
      created_at: new Date()
    });

    const supplier = await db('suppliers').where('id', supplierId).first();

    res.status(201).json({
      message: 'Supplier created successfully',
      supplier
    });

  } catch (error) {
    logger.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_info, address, material_type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const existingSupplier = await db('suppliers').where('id', id).first();
    if (!existingSupplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    await db('suppliers')
      .where('id', id)
      .update({
        name,
        contact_info,
        address,
        material_type,
        updated_at: new Date()
      });

    const updatedSupplier = await db('suppliers').where('id', id).first();

    res.json({
      message: 'Supplier updated successfully',
      supplier: updatedSupplier
    });

  } catch (error) {
    logger.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;

    const existingSupplier = await db('suppliers').where('id', id).first();
    if (!existingSupplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Check if supplier has deliveries
    const deliveryCount = await db('deliveries')
      .where('supplier_id', id)
      .count('* as count')
      .first();

    if (parseInt(deliveryCount.count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete supplier with existing deliveries' 
      });
    }

    await db('suppliers').where('id', id).del();

    res.json({ message: 'Supplier deleted successfully' });

  } catch (error) {
    logger.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
