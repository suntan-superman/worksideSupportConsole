# Security Risk Acceptance

Date: 2026-06-28

## Purpose

This file records any known security advisories or operational security risks that remain after remediation attempts.

## Acceptance Template

| Date | Area | Risk | Severity | Reason Not Fixed | Compensating Control | Owner | Review Date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-28 | Root dependencies | Firebase Admin / Google Cloud Storage transitive `uuid` advisories remain | Moderate | `npm audit fix --force` suggests a breaking Firebase Admin path; cleanup script still requires Firebase Admin | Keep cleanup script dry-run by default; do not expose it in browser runtime | Workside | TBD |
| 2026-06-28 | Mobile dependencies | Expo/React Native transitive advisories remain | Moderate | SDK upgrade path may be breaking and requires device regression testing | Mobile release remains pilot-only until Expo upgrade is tested | Workside | TBD |

## Rule

No high or critical item should be silently carried into a production launch.
