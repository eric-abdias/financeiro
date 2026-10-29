#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

BACKUP_DIR="/srv/backups/financeiro"
SOURCE_DB="/srv/financeiro/data/financeiro.db"
LOG="/srv/site/seguro/logs/financeiro.log"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

exec >> "$LOG" 2>&1
trap 'rc=$?; echo "ERRO: código $rc, linha $LINENO, em $(date -Is)"; exit "$rc"' ERR

echo
echo "=== Backup Financeiro: $(date -Is) ==="

if [[ ! -f "$SOURCE_DB" ]]; then
    echo "ERRO: banco de origem não encontrado: $SOURCE_DB"
    exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
FINAL="$BACKUP_DIR/financeiro-$STAMP.db"
TEMP="$FINAL.tmp"

export SOURCE_DB TEMP FINAL

python3 <<'PY'
import os
import sqlite3

source = os.environ["SOURCE_DB"]
temp = os.environ["TEMP"]
final = os.environ["FINAL"]

src = None
dst = None

try:
    src = sqlite3.connect(
        f"file:{source}?mode=ro", uri=True, timeout=30
    )
    dst = sqlite3.connect(temp)

    src.backup(dst)

    integrity = dst.execute("PRAGMA integrity_check").fetchone()[0]
    print(f"Integridade SQLite: {integrity}")

    if integrity != "ok":
        raise RuntimeError("Integridade SQLite inválida")
 
    required = {"categories", "commitments", "months", "entries"}
    tables = {
        row[0] for row in dst.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
    }

    missing = required - tables
    if missing:
        raise RuntimeError(
            "Tabelas ausentes: " + ", ".join(sorted(missing))
        )

    for table in sorted(required):
        count = dst.execute(
            f'SELECT COUNT(*) FROM "{table}"'
        ).fetchone()[0]
        print(f"{table}: {count} registros")

    dst.close()
    dst = None
    src.close()
    src = None

    os.replace(temp, final)
    os.chmod(final, 0o600)
    print(f"Backup validado: {final}")

except Exception:
    if dst is not None:
        dst.close()
    if src is not None:
        src.close()
    if os.path.exists(temp):
        os.remove(temp)
    raise
PY

echo "=== Retendo os 7 backups mais recentes ==="

mapfile -t BACKUPS < <(
    find "$BACKUP_DIR" -maxdepth 1 -type f \
        -name 'financeiro-*.db' -printf '%T@ %p\n' |
        sort -nr |
        tail -n +8 |
        cut -d' ' -f2-
)

for file in "${BACKUPS[@]}"; do
    [[ -n "$file" ]] && rm -- "$file"
    echo "Backup antigo removido: $file"
done

echo "=== Backup concluído: $(date -Is) ==="
