/**
 * Interfaces from config.ts
 */
import { RedundancyConfig } from './config';
export { RedundancyConfig };

/**
 * Interfaces from query.ts
 */
import {
	Query,
	QueryCallback,
	OptionalDoneCallback,
	PendingItem,
} from './query';

export {
	QueryCallback as RedundancyQueryCallback,
	OptionalDoneCallback as RedundancyOptionalDoneCallback,
	PendingItem as RedundancyPendingItem,
};

export type RedundancyQuery = typeof Query;

/**
 * Interfaces from redundancy.ts
 */
import { Redundancy as RedundancyClass, FilterCallback } from './redundancy';

export { FilterCallback as RedundancyFilterCallback };

export type Redundancy = typeof RedundancyClass;