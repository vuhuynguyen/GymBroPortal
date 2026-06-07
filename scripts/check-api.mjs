#!/usr/bin/env node
// Regenerates the typed API client from the committed openapi.json and fails if it differs from the
// committed client (src/app/api/generated) — catching backend↔frontend DTO drift in CI.
//
// Sync flow: export the backend spec (GET /openapi/v1.json) into GymBroPortal/openapi.json and commit it,
// then `npm run generate:api` and commit the regenerated client. CI runs this check to keep them in lockstep.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const SPEC = 'openapi.json';
const GENERATED = 'src/app/api/generated';

if (!existsSync(SPEC)) {
  console.warn(
    `[check:api] ${SPEC} not found — skipping. Export it from the backend (/openapi/v1.json) and commit ` +
      `it to enable the drift gate.`
  );
  process.exit(0);
}

execSync(
  `npx openapi-generator-cli generate -i ${SPEC} -g typescript-angular -o ${GENERATED} ` +
    `--additional-properties=ngVersion=21,fileNaming=kebab-case,enumNameSuffix=''`,
  { stdio: 'inherit' }
);

try {
  execSync(`git diff --exit-code -- ${GENERATED}`, { stdio: 'inherit' });
  console.log('[check:api] Generated API client is in sync with openapi.json.');
} catch {
  console.error(
    '[check:api] Generated API client is OUT OF SYNC with openapi.json. ' +
      'Run `npm run generate:api` and commit the result.'
  );
  process.exit(1);
}
