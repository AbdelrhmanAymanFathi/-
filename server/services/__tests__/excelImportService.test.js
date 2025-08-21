const ExcelImportService = require('../excelImportService');
const path = require('path');
const fs = require('fs');

// Mock dependencies
jest.mock('../../database');
jest.mock('../../utils/logger');

describe('ExcelImportService Integration Tests', () => {
    let excelImportService;
    let mockDb;
    let mockLogger;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup mock database
        mockDb = {
            transaction: jest.fn(),
            insert: jest.fn(),
            select: jest.fn(),
            where: jest.fn(),
            update: jest.fn()
        };
        
        // Setup mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        };
        
        // Mock the database module
        const dbModule = require('../../database');
        dbModule.getDb = jest.fn().mockReturnValue(mockDb);
        
        // Mock the logger module
        const loggerModule = require('../../utils/logger');
        loggerModule.logger = mockLogger;
        
        excelImportService = new ExcelImportService();
    });
    
    describe('File Analysis Integration', () => {
        test('should analyze Excel file and suggest mapping', async () => {
            // Create a temporary test Excel file
            const testFilePath = path.join(__dirname, 'test_data.xlsx');
            const testData = [
                ['Date', 'Contractor', 'Supplier', 'Volume', 'Unit Price', 'Description'],
                ['2024-01-01', 'Contractor A', 'Supplier X', '100', '50.00', 'Material A'],
                ['2024-01-02', 'Contractor B', 'Supplier Y', '200', '75.50', 'Material B']
            ];
            
            // Mock XLSX module
            const mockXLSX = {
                readFile: jest.fn().mockReturnValue({
                    Sheets: {
                        'Sheet1': {
                            'A1': { v: 'Date' },
                            'B1': { v: 'Contractor' },
                            'C1': { v: 'Supplier' },
                            'D1': { v: 'Volume' },
                            'E1': { v: 'Unit Price' },
                            'F1': { v: 'Description' },
                            'A2': { v: '2024-01-01' },
                            'B2': { v: 'Contractor A' },
                            'C2': { v: 'Supplier X' },
                            'D2': { v: '100' },
                            'E2': { v: '50.00' },
                            'F2': { v: 'Material A' }
                        }
                    },
                    SheetNames: ['Sheet1']
                }),
                utils: {
                    sheet_to_json: jest.fn().mockReturnValue([
                        { Date: '2024-01-01', Contractor: 'Contractor A', Supplier: 'Supplier X', Volume: '100', 'Unit Price': '50.00', Description: 'Material A' },
                        { Date: '2024-01-02', Contractor: 'Contractor B', Supplier: 'Supplier Y', Volume: '200', 'Unit Price': '75.50', Description: 'Material B' }
                    ])
                }
            };
            
            // Mock the xlsx module
            jest.doMock('xlsx', () => mockXLSX);
            
            const result = await excelImportService.analyzeFile(testFilePath);
            
            expect(result.success).toBe(true);
            expect(result.mapping).toBeDefined();
            expect(result.preview).toBeDefined();
            expect(result.preview.length).toBe(2);
            
            // Verify suggested mapping
            expect(result.mapping['Date']).toBe('date');
            expect(result.mapping['Contractor']).toBe('contractor_id');
            expect(result.mapping['Supplier']).toBe('supplier_id');
            expect(result.mapping['Volume']).toBe('volume');
            expect(result.mapping['Unit Price']).toBe('unit_price');
            expect(result.mapping['Description']).toBe('item_description');
        });
        
        test('should handle Excel file with different date formats', async () => {
            const mockXLSX = {
                readFile: jest.fn().mockReturnValue({
                    Sheets: {
                        'Sheet1': {
                            'A1': { v: 'Date' },
                            'B1': { v: 'Value' },
                            'A2': { v: '01/15/2024' },
                            'B2': { v: '100' },
                            'A3': { v: '2024-03-20' },
                            'B3': { v: '200' }
                        }
                    },
                    SheetNames: ['Sheet1']
                }),
                utils: {
                    sheet_to_json: jest.fn().mockReturnValue([
                        { Date: '01/15/2024', Value: '100' },
                        { Date: '2024-03-20', Value: '200' }
                    ])
                }
            };
            
            jest.doMock('xlsx', () => mockXLSX);
            
            const result = await excelImportService.analyzeFile('test.xlsx');
            
            expect(result.success).toBe(true);
            expect(result.mapping['Date']).toBe('date');
            
            // Verify date normalization
            const preview = result.preview;
            expect(preview[0].Date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(preview[1].Date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });
    
    describe('Data Import Integration', () => {
        test('should import data with valid mapping', async () => {
            const mockMapping = {
                'Date': 'date',
                'Contractor': 'contractor_id',
                'Supplier': 'supplier_id',
                'Volume': 'volume',
                'Unit Price': 'unit_price',
                'Description': 'item_description'
            };
            
            const mockPreviewData = [
                {
                    'Date': '2024-01-01',
                    'Contractor': 'Contractor A',
                    'Supplier': 'Supplier X',
                    'Volume': '100',
                    'Unit Price': '50.00',
                    'Description': 'Material A'
                }
            ];
            
            // Mock database transaction
            const mockTransaction = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                commit: jest.fn(),
                rollback: jest.fn()
            };
            
            mockDb.transaction.mockImplementation((callback) => {
                return callback(mockTransaction);
            });
            
            // Mock contractor and supplier lookups
            mockTransaction.select.mockReturnValueOnce({
                where: jest.fn().mockReturnValueOnce([{ id: 1, name: 'Contractor A' }])
            }).mockReturnValueOnce({
                where: jest.fn().mockReturnValueOnce([{ id: 1, name: 'Supplier X' }])
            });
            
            // Mock delivery insertion
            mockTransaction.insert.mockReturnValueOnce([1]); // Return inserted ID
            
            const result = await excelImportService.importData(
                'test.xlsx',
                mockMapping,
                1 // userId
            );
            
            expect(result.success).toBe(true);
            expect(mockTransaction.commit).toHaveBeenCalled();
            expect(mockTransaction.rollback).not.toHaveBeenCalled();
        });
        
        test('should handle import conflicts and record them', async () => {
            const mockMapping = {
                'Date': 'date',
                'Contractor': 'contractor_id',
                'Supplier': 'supplier_id',
                'Volume': 'volume',
                'Unit Price': 'unit_price'
            };
            
            const mockPreviewData = [
                {
                    'Date': '2024-01-01',
                    'Contractor': 'Non-existent Contractor',
                    'Supplier': 'Supplier X',
                    'Volume': '100',
                    'Unit Price': '50.00'
                }
            ];
            
            // Mock database transaction
            const mockTransaction = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                commit: jest.fn(),
                rollback: jest.fn()
            };
            
            mockDb.transaction.mockImplementation((callback) => {
                return callback(mockTransaction);
            });
            
            // Mock contractor lookup to return empty (non-existent)
            mockTransaction.select.mockReturnValueOnce({
                where: jest.fn().mockReturnValueOnce([])
            });
            
            // Mock conflict recording
            mockTransaction.insert.mockReturnValueOnce([1]); // Import batch ID
            mockTransaction.insert.mockReturnValueOnce([1]); // Conflict record ID
            
            const result = await excelImportService.importData(
                'test.xlsx',
                mockMapping,
                1 // userId
            );
            
            expect(result.success).toBe(true);
            expect(result.conflicts).toBeGreaterThan(0);
            expect(mockTransaction.commit).toHaveBeenCalled();
        });
        
        test('should handle duplicate voucher conflicts', async () => {
            const mockMapping = {
                'Date': 'date',
                'Voucher': 'company_voucher_no',
                'Volume': 'volume',
                'Unit Price': 'unit_price'
            };
            
            const mockPreviewData = [
                {
                    'Date': '2024-01-01',
                    'Voucher': 'V001',
                    'Volume': '100',
                    'Unit Price': '50.00'
                }
            ];
            
            // Mock database transaction
            const mockTransaction = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                commit: jest.fn(),
                rollback: jest.fn()
            };
            
            mockDb.transaction.mockImplementation((callback) => {
                return callback(mockTransaction);
            });
            
            // Mock duplicate voucher check
            mockTransaction.select.mockReturnValueOnce({
                where: jest.fn().mockReturnValueOnce([{ id: 1, company_voucher_no: 'V001' }])
            });
            
            // Mock conflict recording
            mockTransaction.insert.mockReturnValueOnce([1]); // Import batch ID
            mockTransaction.insert.mockReturnValueOnce([1]); // Conflict record ID
            
            const result = await excelImportService.importData(
                'test.xlsx',
                mockMapping,
                1 // userId
            );
            
            expect(result.success).toBe(true);
            expect(result.conflicts).toBeGreaterThan(0);
            
            // Verify conflict reason
            expect(mockTransaction.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: 'duplicate_voucher'
                })
            );
        });
    });
    
    describe('Data Validation Integration', () => {
        test('should validate required fields', async () => {
            const mockMapping = {
                'Date': 'date',
                'Volume': 'volume'
                // Missing required fields: contractor_id, supplier_id, unit_price
            };
            
            const mockPreviewData = [
                {
                    'Date': '2024-01-01',
                    'Volume': '100'
                }
            ];
            
            const mockTransaction = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                commit: jest.fn(),
                rollback: jest.fn()
            };
            
            mockDb.transaction.mockImplementation((callback) => {
                return callback(mockTransaction);
            });
            
            mockTransaction.insert.mockReturnValueOnce([1]); // Import batch ID
            
            const result = await excelImportService.importData(
                'test.xlsx',
                mockMapping,
                1 // userId
            );
            
            expect(result.success).toBe(true);
            expect(result.conflicts).toBeGreaterThan(0);
            
            // Verify validation conflicts were recorded
            expect(mockTransaction.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: 'missing_required'
                })
            );
        });
        
        test('should validate data types and formats', async () => {
            const mockMapping = {
                'Date': 'date',
                'Volume': 'volume',
                'Unit Price': 'unit_price'
            };
            
            const mockPreviewData = [
                {
                    'Date': 'invalid-date',
                    'Volume': 'not-a-number',
                    'Unit Price': 'invalid-price'
                }
            ];
            
            const mockTransaction = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                commit: jest.fn(),
                rollback: jest.fn()
            };
            
            mockDb.transaction.mockImplementation((callback) => {
                return callback(mockTransaction);
            });
            
            mockTransaction.insert.mockReturnValueOnce([1]); // Import batch ID
            
            const result = await excelImportService.importData(
                'test.xlsx',
                mockMapping,
                1 // userId
            );
            
            expect(result.success).toBe(true);
            expect(result.conflicts).toBeGreaterThan(0);
            
            // Verify data validation conflicts were recorded
            expect(mockTransaction.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: 'invalid_data'
                })
            );
        });
    });
    
    describe('Error Handling Integration', () => {
        test('should handle database errors gracefully', async () => {
            const mockMapping = {
                'Date': 'date',
                'Volume': 'volume'
            };
            
            const mockTransaction = {
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                commit: jest.fn().mockRejectedValue(new Error('Database error')),
                rollback: jest.fn()
            };
            
            mockDb.transaction.mockImplementation((callback) => {
                return callback(mockTransaction);
            });
            
            const result = await excelImportService.importData(
                'test.xlsx',
                mockMapping,
                1 // userId
            );
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Database error');
            expect(mockTransaction.rollback).toHaveBeenCalled();
        });
        
        test('should handle file reading errors', async () => {
            // Mock XLSX to throw error
            const mockXLSX = {
                readFile: jest.fn().mockImplementation(() => {
                    throw new Error('File corrupted');
                })
            };
            
            jest.doMock('xlsx', () => mockXLSX);
            
            const result = await excelImportService.analyzeFile('corrupted.xlsx');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('File corrupted');
        });
    });
    
    afterEach(() => {
        // Clean up any temporary files
        const testFilePath = path.join(__dirname, 'test_data.xlsx');
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });
});
