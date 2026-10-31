#!/usr/bin/env bash
# Nightly MySQL backup for Campus Canteen. Keeps the last 14 days.
# Schedule (crontab -e on the Mac mini):  30 23 * * * /path/to/college-canteen-system/deploy/backup.sh
# Credentials come from ~/.my.cnf ([mysqldump] user=... password=...) so they're not in this file.
set -euo pipefail

DB_NAME="${DB_NAME:-canteen}"
BACKUP_DIR="${BACKUP_DIR:-/Volumes/Backup/canteen-db}"   # external drive
KEEP_DAYS="${KEEP_DAYS:-14}"
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/mysql@8.4/bin:/usr/local/bin:$PATH"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
FILE="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"

mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF "$DB_NAME" | gzip > "$FILE"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$KEEP_DAYS" -delete

# Also keep a copy of uploaded menu photos
UPLOADS="$(cd "$(dirname "$0")/../server" && pwd)/uploads"
[ -d "$UPLOADS" ] && rsync -a --delete "$UPLOADS/" "$BACKUP_DIR/uploads/"

echo "Backup written: $FILE"
# Restore: gunzip < FILE | mysql canteen
