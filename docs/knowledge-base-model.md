# Knowledge Base Model

Date: 2026-06-28

## Purpose

Provide product-aware answers for public AI support and internal support agents.

## Article Shape

```ts
type KnowledgeBaseArticle = {
  id: string;
  productId: string;
  category: string;
  question: string;
  answer: string;
  tags: string[];
  audience: "public" | "internal";
  status: "draft" | "published" | "archived";
  ownerUserId?: string;
  relatedRelease?: string;
  sourceLinks: Array<{ label: string; url: string }>;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

## Required Rules

- Public widget may only use `audience: "public"` and `status: "published"`.
- Internal articles must never be exposed to customers.
- Articles must be product-scoped.
- Changes should be audit logged.

## Suggested Endpoints

```http
GET /support/kb?productId=...
POST /support/kb
PATCH /support/kb/:articleId
POST /support/kb/:articleId/publish
POST /support/kb/:articleId/archive
```
