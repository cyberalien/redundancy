/**
 * Interfaces from config.ts
 */
import { RedundancyConfig } from './config';
export { RedundancyConfig };

/**
 * Interfaces from query.ts
 */
import {
	sendQuery,
	GetQueryStatus,
	QueryCallback,
	OptionalDoneCallback,
	PendingItem,
} from './query';

export {
	sendQuery as sendRedundancyQuery,
	GetQueryStatus as GetRedundancyQueryStatus,
	QueryCallback as RedundancyQueryCallback,
	OptionalDoneCallback as RedundancyOptionalDoneCallback,
	PendingItem as RedundancyPendingItem,
};

/**
 * Interfaces from redundancy.ts
 */
import { initRedundancy, Redundancy, FilterCallback } from './redundancy';

export { initRedundancy, Redundancy };
export { FilterCallback as RedundancyFilterCallback };
