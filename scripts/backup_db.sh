#!/usr/bin/env bash
# =========================================================================
# FloCafe POS - Automated Local SQLite Database Backup Script
# Creates an online, non-blocking snapshot of flo.db
# =========================================================================

set -euo pipefail

BACKUP_DIR="/home/admin/Projects-main/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RAW_BACKUP="${BACKUP_DIR}/flo_backup_${TIMESTAMP}.db"
COMPRESSED_BACKUP="${RAW_BACKUP}.gz"
PROJECT_DIR="/home/admin/Projects-main"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting online database backup for FloCafe (flo.db)..."

# Trigger better-sqlite3 native online backup
/usr/local/bin/node -e "
const Database = require('${PROJECT_DIR}/node_modules/better-sqlite3');
const db = new Database('${PROJECT_DIR}/flo.db');
db.backup('${RAW_BACKUP}')
  .then(() => {
    db.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('[Backup Error]:', err.message);
    try { db.close(); } catch (_) {}
    process.exit(1);
  });
"

# Compress backup
gzip -9 "${RAW_BACKUP}"

BACKUP_SIZE=$(du -h "${COMPRESSED_BACKUP}" | cut -f1)
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup successfully written to ${COMPRESSED_BACKUP} (Size: ${BACKUP_SIZE})"

# Prune archives older than 30 days
find "${BACKUP_DIR}" -name "flo_backup_*.db.gz" -mtime +30 -exec rm -f {} \;
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Cleaned up backups older than 30 days."
