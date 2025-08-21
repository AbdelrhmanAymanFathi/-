const express = require('express');
const db = require('../database');
const { requireAccountant } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/contractors - List all contractors
router.get('/', requireAccountant, async (req, res) => {
  try {
    const contractors = await db('contractors')
      .select('*')
      .orderBy('name');

    res.json({ contractors });

  } catch (error) {
    logger.error('Error fetching contractors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contractors/:id - Get contractor details
router.get('/:id', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;

    const contractor = await db('contractors')
      .where('id', id)
      .first();

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    res.json({ contractor });

  } catch (error) {
    logger.error('Error fetching contractor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contractors - Create new contractor
router.post('/', requireAccountant, async (req, res) => {
  try {
    const { name, contact_info, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Contractor name is required' });
    }

    const [contractorId] = await db('contractors').insert({
      name,
      contact_info,
      address,
      created_at: new Date()
    });

    const contractor = await db('contractors').where('id', contractorId).first();

    res.status(201).json({
      message: 'Contractor created successfully',
      contractor
    });

  } catch (error) {
    logger.error('Error creating contractor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/contractors/:id - Update contractor
router.put('/:id', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_info, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Contractor name is required' });
    }

    const existingContractor = await db('contractors').where('id', id).first();
    if (!existingContractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    await db('contractors')
      .where('id', id)
      .update({
        name,
        contact_info,
        address,
        updated_at: new Date()
      });

    const updatedContractor = await db('contractors').where('id', id).first();

    res.json({
      message: 'Contractor updated successfully',
      contractor: updatedContractor
    });

  } catch (error) {
    logger.error('Error updating contractor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/contractors/:id - Delete contractor
router.delete('/:id', requireAccountant, async (req, res) => {
  try {
    const { id } = req.params;

    const existingContractor = await db('contractors').where('id', id).first();
    if (!existingContractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    // Check if contractor has deliveries
    const deliveryCount = await db('deliveries')
      .where('contractor_id', id)
      .count('* as count')
      .first();

    if (parseInt(deliveryCount.count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete contractor with existing deliveries' 
      });
    }

    await db('contractors').where('id', id).del();

    res.json({ message: 'Contractor deleted successfully' });

  } catch (error) {
    logger.error('Error deleting contractor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
