const db = require('../database');
const logger = require('../utils/logger');

class RecomputeService {
  /**
   * Recompute dependent fields for a delivery record
   * @param {number} deliveryId - ID of the delivery record
   * @returns {Promise<Object>} - Updated delivery record
   */
  async recomputeDependentFields(deliveryId) {
    try {
      // Get the delivery record
      const delivery = await db('deliveries')
        .where('id', deliveryId)
        .first();

      if (!delivery) {
        throw new Error(`Delivery with ID ${deliveryId} not found`);
      }

      // Calculate dependent fields
      const updatedFields = this.calculateFields(delivery);

      // Update the record
      await db('deliveries')
        .where('id', deliveryId)
        .update({
          ...updatedFields,
          updated_at: new Date()
        });

      // Log the recalculation
      await db('audit_logs').insert({
        user_id: delivery.created_by,
        action: 'update',
        table_name: 'deliveries',
        record_id: deliveryId,
        changes: JSON.stringify({
          action: 'recomputed_fields',
          previous_values: {
            gross_value: delivery.gross_value,
            net_value: delivery.net_value
          },
          new_values: updatedFields
        })
      });

      logger.info(`Recomputed fields for delivery ${deliveryId}`, updatedFields);

      return {
        ...delivery,
        ...updatedFields
      };

    } catch (error) {
      logger.error(`Error recomputing fields for delivery ${deliveryId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate dependent fields based on Excel-like formulas
   * @param {Object} delivery - Delivery record
   * @returns {Object} - Calculated fields
   */
  calculateFields(delivery) {
    const calculated = {};

    // Formula 1: gross_value = volume * unit_price
    if (delivery.volume !== null && delivery.unit_price !== null) {
      calculated.gross_value = parseFloat((delivery.volume * delivery.unit_price).toFixed(2));
    }

    // Formula 2: net_value = gross_value - discount
    if (calculated.gross_value !== undefined && delivery.discount !== null) {
      calculated.net_value = parseFloat((calculated.gross_value - delivery.discount).toFixed(2));
    } else if (delivery.gross_value !== null && delivery.discount !== null) {
      calculated.net_value = parseFloat((delivery.gross_value - delivery.discount).toFixed(2));
    }

    // Formula 3: If only net_value is provided, calculate gross_value
    if (delivery.net_value !== null && delivery.discount !== null && !calculated.gross_value) {
      calculated.gross_value = parseFloat((delivery.net_value + delivery.discount).toFixed(2));
    }

    // Formula 4: If only gross_value is provided, calculate net_value
    if (delivery.gross_value !== null && delivery.discount !== null && !calculated.net_value) {
      calculated.net_value = parseFloat((delivery.gross_value - delivery.discount).toFixed(2));
    }

    return calculated;
  }

  /**
   * Recompute all deliveries in a date range
   * @param {string} fromDate - Start date (YYYY-MM-DD)
   * @param {string} toDate - End date (YYYY-MM-DD)
   * @returns {Promise<number>} - Number of records updated
   */
  async recomputeDateRange(fromDate, toDate) {
    try {
      const deliveries = await db('deliveries')
        .whereBetween('date', [fromDate, toDate])
        .select('id');

      let updatedCount = 0;
      for (const delivery of deliveries) {
        try {
          await this.recomputeDependentFields(delivery.id);
          updatedCount++;
        } catch (error) {
          logger.error(`Failed to recompute delivery ${delivery.id}:`, error);
        }
      }

      logger.info(`Recomputed ${updatedCount} deliveries from ${fromDate} to ${toDate}`);
      return updatedCount;

    } catch (error) {
      logger.error('Error recomputing date range:', error);
      throw error;
    }
  }

  /**
   * Recompute all deliveries for a specific supplier
   * @param {number} supplierId - Supplier ID
   * @returns {Promise<number>} - Number of records updated
   */
  async recomputeBySupplier(supplierId) {
    try {
      const deliveries = await db('deliveries')
        .where('supplier_id', supplierId)
        .select('id');

      let updatedCount = 0;
      for (const delivery of deliveries) {
        try {
          await this.recomputeDependentFields(delivery.id);
          updatedCount++;
        } catch (error) {
          logger.error(`Failed to recompute delivery ${delivery.id}:`, error);
        }
      }

      logger.info(`Recomputed ${updatedCount} deliveries for supplier ${supplierId}`);
      return updatedCount;

    } catch (error) {
      logger.error('Error recomputing by supplier:', error);
      throw error;
    }
  }
}

module.exports = new RecomputeService();

