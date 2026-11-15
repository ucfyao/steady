import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Opt a route out of the global PlayerGuard. Every other route requires a token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
