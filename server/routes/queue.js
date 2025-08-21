const express = require('express');
const router = express.Router();
const { authenticateToken, requireManager } = require('../middleware/auth');
const QueueService = require('../services/queueService');
const logger = require('../utils/logger');

// Initialize queue service
let queueService;
try {
    queueService = new QueueService();
    // Note: In production, you might want to initialize this differently
    // For now, we'll handle the case where Redis is not available
} catch (error) {
    logger.warn('Queue service not available:', error.message);
}

// Middleware to check if queue service is available
const requireQueueService = (req, res, next) => {
    if (!queueService || !queueService.isInitialized) {
        return res.status(503).json({
            success: false,
            error: 'Queue service not available'
        });
    }
    next();
};

// Get queue statistics
router.get('/stats', authenticateToken, requireManager, requireQueueService, async (req, res) => {
    try {
        const stats = await queueService.getAllQueueStats();
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        logger.error('Error getting queue stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get queue statistics'
        });
    }
});

// Get active jobs
router.get('/jobs/active', authenticateToken, requireManager, requireQueueService, async (req, res) => {
    try {
        const activeJobs = [];
        
        // Get active jobs from all queues
        for (const [queueName, queue] of Object.entries(queueService.queues)) {
            const jobs = await queue.getActive();
            for (const job of jobs) {
                activeJobs.push({
                    id: job.id,
                    name: job.name,
                    queueName,
                    progress: job.progress,
                    processedAt: job.processedOn,
                    attemptsMade: job.attemptsMade,
                    data: job.data
                });
            }
        }
        
        res.json({
            success: true,
            jobs: activeJobs
        });
    } catch (error) {
        logger.error('Error getting active jobs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get active jobs'
        });
    }
});

// Get recent jobs (completed, failed, delayed)
router.get('/jobs/recent', authenticateToken, requireManager, requireQueueService, async (req, res) => {
    try {
        const recentJobs = [];
        const limit = parseInt(req.query.limit) || 20;
        
        // Get recent jobs from all queues
        for (const [queueName, queue] of Object.entries(queueService.queues)) {
            const [completed, failed, delayed] = await Promise.all([
                queue.getCompleted(0, limit),
                queue.getFailed(0, limit),
                queue.getDelayed(0, limit)
            ]);
            
            // Process completed jobs
            for (const job of completed) {
                recentJobs.push({
                    id: job.id,
                    name: job.name,
                    queueName,
                    status: 'completed',
                    createdAt: job.timestamp,
                    processedAt: job.processedOn,
                    attemptsMade: job.attemptsMade,
                    data: job.data,
                    result: job.returnvalue
                });
            }
            
            // Process failed jobs
            for (const job of failed) {
                recentJobs.push({
                    id: job.id,
                    name: job.name,
                    queueName,
                    status: 'failed',
                    createdAt: job.timestamp,
                    processedAt: job.processedOn,
                    attemptsMade: job.attemptsMade,
                    data: job.data,
                    failedReason: job.failedReason
                });
            }
            
            // Process delayed jobs
            for (const job of delayed) {
                recentJobs.push({
                    id: job.id,
                    name: job.name,
                    queueName,
                    status: 'delayed',
                    createdAt: job.timestamp,
                    delay: job.delay,
                    data: job.data
                });
            }
        }
        
        // Sort by creation date (newest first) and limit results
        recentJobs.sort((a, b) => b.createdAt - a.createdAt);
        const limitedJobs = recentJobs.slice(0, limit);
        
        res.json({
            success: true,
            jobs: limitedJobs
        });
    } catch (error) {
        logger.error('Error getting recent jobs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get recent jobs'
        });
    }
});

// Get specific job details
router.get('/jobs/:jobId', authenticateToken, requireManager, requireQueueService, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { queueName } = req.query;
        
        if (!queueName) {
            return res.status(400).json({
                success: false,
                error: 'Queue name is required'
            });
        }
        
        const queue = queueService.queues[queueName];
        if (!queue) {
            return res.status(400).json({
                success: false,
                error: 'Invalid queue name'
            });
        }
        
        const job = await queue.getJob(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }
        
        const jobDetails = {
            id: job.id,
            name: job.name,
            status: await job.getState(),
            progress: job.progress,
            data: job.data,
            createdAt: job.timestamp,
            processedAt: job.processedOn,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade,
            delay: job.delay,
            result: job.returnvalue
        };
        
        res.json({
            success: true,
            job: jobDetails
        });
    } catch (error) {
        logger.error('Error getting job details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get job details'
        });
    }
});

// Pause a job
router.post('/jobs/:jobId/pause', authenticateToken, requireManager, requireQueueService, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { queueName } = req.body;
        
        if (!queueName) {
            return res.status(400).json({
                success: false,
                error: 'Queue name is required'
            });
        }
        
        const queue = queueService.queues[queueName];
        if (!queue) {
            return res.status(400).json({
                success: false,
                error: 'Invalid queue name'
            });
        }
        
        const job = await queue.getJob(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }
        
        await job.moveToDelayed(Date.now() + 24 * 60 * 60 * 1000); // Delay by 24 hours
        
        logger.info(`Job ${jobId} paused by user ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'Job paused successfully'
        });
    } catch (error) {
        logger.error('Error pausing job:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to pause job'
        });
    }
});

// Cancel a job
router.post('/jobs/:jobId/cancel', authenticateToken, requireManager, requireQueueService, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { queueName } = req.body;
        
        if (!queueName) {
            return res.status(400).json({
                success: false,
                error: 'Queue name is required'
            });
        }
        
        const queue = queueService.queues[queueName];
        if (!queue) {
            return res.status(400).json({
                success: false,
                error: 'Invalid queue name'
            });
        }
        
        const job = await queue.getJob(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }
        
        await job.remove();
        
        logger.info(`Job ${jobId} cancelled by user ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'Job cancelled successfully'
        });
    } catch (error) {
        logger.error('Error cancelling job:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel job'
        });
    }
});

// Retry a failed job
router.post('/jobs/:jobId/retry', authenticateToken, requireManager, requireQueueService, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { queueName } = req.body;
        
        if (!queueName) {
            return res.status(400).json({
                success: false,
                error: 'Queue name is required'
            });
        }
        
        const queue = queueService.queues[queueName];
        if (!queue) {
            return res.status(400).json({
                success: false,
                error: 'Invalid queue name'
            });
        }
        
        const job = await queue.getJob(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }
        
        if (await job.getState() !== 'failed') {
            return res.status(400).json({
                success: false,
                error: 'Only failed jobs can be retried'
            });
        }
        
        await job.retry();
        
        logger.info(`Job ${jobId} retried by user ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'Job retried successfully'
        });
    } catch (error) {
        logger.error('Error retrying job:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retry job'
        });
    }
});

// Clear completed jobs
router.delete('/jobs/completed', authenticateToken, requireManager, requireQueueService, async (req, res) => {
    try {
        const { queueName } = req.query;
        
        if (queueName) {
            // Clear specific queue
            const queue = queueService.queues[queueName];
            if (!queue) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid queue name'
                });
            }
            await queue.clean(0, 'completed');
        } else {
            // Clear all queues
            for (const queue of Object.values(queueService.queues)) {
                await queue.clean(0, 'completed');
            }
        }
        
        logger.info(`Completed jobs cleared by user ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'Completed jobs cleared successfully'
        });
    } catch (error) {
        logger.error('Error clearing completed jobs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear completed jobs'
        });
    }
});

// Clear failed jobs
router.delete('/jobs/failed', authenticateToken, requireManager, requireQueueService, async (req, res) => {
    try {
        const { queueName } = req.query;
        
        if (queueName) {
            // Clear specific queue
            const queue = queueService.queues[queueName];
            if (!queue) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid queue name'
                });
            }
            await queue.clean(0, 'failed');
        } else {
            // Clear all queues
            for (const queue of Object.values(queueService.queues)) {
                await queue.clean(0, 'failed');
            }
        }
        
        logger.info(`Failed jobs cleared by user ${req.user.id}`);
        
        res.json({
            success: true,
            message: 'Failed jobs cleared successfully'
        });
    } catch (error) {
        logger.error('Error clearing failed jobs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear failed jobs'
        });
    }
});

// Health check endpoint
router.get('/health', authenticateToken, requireManager, (req, res) => {
    const isHealthy = queueService && queueService.isInitialized;
    
    res.json({
        success: true,
        healthy: isHealthy,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
