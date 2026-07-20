# vinc-cms-admin

VINC CMS admin module: page/home builder engine, screens, and typed API client for the CS B2C CMS backend.

## Status

This package is being extracted incrementally from the CommerceSuite (CS) admin app's page-builder engine. The current scope (Task A1) covers only the block **types** and **registry**:

- `types.ts` — all page-builder types (`PageBlock`, `PageConfig`, `PageVersion`, `PageSEOSettings`, `BlockConfig`, `FormBlockConfig`, and related block-family types), extracted verbatim from CS `src/lib/types/blocks.ts`.
- `registry.ts` — the block registry (`BLOCK_REGISTRY`, `getBlockTemplate`, `getAllBlockTemplates`, `DEFAULT_HOME_BLOCKS`, `resolveDefaultBlocks`) and the builder whitelists (`PAGE_BLOCKS`, `HOME_PAGE_BLOCKS`), extracted from CS `config/blocks.config.ts` and `src/lib/config/blockTemplates.ts`.

A typed API client (`CmsAdminClient`) and the React builder UI will follow in later tasks.

## Usage

```ts
import {
  BLOCK_REGISTRY,
  getBlockTemplate,
  getAllBlockTemplates,
  DEFAULT_HOME_BLOCKS,
  resolveDefaultBlocks,
  PAGE_BLOCKS,
  HOME_PAGE_BLOCKS,
} from 'vinc-cms-admin';
```
