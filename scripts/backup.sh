#!/bin/bash

# Directorio de backups y logs
BACKUP_DIR="/opt/cf/backups"
LOG_FILE="/opt/cf/backups/backup.log"

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

# Timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/coursefactory_backup_$TIMESTAMP.sql.gz"

echo "=========================================" >> "$LOG_FILE"
echo "Iniciando copia de seguridad: $(date)" >> "$LOG_FILE"

# Ejecutar pg_dump dentro del contenedor cf_postgres y guardarlo comprimido en el host
docker exec cf_postgres pg_dump -U postgres coursefactory-bdd | gzip > "$BACKUP_FILE"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "Copia de seguridad generada con éxito: $BACKUP_FILE" >> "$LOG_FILE"
    # Cambiar permisos del archivo generado
    chmod 600 "$BACKUP_FILE"
else
    echo "ERROR: Falló la generación de la copia de seguridad" >> "$LOG_FILE"
    rm -f "$BACKUP_FILE"
fi

# Eliminar backups con más de 30 días
echo "Buscando copias de seguridad antiguas para eliminar..." >> "$LOG_FILE"
find "$BACKUP_DIR" -name "coursefactory_backup_*.sql.gz" -type f -mtime +30 -exec rm -f {} \; -print >> "$LOG_FILE"

echo "Limpieza finalizada" >> "$LOG_FILE"
echo "Fin de copia de seguridad: $(date)" >> "$LOG_FILE"
