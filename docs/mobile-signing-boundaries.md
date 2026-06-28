# Mobile Signing Boundaries

Date: 2026-06-28

## Current Finding

`mobile-support-app/android/app/debug.keystore` is tracked in git.

## Decision

The tracked file is treated as a development-only debug keystore. It must never be used for production signing.

## Required Boundaries

- Production signing keys must not be committed.
- Production signing should use EAS credentials or a secure external secret manager.
- Debug keystores should be ignored for future generated copies.
- Any release signing material must be rotated if accidentally committed.

## Follow-Up

Removing the already tracked debug keystore from git history is a repository hygiene decision. This pass updates ignore rules for future generated keystores but does not destructively remove tracked files.
