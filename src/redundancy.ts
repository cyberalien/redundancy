import { RedundancyConfig, defaultConfig } from './config';
import {
	sendQuery,
	GetQueryStatus,
	QueryCallback,
	OptionalDoneCallback,
} from './query';

/**
 * Function to filter item
 */
export interface FilterCallback {
	(item: GetQueryStatus): boolean;
}

/**
 * Redundancy instance
 */
export interface Redundancy {
	// Send query
	query: (
		payload: unknown,
		queryCallback: QueryCallback,
		doneCallback?: OptionalDoneCallback
	) => GetQueryStatus;

	// Find Query instance
	find: (callback: FilterCallback) => GetQueryStatus | null;

	// Set resource start index. Used by Query instances to change resource index to last successful resource
	setIndex: (index: number) => void;

	// Get resource start index. Store it in configuration
	getIndex: () => number;

	// Remove aborted and completed queries
	cleanup: () => void;
}

/**
 * Set configuration
 */
function setConfig(config: Partial<RedundancyConfig>): RedundancyConfig {
	if (
		typeof config !== 'object' ||
		typeof (config as RedundancyConfig).resources !== 'object' ||
		!((config as RedundancyConfig).resources instanceof Array) ||
		!(config as RedundancyConfig).resources.length
	) {
		throw new Error('Invalid Reduncancy configuration');
	}

	const newConfig = Object.create(null);
	let key: keyof RedundancyConfig;
	for (key in defaultConfig) {
		if (config[key] !== void 0) {
			newConfig[key] = config[key];
		} else {
			newConfig[key] = defaultConfig[key];
		}
	}

	return newConfig;
}

/**
 * Redundancy instance
 */
export function initRedundancy(cfg: Partial<RedundancyConfig>): Redundancy {
	// Configuration
	const config: RedundancyConfig = setConfig(cfg);

	// List of queries
	let queries: GetQueryStatus[] = [];

	/**
	 * Send query
	 */
	function query(
		payload: unknown,
		queryCallback: QueryCallback,
		doneCallback: OptionalDoneCallback = null
	): GetQueryStatus {
		const query = sendQuery(
			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			instance,
			config,
			payload,
			queryCallback,
			doneCallback
		);
		queries.push(query);
		return query;
	}

	/**
	 * Find instance
	 */
	function find(callback: FilterCallback): GetQueryStatus | null {
		const result = queries.find(value => {
			return callback(value);
		});
		return result !== void 0 ? result : null;
	}

	/**
	 * Remove aborted and completed queries
	 */
	function cleanup(): void {
		queries = queries.filter(item => item().status === 'pending');
	}

	// Create and return functions
	const instance: Redundancy = {
		query,
		find,
		setIndex: (index: number) => {
			config.index = index;
		},
		getIndex: () => config.index,
		cleanup,
	};

	return instance;
}
