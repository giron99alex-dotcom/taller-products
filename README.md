# Taller Products - Amazon Lite

Creacion, consulta, listado, actualizacion, eliminacion y manejo de stock. Las respuestas HTTP usan `withCORS`; las funciones invocadas por Orders aceptan eventos internos sin encabezados HTTP.

Rutas: `POST /products/create`, `GET /products/{id}`, `PUT /products/{id}`, `DELETE /products/{id}`, `GET /products`, `GET /products/users/{sellerId}` y `PATCH /products/{id}/stock`.

## Configuracion por ambiente

- `develop`: permite al frontend de `http://localhost:3000` leer las respuestas.
- `prod`: lee el origen real del frontend desde la variable `FRONTEND_ORIGIN` de la terminal. Se usa solo el origen, sin rutas ni barra final.
- `CORS_ORIGINS` puede contener varios origenes separados por comas. El wrapper responde con un solo origen que coincida con la peticion.
- Postman y las invocaciones internas entre Lambdas siguen funcionando sin el encabezado `Origin`.
- CORS controla lo que puede leer el navegador; la autenticacion y los permisos siguen usando JWT e IAM.

El wrapper `src/common/cors.ts` se aplica a los handlers HTTP. Se conservan los nombres exportados que usa `serverless.yml`.

## Comprobacion y despliegue

Se requieren Node.js compatible con el proyecto, AWS CLI configurado y una sesion de Serverless Framework v4.

```powershell
npm ci
npm run typecheck
npx serverless package --config serverless.yml --stage develop --aws-profile taller-gateway-deploy
npx serverless deploy --config serverless.yml --stage develop --aws-profile taller-gateway-deploy
```

El orden entre servicios es **Gateway -> Users -> Products -> Orders**. Al actualizar un Develop que aun usa exportaciones sin stage, primero se realiza la migracion descrita en el README de Gateway.

## Produccion

Las exportaciones e importaciones de CloudFormation incluyen el stage: `develop-MainRestApiId` y `prod-MainRestApiId`, por ejemplo. Las tablas y funciones tambien usan nombres separados por stage.

Antes de desplegar `prod`:

1. Configurar `FRONTEND_ORIGIN` con el origen HTTPS real del frontend en la misma terminal que hara los despliegues. Si se usan varias terminales, configurarla en cada una.
2. Crear en Parameter Store de `us-east-2` los parametros SecureString `/taller/prod/jwt-secret` y `/taller/prod/jwt-refresh-secret`, con valores aleatorios diferentes. Gateway y Users comparten el primero mediante SSM. Los valores no se guardan en Git.
3. Dar al usuario de despliegue los permisos de administracion DynamoDB que ya tiene para Develop, aplicados tambien a las tablas `taller-prod-*`. Los permisos del rol de ejecucion de cada Lambda ya apuntan a sus recursos del stage.
4. Desplegar los cuatro servicios, en el orden anterior, sustituyendo `--stage develop` por `--stage prod`. Usar el `serverless.yml` normal.
5. Configurar el frontend con la URL que devuelva Gateway para ese ambiente y probar las peticiones en el navegador.

`config-prod.json` requiere `FRONTEND_ORIGIN`: no contiene un dominio inventado ni un secreto. La rama Git seleccionada no cambia el stage de AWS automaticamente; lo decide `--stage`.

## GitHub

Subir `src`, `config`, los YAML, `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore` y este README. Crear un repositorio por modulo y las ramas `main` y `develop`, como en el video 39.

El `.gitignore` excluye dependencias, artefactos de Serverless, archivos `.env` y credenciales. Revisar `git status` antes de cada commit. Las carpetas `.serverless` contienen configuracion resuelta y no se suben.
