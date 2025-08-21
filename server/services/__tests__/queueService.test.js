const QueueService = require('../queueService');
const Redis = require('ioredis');

// Mock dependencies
jest.mock('ioredis');
jest.mock('../excelImportService');
jest.mock('../recomputeService');
jest.mock('../../utils/logger');

describe('QueueService', () => {
    let queueService;
    let mockRedis;
    let mockLogger;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup mock Redis
        mockRedis = {
            quit: jest.fn().mockResolvedValue('OK')
        };
        Redis.mockImplementation(() => mockRedis);
        
        // Setup mock logger
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
        };
        
        const loggerModule = require('../../utils/logger');
        loggerModule.logger = mockLogger;
        
        // Mock BullMQ classes
        const mockQueue = {
            add: jest.fn(),
            getActive: jest.fn(),
            getCompleted: jest.fn(),
            getFailed: jest.fn(),
            getDelayed: jest.fn(),
            getJob: jest.fn(),
            clean: jest.fn(),
            close: jest.fn()
        };
        
        const mockWorker = {
            on: jest.fn(),
            close: jest.fn()
        };
        
        const mockScheduler = {
            close: jest.fn()
        };
        
        // Mock BullMQ modules
        jest.doMock('bullmq', () => ({
            Queue: jest.fn(() => mockQueue),
            Worker: jest.fn(() => mockWorker),
            QueueScheduler: jest.fn(() => mockScheduler)
        }));
        
        queueService = new QueueService();
    });
    
    afterEach(() => {
        if (queueService && queueService.isInitialized) {
            queueService.cleanup();
        }
    });
    
    describe('Initialization', () => {
        test('should initialize successfully with valid Redis connection', async () => {
            // Mock successful Redis connection
            mockRedis.on = jest.fn();
            
            await queueService.initialize();
            
            expect(queueService.isInitialized).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith('Queue service initialized successfully');
        });
        
        test('should handle Redis connection failure', async () => {
            // Mock Redis connection failure
            const mockError = new Error('Redis connection failed');
            Redis.mockImplementation(() => {
                throw mockError;
            });
            
            await expect(queueService.initialize()).rejects.toThrow('Redis connection failed');
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize queue service:', mockError);
        });
    });
    
    describe('Job Management', () => {
        beforeEach(async () => {
            // Mock successful initialization
            mockRedis.on = jest.fn();
            await queueService.initialize();
        });
        
        test('should add import job successfully', async () => {
            const mockJob = { id: 'job-123' };
            queueService.queues.import.add.mockResolvedValue(mockJob);
            
            const result = await queueService.addImportJob(
                'test.xlsx',
                { 'Date': 'date' },
                1,
                'batch-123'
            );
            
            expect(result).toBe(mockJob);
            expect(queueService.queues.import.add).toHaveBeenCalledWith(
                'process-excel-import',
                {
                    filePath: 'test.xlsx',
                    mapping: { 'Date': 'date' },
                    userId: 1,
                    batchId: 'batch-123'
                },
                expect.objectContaining({
                    priority: 0,
                    delay: 0,
                    attempts: 3
                })
            );
        });
        
        test('should add recompute job successfully', async () => {
            const mockJob = { id: 'job-456' };
            queueService.queues.recompute.add.mockResolvedValue(mockJob);
            
            const result = await queueService.addRecomputeJob(
                'date_range',
                { fromDate: '2024-01-01', toDate: '2024-01-31' }
            );
            
            expect(result).toBe(mockJob);
            expect(queueService.queues.recompute.add).toHaveBeenCalledWith(
                'recompute-fields',
                {
                    type: 'date_range',
                    params: { fromDate: '2024-01-01', toDate: '2024-01-31' }
                },
                expect.objectContaining({
                    priority: 0,
                    delay: 0,
                    attempts: 2
                })
            );
        });
        
        test('should add report job successfully', async () => {
            const mockJob = { id: 'job-789' };
            queueService.queues.reports.add.mockResolvedValue(mockJob);
            
            const result = await queueService.addReportJob(
                'deliveries_summary',
                { dateFrom: '2024-01-01' },
                'csv',
                1
            );
            
            expect(result).toBe(mockJob);
            expect(queueService.queues.reports.add).toHaveBeenCalledWith(
                'generate-report',
                {
                    reportType: 'deliveries_summary',
                    filters: { dateFrom: '2024-01-01' },
                    format: 'csv',
                    userId: 1
                },
                expect.objectContaining({
                    priority: 0,
                    delay: 0,
                    attempts: 2
                })
            );
        });
        
        test('should throw error when adding job without initialization', async () => {
            queueService.isInitialized = false;
            
            await expect(queueService.addImportJob('test.xlsx', {}, 1, 'batch-123'))
                .rejects.toThrow('Queue service not initialized');
        });
    });
    
    describe('Queue Statistics', () => {
        beforeEach(async () => {
            mockRedis.on = jest.fn();
            await queueService.initialize();
        });
        
        test('should get queue statistics successfully', async () => {
            const mockStats = {
                waiting: 5,
                active: 2,
                completed: 100,
                failed: 3,
                delayed: 1,
                total: 111
            };
            
            queueService.queues.import.getWaiting.mockResolvedValue(Array(5).fill({}));
            queueService.queues.import.getActive.mockResolvedValue(Array(2).fill({}));
            queueService.queues.import.getCompleted.mockResolvedValue(Array(100).fill({}));
            queueService.queues.import.getFailed.mockResolvedValue(Array(3).fill({}));
            queueService.queues.import.getDelayed.mockResolvedValue(Array(1).fill({}));
            
            const stats = await queueService.getQueueStats('import');
            
            expect(stats).toEqual(mockStats);
        });
        
        test('should get all queue statistics', async () => {
            // Mock stats for all queues
            const mockQueueStats = {
                waiting: 2,
                active: 1,
                completed: 50,
                failed: 1,
                delayed: 0,
                total: 54
            };
            
            // Mock the getQueueStats method
            jest.spyOn(queueService, 'getQueueStats').mockResolvedValue(mockQueueStats);
            
            const allStats = await queueService.getAllQueueStats();
            
            expect(allStats).toEqual({
                import: mockQueueStats,
                recompute: mockQueueStats,
                reports: mockQueueStats
            });
        });
        
        test('should throw error for invalid queue name', async () => {
            await expect(queueService.getQueueStats('invalid-queue'))
                .rejects.toThrow('Queue service not initialized or invalid queue name');
        });
    });
    
    describe('Job Status and Monitoring', () => {
        beforeEach(async () => {
            mockRedis.on = jest.fn();
            await queueService.initialize();
        });
        
        test('should get job status successfully', async () => {
            const mockJob = {
                id: 'job-123',
                name: 'test-job',
                timestamp: 1234567890,
                processedOn: 1234567891,
                failedReason: null,
                attemptsMade: 1,
                delay: 0,
                returnvalue: { success: true }
            };
            
            mockJob.getState = jest.fn().mockResolvedValue('completed');
            mockJob.progress = 100;
            
            queueService.queues.import.getJob.mockResolvedValue(mockJob);
            
            const jobStatus = await queueService.getJobStatus('job-123', 'import');
            
            expect(jobStatus).toEqual({
                id: 'job-123',
                name: 'test-job',
                status: 'completed',
                progress: 100,
                data: mockJob.data,
                createdAt: 1234567890,
                processedAt: 1234567891,
                failedReason: null,
                attemptsMade: 1,
                delay: 0
            });
        });
        
        test('should return null for non-existent job', async () => {
            queueService.queues.import.getJob.mockResolvedValue(null);
            
            const jobStatus = await queueService.getJobStatus('non-existent', 'import');
            
            expect(jobStatus).toBeNull();
        });
    });
    
    describe('Worker Event Handling', () => {
        beforeEach(async () => {
            mockRedis.on = jest.fn();
            await queueService.initialize();
        });
        
        test('should setup worker event listeners', () => {
            // Verify that event listeners are set up for each worker
            expect(queueService.workers.import.on).toHaveBeenCalledWith('completed', expect.any(Function));
            expect(queueService.workers.import.on).toHaveBeenCalledWith('failed', expect.any(Function));
            expect(queueService.workers.import.on).toHaveBeenCalledWith('progress', expect.any(Function));
            
            expect(queueService.workers.recompute.on).toHaveBeenCalledWith('completed', expect.any(Function));
            expect(queueService.workers.recompute.on).toHaveBeenCalledWith('failed', expect.any(Function));
            
            expect(queueService.workers.reports.on).toHaveBeenCalledWith('completed', expect.any(Function));
            expect(queueService.workers.reports.on).toHaveBeenCalledWith('failed', expect.any(Function));
        });
    });
    
    describe('Cleanup and Shutdown', () => {
        beforeEach(async () => {
            mockRedis.on = jest.fn();
            await queueService.initialize();
        });
        
        test('should cleanup resources successfully', async () => {
            await queueService.cleanup();
            
            // Verify all workers are closed
            expect(queueService.workers.import.close).toHaveBeenCalled();
            expect(queueService.workers.recompute.close).toHaveBeenCalled();
            expect(queueService.workers.reports.close).toHaveBeenCalled();
            
            // Verify all queues are closed
            expect(queueService.queues.import.close).toHaveBeenCalled();
            expect(queueService.queues.recompute.close).toHaveBeenCalled();
            expect(queueService.queues.reports.close).toHaveBeenCalled();
            
            // Verify all schedulers are closed
            expect(queueService.schedulers.import.close).toHaveBeenCalled();
            expect(queueService.schedulers.recompute.close).toHaveBeenCalled();
            expect(queueService.schedulers.reports.close).toHaveBeenCalled();
            
            // Verify Redis connection is closed
            expect(mockRedis.quit).toHaveBeenCalled();
            
            // Verify service is marked as not initialized
            expect(queueService.isInitialized).toBe(false);
        });
        
        test('should handle cleanup errors gracefully', async () => {
            // Mock cleanup errors
            queueService.workers.import.close.mockRejectedValue(new Error('Worker close failed'));
            
            await expect(queueService.cleanup()).rejects.toThrow('Worker close failed');
            expect(mockLogger.error).toHaveBeenCalledWith('Error during queue service cleanup:', expect.any(Error));
        });
    });
    
    describe('Helper Methods', () => {
        test('should convert data to CSV format', () => {
            const testData = [
                { name: 'John', age: 30 },
                { name: 'Jane', age: 25 }
            ];
            
            const csv = queueService.convertToCSV(testData);
            
            expect(csv).toContain('name,age');
            expect(csv).toContain('"John",30');
            expect(csv).toContain('"Jane",25');
        });
        
        test('should handle empty data for CSV conversion', () => {
            const csv = queueService.convertToCSV([]);
            expect(csv).toBe('');
        });
        
        test('should handle non-array data for CSV conversion', () => {
            const csv = queueService.convertToCSV({ name: 'John' });
            expect(csv).toBe('{"name":"John"}');
        });
        
        test('should update import batch status', async () => {
            // Mock database module
            const mockDb = {
                update: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis()
            };
            
            jest.doMock('../../database', () => ({
                getDb: jest.fn().mockReturnValue(mockDb)
            }));
            
            await queueService.updateImportBatchStatus('batch-123', 'completed', {
                imported_rows: 100,
                conflict_rows: 5
            });
            
            expect(mockDb.where).toHaveBeenCalledWith('id', 'batch-123');
            expect(mockDb.update).toHaveBeenCalledWith({
                status: 'completed',
                imported_rows: 100,
                conflict_rows: 5,
                updated_at: expect.any(Date)
            });
        });
    });
});
