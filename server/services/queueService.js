const { Queue, Worker, QueueScheduler } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const ExcelImportService = require('./excelImportService');
const RecomputeService = require('./recomputeService');

class QueueService {
    constructor() {
        this.redis = null;
        this.queues = {};
        this.workers = {};
        this.schedulers = {};
        this.isInitialized = false;
    }
    
    async initialize() {
        try {
            // Initialize Redis connection
            this.redis = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3
            });
            
            // Create queues
            this.queues.import = new Queue('excel-import', { connection: this.redis });
            this.queues.recompute = new Queue('field-recompute', { connection: this.redis });
            this.queues.reports = new Queue('report-generation', { connection: this.redis });
            
            // Create queue schedulers for delayed jobs
            this.schedulers.import = new QueueScheduler('excel-import', { connection: this.redis });
            this.schedulers.recompute = new QueueScheduler('field-recompute', { connection: this.redis });
            this.schedulers.reports = new QueueScheduler('report-generation', { connection: this.redis });
            
            // Initialize workers
            await this.initializeWorkers();
            
            this.isInitialized = true;
            logger.info('Queue service initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize queue service:', error);
            throw error;
        }
    }
    
    async initializeWorkers() {
        // Excel Import Worker
        this.workers.import = new Worker('excel-import', async (job) => {
            try {
                logger.info(`Processing import job ${job.id} for file: ${job.data.filename}`);
                
                const { filePath, mapping, userId, batchId } = job.data;
                const importService = new ExcelImportService();
                
                // Update job progress
                await job.updateProgress(10);
                
                // Process the import
                const result = await importService.importData(filePath, mapping, userId);
                
                await job.updateProgress(90);
                
                // Update batch status
                if (result.success) {
                    await this.updateImportBatchStatus(batchId, 'completed', {
                        imported_rows: result.imported,
                        conflict_rows: result.conflicts
                    });
                } else {
                    await this.updateImportBatchStatus(batchId, 'failed', {
                        error_message: result.error
                    });
                }
                
                await job.updateProgress(100);
                
                logger.info(`Import job ${job.id} completed successfully`);
                return result;
                
            } catch (error) {
                logger.error(`Import job ${job.id} failed:`, error);
                
                // Update batch status to failed
                if (job.data.batchId) {
                    await this.updateImportBatchStatus(job.data.batchId, 'failed', {
                        error_message: error.message
                    });
                }
                
                throw error;
            }
        }, {
            connection: this.redis,
            concurrency: 2, // Process 2 import jobs simultaneously
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: 50 // Keep last 50 failed jobs
        });
        
        // Field Recompute Worker
        this.workers.recompute = new Worker('field-recompute', async (job) => {
            try {
                logger.info(`Processing recompute job ${job.id}`);
                
                const { type, params } = job.data;
                const recomputeService = new RecomputeService();
                
                await job.updateProgress(25);
                
                let result;
                switch (type) {
                    case 'single':
                        result = await recomputeService.recomputeDependentFields(params.deliveryId);
                        break;
                    case 'date_range':
                        result = await recomputeService.recomputeDateRange(params.fromDate, params.toDate);
                        break;
                    case 'supplier':
                        result = await recomputeService.recomputeBySupplier(params.supplierId);
                        break;
                    case 'bulk':
                        result = await recomputeService.recomputeBulk(params.deliveryIds);
                        break;
                    default:
                        throw new Error(`Unknown recompute type: ${type}`);
                }
                
                await job.updateProgress(100);
                
                logger.info(`Recompute job ${job.id} completed successfully`);
                return result;
                
            } catch (error) {
                logger.error(`Recompute job ${job.id} failed:`, error);
                throw error;
            }
        }, {
            connection: this.redis,
            concurrency: 3, // Process 3 recompute jobs simultaneously
            removeOnComplete: 200,
            removeOnFail: 100
        });
        
        // Report Generation Worker
        this.workers.reports = new Worker('report-generation', async (job) => {
            try {
                logger.info(`Processing report generation job ${job.id}`);
                
                const { reportType, filters, format, userId } = job.data;
                
                await job.updateProgress(20);
                
                // Generate report based on type
                let reportData;
                switch (reportType) {
                    case 'deliveries_summary':
                        reportData = await this.generateDeliveriesSummary(filters);
                        break;
                    case 'financial_summary':
                        reportData = await this.generateFinancialSummary(filters);
                        break;
                    case 'supplier_analysis':
                        reportData = await this.generateSupplierAnalysis(filters);
                        break;
                    case 'monthly_trends':
                        reportData = await this.generateMonthlyTrends(filters);
                        break;
                    default:
                        throw new Error(`Unknown report type: ${reportType}`);
                }
                
                await job.updateProgress(80);
                
                // Convert to requested format
                let finalReport;
                if (format === 'csv') {
                    finalReport = this.convertToCSV(reportData);
                } else {
                    finalReport = reportData;
                }
                
                await job.updateProgress(100);
                
                logger.info(`Report generation job ${job.id} completed successfully`);
                return {
                    reportType,
                    format,
                    data: finalReport,
                    generatedAt: new Date().toISOString()
                };
                
            } catch (error) {
                logger.error(`Report generation job ${job.id} failed:`, error);
                throw error;
            }
        }, {
            connection: this.redis,
            concurrency: 1, // Process 1 report at a time to avoid memory issues
            removeOnComplete: 50,
            removeOnFail: 25
        });
        
        // Add event listeners for job monitoring
        this.setupWorkerEventListeners();
    }
    
    setupWorkerEventListeners() {
        // Import worker events
        this.workers.import.on('completed', (job, result) => {
            logger.info(`Import job ${job.id} completed successfully`);
        });
        
        this.workers.import.on('failed', (job, error) => {
            logger.error(`Import job ${job.id} failed:`, error);
        });
        
        this.workers.import.on('progress', (job, progress) => {
            logger.debug(`Import job ${job.id} progress: ${progress}%`);
        });
        
        // Recompute worker events
        this.workers.recompute.on('completed', (job, result) => {
            logger.info(`Recompute job ${job.id} completed successfully`);
        });
        
        this.workers.recompute.on('failed', (job, error) => {
            logger.error(`Recompute job ${job.id} failed:`, error);
        });
        
        // Reports worker events
        this.workers.reports.on('completed', (job, result) => {
            logger.info(`Report generation job ${job.id} completed successfully`);
        });
        
        this.workers.reports.on('failed', (job, error) => {
            logger.error(`Report generation job ${job.id} failed:`, error);
        });
    }
    
    // Queue job methods
    async addImportJob(filePath, mapping, userId, batchId, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Queue service not initialized');
        }
        
        const job = await this.queues.import.add('process-excel-import', {
            filePath,
            mapping,
            userId,
            batchId
        }, {
            priority: options.priority || 0,
            delay: options.delay || 0,
            attempts: options.attempts || 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: true,
            removeOnFail: false
        });
        
        logger.info(`Added import job ${job.id} to queue`);
        return job;
    }
    
    async addRecomputeJob(type, params, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Queue service not initialized');
        }
        
        const job = await this.queues.recompute.add('recompute-fields', {
            type,
            params
        }, {
            priority: options.priority || 0,
            delay: options.delay || 0,
            attempts: options.attempts || 2,
            backoff: {
                type: 'exponential',
                delay: 1000
            }
        });
        
        logger.info(`Added recompute job ${job.id} to queue`);
        return job;
    }
    
    async addReportJob(reportType, filters, format, userId, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Queue service not initialized');
        }
        
        const job = await this.queues.reports.add('generate-report', {
            reportType,
            filters,
            format,
            userId
        }, {
            priority: options.priority || 0,
            delay: options.delay || 0,
            attempts: options.attempts || 2
        });
        
        logger.info(`Added report generation job ${job.id} to queue`);
        return job;
    }
    
    // Job status and monitoring methods
    async getJobStatus(jobId, queueName) {
        if (!this.isInitialized || !this.queues[queueName]) {
            throw new Error('Queue service not initialized or invalid queue name');
        }
        
        const job = await this.queues[queueName].getJob(jobId);
        if (!job) {
            return null;
        }
        
        return {
            id: job.id,
            name: job.name,
            status: await job.getState(),
            progress: job.progress,
            data: job.data,
            createdAt: job.timestamp,
            processedAt: job.processedOn,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade,
            delay: job.delay
        };
    }
    
    async getQueueStats(queueName) {
        if (!this.isInitialized || !this.queues[queueName]) {
            throw new Error('Queue service not initialized or invalid queue name');
        }
        
        const queue = this.queues[queueName];
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(),
            queue.getFailed(),
            queue.getDelayed()
        ]);
        
        return {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
            total: waiting.length + active.length + completed.length + failed.length + delayed.length
        };
    }
    
    async getAllQueueStats() {
        const stats = {};
        for (const [queueName, queue] of Object.entries(this.queues)) {
            stats[queueName] = await this.getQueueStats(queueName);
        }
        return stats;
    }
    
    // Cleanup and shutdown
    async cleanup() {
        try {
            // Close all workers
            for (const worker of Object.values(this.workers)) {
                await worker.close();
            }
            
            // Close all queues
            for (const queue of Object.values(this.queues)) {
                await queue.close();
            }
            
            // Close all schedulers
            for (const scheduler of Object.values(this.schedulers)) {
                await scheduler.close();
            }
            
            // Close Redis connection
            if (this.redis) {
                await this.redis.quit();
            }
            
            this.isInitialized = false;
            logger.info('Queue service cleaned up successfully');
            
        } catch (error) {
            logger.error('Error during queue service cleanup:', error);
            throw error;
        }
    }
    
    // Helper methods for report generation
    async generateDeliveriesSummary(filters) {
        // Implementation would depend on your database structure
        // This is a placeholder
        return { message: 'Deliveries summary report' };
    }
    
    async generateFinancialSummary(filters) {
        // Implementation would depend on your database structure
        // This is a placeholder
        return { message: 'Financial summary report' };
    }
    
    async generateSupplierAnalysis(filters) {
        // Implementation would depend on your database structure
        // This is a placeholder
        return { message: 'Supplier analysis report' };
    }
    
    async generateMonthlyTrends(filters) {
        // Implementation would depend on your database structure
        // This is a placeholder
        return { message: 'Monthly trends report' };
    }
    
    convertToCSV(data) {
        // Simple CSV conversion - you might want to use a library like 'json2csv'
        if (Array.isArray(data)) {
            if (data.length === 0) return '';
            
            const headers = Object.keys(data[0]);
            const csvRows = [
                headers.join(','),
                ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
            ];
            return csvRows.join('\n');
        }
        return JSON.stringify(data);
    }
    
    async updateImportBatchStatus(batchId, status, details) {
        try {
            const db = require('../database').getDb();
            await db('import_batches')
                .where('id', batchId)
                .update({
                    status,
                    ...details,
                    updated_at: new Date()
                });
        } catch (error) {
            logger.error('Failed to update import batch status:', error);
        }
    }
}

module.exports = QueueService;
