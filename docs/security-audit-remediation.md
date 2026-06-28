# Security Audit Remediation

Date: 2026-06-28

## Latest Local Results

Initial root app:

- Command: `npm audit --omit=dev`
- Result: failed
- Count: 15 vulnerabilities
- Notable areas: `axios`, `react-router`, `react-router-dom`, `firebase-admin` transitive dependencies, `protobufjs`, `@grpc/grpc-js`

Initial mobile app:

- Command: `npm --prefix mobile-support-app audit --omit=dev`
- Result: failed
- Count: 28 vulnerabilities
- Notable areas: `shell-quote`, `undici`, `ws`, Expo/React Native transitive dependencies, `protobufjs`, `@grpc/grpc-js`

After this remediation pass:

- Root direct dependencies were reduced to `firebase` and `firebase-admin`.
- Unused direct packages removed: `axios`, `react-router-dom`, `@tanstack/react-query`, `clsx`, `dayjs`, `autoprefixer`, `postcss`, `tailwindcss`.
- `firebase-admin` was upgraded to `14.1.0`.
- Root audit is reduced to 6 moderate transitive advisories under the Firebase Admin / Google Cloud Storage chain.
- Mobile added `expo-secure-store`.
- Mobile non-breaking audit fixes reduced audit status to 20 moderate advisories. High and critical mobile advisories observed in the initial pass were removed.

## Remediation Policy

1. Fix direct dependencies first when compatible.
2. Run `npm audit fix` only after reviewing lockfile impact.
3. Use `npm audit fix --force` only when the breaking upgrade path is intentionally scheduled and tested.
4. Document any high or critical advisory that cannot be immediately fixed.
5. Include audit status in release certification output.

## Initial Risk Notes

- Root `firebase-admin` remains because `scripts/purge-chat-sessions-before.js` uses it for dry-run-first Firestore cleanup.
- Mobile advisories are largely Expo/React Native transitive. Remediation may require Expo SDK upgrades and mobile regression testing.

## Next Actions

- Review Firebase Admin transitive advisories and decide whether to accept, isolate the cleanup script into a separate tooling package, or wait for upstream fixes.
- Plan Expo SDK upgrade testing before using `npm audit fix --force`.
- Re-run root and mobile audits.
- Track remaining high/critical items in `docs/security-risk-acceptance.md`.
