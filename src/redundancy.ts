// Allow <any> type because query and resource can be anything
/* eslint-disable @typescript-eslint/no-explicit-any */

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
 * Redundancy class
 */
export class Redundancy {
	private config: RedundancyConfig;
	private queries: GetQueryStatus[] = [];

	/**
	 * Constructor. Accepts partial RedundancyConfig object as parameter, merges with defaults
	 */
	constructor(config: object) {
		if (
			typeof config !== 'object' ||
			typeof (config as RedundancyConfig).resources !== 'object' ||
			!((config as RedundancyConfig).resources instanceof Array) ||
			!(config as RedundancyConfig).resources.length
		) {
			throw new Error('Invalid Reduncancy constructor parameter');
		}

		this.config = Object.assign({}, defaultConfig, config);
		this.cleanup = this.cleanup.bind(this);
	}

	/**
	 * Send query
	 */
	query(
		payload: any,
		queryCallback: QueryCallback,
		doneCallback: OptionalDoneCallback = null
	): GetQueryStatus {
		const query = sendQuery(
			this,
			this.config,
			payload,
			queryCallback,
			doneCallback
		);
		this.queries.push(query);
		return query;
	}

	/**
	 * Find Query instance
	 */
	find(callback: FilterCallback): GetQueryStatus | null {
		const result = this.queries.find(value => {
			return callback(value);
		});
		return result !== void 0 ? result : null;
	}

	/**
	 * Change configuration
	 */
	setConfig(config: object): void {
		Object.assign(this.config, config);
	}

	/**
	 * Set resource start index. Used by Query instances to change resource index to last successful resource
	 */
	setIndex(index: number): void {
		this.config.index = index;
	}

	/**
	 * Get resource start index. Store it in configuration
	 */
	getIndex(): number {
		return this.config.index;
	}

	/**
	 * Remove aborted and completed instances
	 */
	cleanup(): void {
		this.queries = this.queries.filter(item => item().status === 'pending');
	}
}
