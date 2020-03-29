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
import { Redundancy, FilterCallback } from './redundancy';

export { Redundancy };
export { FilterCallback as RedundancyFilterCallback };
