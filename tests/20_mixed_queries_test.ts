/* eslint-disable @typescript-eslint/no-unused-vars-experimental */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'mocha';
import { expect } from 'chai';
import type { RedundancyConfig } from '../lib/config';
import type { PendingQueryItem } from '../lib/query';
import { sendQuery } from '../lib/query';

describe('Mixed queries with multiple resources', () => {
	it('Random order', (done) => {
		const payload = {};
		const resources = [{}, {}, {}];
		const result = {};
		const config: RedundancyConfig = {
			resources,
			index: 0,
			timeout: 200,
			rotate: 50,
			random: true,
			dataAfterTimeout: false,
		};

		// Tracking
		let isSync = true;
		const startTime = Date.now();
		let sentQuery = 0;

		// Send query
		sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(queryPayload).to.be.equal(payload);

				// Query should be executed at most twice
				expect(sentQuery < 2).to.be.equal(true);

				// Bump counter
				sentQuery++;

				// Complete if index is not 0
				if (resource !== resources[0]) {
					queryItem.done(result);
				}
			},
			(data, error) => {
				// Validate data
				expect(data).to.be.equal(result);
				expect(error).to.be.equal(void 0);

				// Instant
				const diff = Date.now() - startTime;
				expect(diff < 30).to.be.equal(
					true,
					`Time difference: ${diff}, should have been instant`
				);

				done();
			},
			(newIndex) => {
				done(
					'This should not have been called because order is random'
				);
			}
		);

		isSync = false;
	});

	it('Changing index', (done) => {
		const payload = {};
		const resources = [{}, {}, {}];
		const result = {};
		const config: RedundancyConfig = {
			resources,
			index: 1,
			timeout: 200,
			rotate: 50,
			random: false,
			dataAfterTimeout: false,
		};

		// Tracking
		let isSync = true;
		const startTime = Date.now();
		let sentQuery = 0;
		let parentUpdated = false;

		// Send query
		sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(queryPayload).to.be.equal(payload);

				// Check resource order: 1, 2, 0
				const expectedIndex = sentQuery > 1 ? 0 : sentQuery + 1;
				expect(resource).to.be.equal(resources[expectedIndex]);

				// Bump counter
				sentQuery++;

				// Complete if index is 0
				if (resource === resources[0]) {
					queryItem.done(result);
				} else {
					// Fail
					queryItem.done();
				}
			},
			(data, error) => {
				// Validate data
				expect(data).to.be.equal(result);
				expect(error).to.be.equal(void 0);

				// Make sure callback was called
				expect(parentUpdated).to.be.equal(true);

				// Instant
				const diff = Date.now() - startTime;
				expect(diff < 30).to.be.equal(
					true,
					`Time difference: ${diff}, should have been instant`
				);

				done();
			},
			(newIndex) => {
				expect(newIndex).to.be.equal(0);
				parentUpdated = true;
			}
		);

		isSync = false;
	});
});
