import { Router, Request, Response } from 'express';
import { requirePermission } from '../services/authorization';
import { asyncHandler } from '../middleware/async-handler';
import {
  getCloudDatabaseStatus,
  updateCloudConfig,
  executeCloudDatabaseSync,
} from '../services/cloud-db-sync';

const router = Router();

/**
 * 1. GET /api/database/cloud/status
 * Get connection status, statistics, and sync metrics with central RDS Database
 */
router.get(
  '/status',
  requirePermission('database.manage'),
  asyncHandler(async (_req: Request, res: Response) => {
    const status = getCloudDatabaseStatus();
    res.json({
      success: true,
      config: status,
    });
  })
);

/**
 * 2. POST /api/database/cloud/sync
 * Execute on-demand continuous sync to central Cloud Database
 */
router.post(
  '/sync',
  requirePermission('database.manage'),
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const result = await executeCloudDatabaseSync();
      res.json(result);
    } catch (error: any) {
      console.error('[Cloud DB Sync error]', error);
      res.status(500).json({ error: 'Failed to sync to central cloud database', details: error.message });
    }
  })
);

/**
 * 3. PUT /api/database/cloud/config
 * Update central database connection parameters
 */
router.put(
  '/config',
  requirePermission('database.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { endpoint, database, port, ssl, autoSyncMinutes } = req.body;
    const updated = updateCloudConfig({
      endpoint,
      database,
      port: port ? parseInt(port, 10) : undefined,
      ssl: typeof ssl === 'boolean' ? ssl : undefined,
      autoSyncMinutes: autoSyncMinutes ? parseInt(autoSyncMinutes, 10) : undefined,
    });
    res.json({
      success: true,
      message: 'Cloud Database configuration updated',
      config: updated,
    });
  })
);

export const databaseCloudRoutes = router;
