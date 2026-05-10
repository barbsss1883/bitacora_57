#!/bin/bash
# Script para configurar el secret GOOGLE_SERVICES_JSON_B64 en EAS

set -e

PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
GS_JSON="$PROJECT_ROOT/google-services.json"

if [ ! -f "$GS_JSON" ]; then
    echo "❌ Error: $GS_JSON no encontrado"
    exit 1
fi

echo "📦 Codificando google-services.json en base64..."
GS_B64=$(base64 -w 0 "$GS_JSON")

echo "🔐 Creando/actualizando secret en EAS..."
echo ""
echo "Ejecutando: eas secret:create --name GOOGLE_SERVICES_JSON_B64"
echo ""

# Crear el secret (EAS pedirá confirmación)
eas secret:create --name GOOGLE_SERVICES_JSON_B64 --value "$GS_B64"

echo ""
echo "✅ Secret creado exitosamente"
echo ""
echo "Próximos pasos:"
echo "1. Verifica que el secret se creó: eas secret:list"
echo "2. Intenta el build: eas build -p android --profile preview"
