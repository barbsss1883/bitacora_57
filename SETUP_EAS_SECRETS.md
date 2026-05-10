# 🔐 Configuración de EAS Build: google-services.json

El archivo `google-services.json` está excluido de git por seguridad, pero es **requerido** para que EAS Build funcione correctamente en Android.

## 🚀 Solución: Variables de Entorno en EAS

Se ha configurado un hook pre-build que decodificará la variable de entorno `GOOGLE_SERVICES_JSON_B64` y creará el archivo antes de compilar.

### Paso 1: Crear el Secret en EAS

Ejecuta el siguiente comando para codificar y registrar el archivo:

```bash
eas secret:create --name GOOGLE_SERVICES_JSON_B64 --value "$(base64 -w 0 google-services.json)"
```

Alternativamente, usa el script:
```bash
bash scripts/setup-eas-secret.sh
```

### Paso 2: Verificar que el Secret se Creó

```bash
eas secret:list
```

Deberías ver `GOOGLE_SERVICES_JSON_B64` en la lista.

### Paso 3: Intentar el Build Nuevamente

```bash
# Para pruebas
eas build -p android --profile preview

# O para producción
eas build -p android --profile production
```

El hook automáticamente:
1. Decodificará la variable de entorno
2. Creará `google-services.json` en la raíz del proyecto
3. Gradle lo encontrará y continuará el build

## 🔍 Troubleshooting

**Problema:** "GOOGLE_SERVICES_JSON_B64 no encontrado en EAS"

**Solución:**
1. Verifica que has ejecutado `eas secret:create` correctamente
2. Asegúrate que estés en el directorio del proyecto
3. Verifica que tienes permisos en el proyecto EAS: `eas account:login`

**Problema:** El hook dice "JSON inválido"

**Solución:**
1. Verifica que `google-services.json` es un JSON válido: `jq . google-services.json`
2. Regenera el base64: `eas secret:create --name GOOGLE_SERVICES_JSON_B64 --value "$(base64 -w 0 google-services.json)"`

## 📋 Configuración Actual

- **Hook:** `eas-hooks/eas-build-pre-install.js`
- **Profiles afectados:** `development`, `preview`, `production`
- **Variable de entorno:** `GOOGLE_SERVICES_JSON_B64`

El hook se ejecuta **antes** de `npm install`, lo que garantiza que Firebase/Google Play Services tengan acceso al archivo.
