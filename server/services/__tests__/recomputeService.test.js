const recomputeService = require('../recomputeService');

// Mock database
jest.mock('../../database', () => ({
  __esModule: true,
  default: {
    raw: jest.fn(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    first: jest.fn(),
    then: jest.fn()
  }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

describe('RecomputeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateFields', () => {
    it('should calculate gross_value when volume and unit_price are provided', () => {
      const delivery = {
        volume: 10,
        unit_price: 5.50,
        discount: 2.00
      };

      const result = recomputeService.calculateFields(delivery);

      expect(result.gross_value).toBe(55.00);
      expect(result.net_value).toBe(53.00);
    });

    it('should calculate net_value when gross_value and discount are provided', () => {
      const delivery = {
        volume: 10,
        unit_price: 5.50,
        gross_value: 55.00,
        discount: 2.00
      };

      const result = recomputeService.calculateFields(delivery);

      expect(result.net_value).toBe(53.00);
    });

    it('should calculate gross_value when net_value and discount are provided', () => {
      const delivery = {
        net_value: 53.00,
        discount: 2.00
      };

      const result = recomputeService.calculateFields(delivery);

      expect(result.gross_value).toBe(55.00);
    });

    it('should handle null values gracefully', () => {
      const delivery = {
        volume: null,
        unit_price: 5.50,
        discount: 2.00
      };

      const result = recomputeService.calculateFields(delivery);

      expect(result.gross_value).toBeUndefined();
      expect(result.net_value).toBeUndefined();
    });

    it('should handle zero values correctly', () => {
      const delivery = {
        volume: 0,
        unit_price: 5.50,
        discount: 0
      };

      const result = recomputeService.calculateFields(delivery);

      expect(result.gross_value).toBe(0.00);
      expect(result.net_value).toBe(0.00);
    });

    it('should round decimal values to 2 places', () => {
      const delivery = {
        volume: 3.333,
        unit_price: 2.222,
        discount: 1.111
      };

      const result = recomputeService.calculateFields(delivery);

      expect(result.gross_value).toBe(7.40); // 3.333 * 2.222 = 7.40
      expect(result.net_value).toBe(6.29); // 7.40 - 1.111 = 6.29
    });
  });

  describe('recomputeDependentFields', () => {
    it('should throw error when delivery not found', async () => {
      const mockDb = require('../../database').default;
      mockDb.where.mockReturnValue({
        first: jest.fn().mockResolvedValue(null)
      });

      await expect(recomputeService.recomputeDependentFields(999))
        .rejects
        .toThrow('Delivery with ID 999 not found');
    });

    it('should update delivery with calculated fields', async () => {
      const mockDelivery = {
        id: 1,
        volume: 10,
        unit_price: 5.50,
        discount: 2.00,
        created_by: 1
      };

      const mockDb = require('../../database').default;
      mockDb.where.mockReturnValue({
        first: jest.fn().mockResolvedValue(mockDelivery),
        update: jest.fn().mockResolvedValue(1)
      });

      mockDb.insert.mockResolvedValue(1);

      const result = await recomputeService.recomputeDependentFields(1);

      expect(mockDb.update).toHaveBeenCalledWith({
        gross_value: 55.00,
        net_value: 53.00,
        updated_at: expect.any(Date)
      });

      expect(result.gross_value).toBe(55.00);
      expect(result.net_value).toBe(53.00);
    });
  });

  describe('recomputeDateRange', () => {
    it('should recompute all deliveries in date range', async () => {
      const mockDeliveries = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];

      const mockDb = require('../../database').default;
      mockDb.whereBetween.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockDeliveries)
      });

      // Mock the recomputeDependentFields method
      const originalRecompute = recomputeService.recomputeDependentFields;
      recomputeService.recomputeDependentFields = jest.fn().mockResolvedValue({});

      const result = await recomputeService.recomputeDateRange('2024-01-01', '2024-01-31');

      expect(result).toBe(3);
      expect(recomputeService.recomputeDependentFields).toHaveBeenCalledTimes(3);

      // Restore original method
      recomputeService.recomputeDependentFields = originalRecompute;
    });
  });

  describe('recomputeBySupplier', () => {
    it('should recompute all deliveries for a supplier', async () => {
      const mockDeliveries = [
        { id: 1 },
        { id: 2 }
      ];

      const mockDb = require('../../database').default;
      mockDb.where.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockDeliveries)
      });

      // Mock the recomputeDependentFields method
      const originalRecompute = recomputeService.recomputeDependentFields;
      recomputeService.recomputeDependentFields = jest.fn().mockResolvedValue({});

      const result = await recomputeService.recomputeBySupplier(1);

      expect(result).toBe(2);
      expect(recomputeService.recomputeDependentFields).toHaveBeenCalledTimes(2);

      // Restore original method
      recomputeService.recomputeDependentFields = originalRecompute;
    });
  });
});

