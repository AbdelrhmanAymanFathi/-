const express = require('express');
const Joi = require('joi');
const db = require('../database');
const recomputeService = require('../services/recomputeService');
const { requireAccountant } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const deliverySchema = Joi.object({
  date: Joi.date().required(),
  contractor_id: Joi.number().integer().positive(),
  supplier_id: Joi.number().integer().positive(),
  vehicle_no: Joi.string().max(50),
  company_voucher_no: Joi.string().max(100),
  volume: Joi.number().precision(3),
  unit: Joi.string().max(20),
  unit_price: Joi.number().precision(2),
  gross_value: Joi.number().precision(2),
  discount: Joi.number().precision(2).default(0),
  net_value: Joi.number().precision(2),
  item_description: Joi.string().max(500)
});

const updateDeliverySchema = deliverySchema.keys({
  id: Joi.number().integer().positive().required()
});

// GET /api/deliveries - List deliveries with filters
router.get('/', requireAccountant, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      from_date,
      to_date,
      contractor_id,
      supplier_id,
      vehicle_no,
      has_conflicts,
      search
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

    if (has_conflicts === 'true') {
      query = query.whereExists(function() {
        this.select('*')
          .from('import_conflicts')
          .whereRaw('import_conflicts.delivery_row = deliveries.original_row_index')
          .andWhere('import_conflicts.status', 'pending');
      });
    }

    if (search) {
      query = query.where(function() {
        this.where('deliveries.company_voucher_no', 'like', `%${search}%`)
          .orWhere('deliveries.item_description', 'like', `%${search}%`)
          .orWhere('contractors.name', 'like', `%${search}%`)
          .orWhere('suppliers.name', 'like', `%${search}%`);
      });
    }

    // Get total count for pagination
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
    logger.error('Error fetching deliveries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/deliveries/:id - Get delivery details
router.get('/:id', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;

    const delivery = await db('deliveries')
      .select(
        'deliveries.*',
        'contractors.name as contractor_name',
        'suppliers.name as supplier_name',
        'users.name as created_by_name'
      )
      .leftJoin('contractors', 'deliveries.contractor_id', 'contractors.id')
      .leftJoin('suppliers', 'deliveries.supplier_id', 'suppliers.id')
      .leftJoin('users', 'deliveries.created_by', 'users.id')
      .where('deliveries.id', id)
      .first();

    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    res.json({ delivery });

  } catch (error) {
    logger.error('Error fetching delivery:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/deliveries - Create new delivery
router.post('/', requireAccountant, async (req, res) => {
  try {
    // Validate input
    const { error, value } = deliverySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Insert delivery
    const [deliveryId] = await db('deliveries').insert({
      ...value,
      created_by: req.user.id,
      created_at: new Date()
    });

    // Recompute dependent fields
    const updatedDelivery = await recomputeService.recomputeDependentFields(deliveryId);

    // Log the creation
    await db('audit_logs').insert({
      user_id: req.user.id,
      action: 'create',
      table_name: 'deliveries',
      record_id: deliveryId,
      changes: JSON.stringify(value),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.status(201).json({
      message: 'Delivery created successfully',
      delivery: updatedDelivery
    });

  } catch (error) {
    logger.error('Error creating delivery:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/deliveries/:id - Update delivery
router.put('/:id', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate input
    const { error, value } = updateDeliverySchema.validate({ ...req.body, id });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if delivery exists
    const existingDelivery = await db('deliveries').where('id', id).first();
    if (!existingDelivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    // Update delivery
    await db('deliveries')
      .where('id', id)
      .update({
        ...value,
        updated_at: new Date()
      });

    // Recompute dependent fields
    const updatedDelivery = await recomputeService.recomputeDependentFields(id);

    // Log the update
    await db('audit_logs').insert({
      user_id: req.user.id,
      action: 'update',
      table_name: 'deliveries',
      record_id: id,
      changes: JSON.stringify({
        previous: existingDelivery,
        new: value
      }),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      message: 'Delivery updated successfully',
      delivery: updatedDelivery
    });

  } catch (error) {
    logger.error('Error updating delivery:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/deliveries/:id - Soft delete delivery
router.delete('/:id', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if delivery exists
    const existingDelivery = await db('deliveries').where('id', id).first();
    if (!existingDelivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    // Soft delete (mark as deleted)
    await db('deliveries')
      .where('id', id)
      .update({
        deleted_at: new Date(),
        updated_at: new Date()
      });

    // Log the deletion
    await db('audit_logs').insert({
      user_id: req.user.id,
      action: 'delete',
      table_name: 'deliveries',
      record_id: id,
      changes: JSON.stringify({ deleted: true }),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({ message: 'Delivery deleted successfully' });

  } catch (error) {
    logger.error('Error deleting delivery:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/deliveries/:id/recompute - Manually recompute fields
router.post('/:id/recompute', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if delivery exists
    const existingDelivery = await db('deliveries').where('id', id).first();
    if (!existingDelivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    // Recompute dependent fields
    const updatedDelivery = await recomputeService.recomputeDependentFields(id);

    res.json({
      message: 'Fields recomputed successfully',
      delivery: updatedDelivery
    });

  } catch (error) {
    logger.error('Error recomputing delivery fields:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

