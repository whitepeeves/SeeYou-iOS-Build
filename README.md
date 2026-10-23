# SeeYou - iOS Build

Este repositorio contiene **solo el cliente** (web + Capacitor) de SeeYou, usado
exclusivamente para compilar la app de iOS gratis en GitHub Actions (runners
`macos-latest`, minutos ilimitados en repos publicos).

El backend, la logica de negocio y los secretos de produccion viven en un
repositorio **privado** aparte y nunca se suben aqui.

## Que hay aqui
- `src/` - cliente web (HTML/CSS/JS) que se empaqueta con Capacitor
- `android/`, `ios/` - proyectos nativos generados por Capacitor
- `capacitor.config.json`, `package.json` - configuracion minima de Capacitor

## Como compilar localmente
```bash
npm install
npx cap sync ios
cd ios/App && pod install
npx cap open ios   # abre Xcode
```

## Build automatico (GitHub Actions)
Cada push a `main` dispara `.github/workflows/build-ios.yml`:
- **Sin secretos configurados**: compila el proyecto sin firmar, solo para
  verificar que compila correctamente (no genera un .ipa instalable).
- **Con secretos configurados**: genera y firma un `.ipa` listo para subir a
  TestFlight / App Store, disponible como artefacto del workflow run.

### Secrets necesarios para build firmado
Configuralos en *Settings > Secrets and variables > Actions* de este repo:

| Secret | Que es |
|---|---|
| `APPLE_CERTIFICATE_P12` | Certificado de distribucion Apple (.p12) codificado en base64 |
| `APPLE_CERTIFICATE_PASSWORD` | Password del .p12 |
| `APPLE_PROVISIONING_PROFILE` | Perfil de aprovisionamiento (.mobileprovision) codificado en base64 |

Tambien edita `.github/exportOptions.plist` con tu `teamID` real y el nombre
exacto de tu perfil de aprovisionamiento.

Para convertir un archivo a base64 (en Mac/Linux): `base64 -i archivo.p12 | pbcopy`
