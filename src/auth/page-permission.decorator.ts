import { SetMetadata } from '@nestjs/common';

import { PageKey } from './page-keys';

export const REQUIRED_PAGES_KEY = 'requiredPages';

// Multiple keys are OR'd together — used only when a single backend resource is
// legitimately reachable from more than one independent frontend page (e.g. the
// Academic/courses-batches endpoints, used from both the Students and Settings
// pages). It is never used to make one page's access depend on another page.
export const RequirePage = (...pages: PageKey[]) =>
  SetMetadata(REQUIRED_PAGES_KEY, pages);
