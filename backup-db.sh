#!/usr/bin/env bash
set -Eeuo pipefail

LOG="/srv/financeiro/backup-db.log"
exec > >(tee -a "$LOG") 2>&1

trap 'rc=$?; echo "ERRO na linha $LINENO (código $rc). Log: $LOG"; exit "$rc"' ERR

echo "=== Início: $(date) ==="

SOURCE="/srv/financeiro/data/financeiro.db"
BACKUP_DIR="/srv/backups/financeiro"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

export BACKUP_PATH="$BACKUP_DIR/financeiro-$(date +%Y%m%d-%H%M%S).db"

echo "=== Criando backup SQLite ==="

python3 - <<'PY'
import os
import sqlite3

source = "/srv/financeiro/data/financeiro.db"
destination = os.environ["BACKUP_PATH"]

print(f"Origem: {source}", flush=True)
print(f"Destino: {destination}", flush=True)

src = sqlite3.connect(
    f"file:{source}?mode=ro", uri=True, timeout=10
)
dst = sqlite3.connect(destination)

try:
    src.backup(dst)
    print("Cópia SQLite concluída.", flush=True)

    integrity = dst.execute("PRAGMA integrity_check").fetchone()[0]
    print(f"Integridade: {integrity}", flush=True)

    if integrity != "ok":
        raise RuntimeError("Falha na integridade do backup.")

    for table in ("categories", "commitments", "months", "entries"):
        count = dst.execute(
            f'SELECT COUNT(*) FROM "{table}"'
        ).fetchone()[0]
        print(f"{table}: {count} registros", flush=True)

    count = dst.execute(
        "SELECT COUNT(*) FROM commitments"
    ).fetchone()[0]

    if count == 0:
        raise RuntimeError(
            "Nenhum compromisso encontrado; backup não aprovado."
        )

    print("BACKUP VALIDADO COM SUCESSO.", flush=True)
finally:
    dst.close()
    src.close()
PY

chmod 600 "$BACKUP_PATH"

echo "=== Arquivo gerado ==="
ls -lh "$BACKUP_PATH"
echo "=== Fim: $(date) ==="
