/* eslint-disable @typescript-eslint/no-unused-vars-experimental */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'mocha';
import { expect } from 'chai';
import type { RedundancyConfig } from '../lib/config';
import { sendQuery } from '../lib/query';

describe('Multiple resources', () => {
	it('Simple query, success on first attempt', (done) => {
		const payload = {};
		const resources = [{}, {}];
		const result = {};
		const config: RedundancyConfig = {
			resources,
			index: 0,
			timeout: 200,
			rotate: 100,
			random: false,
			dataAfterTimeout: false,
		};

		// Tracking
		let isSync = true;
		const startTime = Date.now();
		let sentQuery = 0;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(resource).to.be.equal(resources[0]);
				expect(queryPayload).to.be.equal(payload);

				// Query should be executed only once because it should finish before second attempt
				expect(sentQuery).to.be.equal(0);
				sentQuery++;

				// Check status
				expect(queryItem.getQueryStatus).to.be.equal(getStatus);
				const status = getStatus();
				expect(status.status).to.be.equal('pending');
				expect(status.payload).to.be.equal(payload);
				expect(status.queriesSent).to.be.equal(1);
				expect(status.queriesPending).to.be.equal(1);

				// Add abort function
				queryItem.abort = (): void => {
					done('Abort should have not been called');
				};

				// Complete
				queryItem.done(result);
			},
			(data, error) => {
				// Make sure query was sent
				expect(sentQuery).to.be.equal(1);

				// Validate data
				expect(data).to.be.equal(result);
				expect(error).to.be.equal(void 0);

				// Check status
				const status = getStatus();
				expect(status.status).to.be.equal('completed');
				expect(status.queriesSent).to.be.equal(1);
				expect(status.queriesPending).to.be.equal(0);

				// Should be almost instant
				const diff = Date.now() - startTime;
				expect(diff < 50).to.be.equal(
					true,
					`Time difference: ${diff}, should have been almost instant`
				);

				done();
			},
			(newIndex) => {
				done('This should not have been called');
			}
		);

		// Check status
		const status = getStatus();
		expect(status.status).to.be.equal('pending');
		expect(status.queriesSent).to.be.equal(0);
		expect(status.queriesPending).to.be.equal(0);

		isSync = false;
	});

	it('Simple query, time out on first, success on second (~100ms)', (done) => {
		const payload = {};
		const resources = [{}, {}];
		const result = {};
		const config: RedundancyConfig = {
			resources,
			index: 0,
			timeout: 200,
			rotate: 100,
			random: false,
			dataAfterTimeout: false,
		};

		// Tracking
		let isSync = true;
		const startTime = Date.now();
		let sentQuery = 0;
		let itemAborted = false;
		let parentUpdated = false;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(queryPayload).to.be.equal(payload);

				// Query should be executed twice
				expect(sentQuery < 2).to.be.equal(true);
				expect(resource).to.be.equal(resources[sentQuery]);

				// Check status
				expect(queryItem.getQueryStatus).to.be.equal(getStatus);
				const status = getStatus();
				expect(status.status).to.be.equal('pending');
				expect(status.payload).to.be.equal(payload);

				// Bump counter
				sentQuery++;

				// All queries should be pending
				expect(status.queriesSent).to.be.equal(sentQuery);
				expect(status.queriesPending).to.be.equal(sentQuery);

				// Add abort function
				// Time out first, complete second
				switch (sentQuery) {
					case 1:
						queryItem.abort = (): void => {
							// First item should be aborted, but only once
							expect(itemAborted).to.be.equal(false);
							// When this is executed, counter should have been increased
							expect(sentQuery).to.be.equal(2);
							itemAborted = true;
						};
						return;

					case 2:
						queryItem.abort = (): void => {
							done('Abort should have not been called');
						};
						queryItem.done(result);
						return;

					default:
						done('This code should not have been reached');
				}
			},
			(data, error) => {
				// Make sure queries were sent
				expect(sentQuery).to.be.equal(2);

				// First query should have been aborted
				expect(itemAborted).to.be.equal(true);

				// Validate data
				expect(data).to.be.equal(result);
				expect(error).to.be.equal(void 0);

				// Check status
				const status = getStatus();
				expect(status.status).to.be.equal('completed');
				expect(status.queriesSent).to.be.equal(2);
				expect(status.queriesPending).to.be.equal(0);

				// Parent should have been updated
				expect(parentUpdated).to.be.equal(true);

				// Delay between first and second queries
				const diff = Date.now() - startTime;
				expect(diff > 50 && diff < 150).to.be.equal(
					true,
					`Time difference: ${diff}, should have been ~100ms`
				);

				done();
			},
			(newIndex) => {
				// Start index should be updated to 1
				expect(newIndex).to.be.equal(1);
				parentUpdated = true;
			}
		);

		// Check status
		const status = getStatus();
		expect(status.status).to.be.equal('pending');
		expect(status.queriesSent).to.be.equal(0);
		expect(status.queriesPending).to.be.equal(0);

		isSync = false;
	});

	it('Time out all queries (~100ms)', (done) => {
		const payload = {};
		const resources = [{}, {}];
		const config: RedundancyConfig = {
			resources,
			index: 0,
			timeout: 50,
			rotate: 25,
			random: false,
			dataAfterTimeout: false,
		};

		// Tracking
		let isSync = true;
		const startTime = Date.now();
		let sentQuery = 0;
		let item1Aborted = false;
		let item2Aborted = false;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(queryPayload).to.be.equal(payload);

				// Query should be executed twice
				expect(sentQuery < 2).to.be.equal(true);
				expect(resource).to.be.equal(resources[sentQuery]);

				// Check status
				expect(queryItem.getQueryStatus).to.be.equal(getStatus);
				const status = getStatus();
				expect(status.status).to.be.equal('pending');
				expect(status.payload).to.be.equal(payload);

				// Bump counter
				sentQuery++;

				// All queries should be pending
				expect(status.queriesSent).to.be.equal(sentQuery);
				expect(status.queriesPending).to.be.equal(sentQuery);

				// Add abort functions
				switch (sentQuery) {
					case 1:
						queryItem.abort = (): void => {
							expect(item1Aborted).to.be.equal(false);
							expect(item2Aborted).to.be.equal(false);
							// This should have been executed at the end
							expect(sentQuery).to.be.equal(2);
							item1Aborted = true;
						};
						return;

					case 2:
						queryItem.abort = (): void => {
							expect(item1Aborted).to.be.equal(true);
							expect(item2Aborted).to.be.equal(false);
							// This should have been executed at the end
							expect(sentQuery).to.be.equal(2);
							item2Aborted = true;
						};
						return;

					default:
						done('This code should not have been reached');
				}
			},
			(data, error) => {
				// Make sure queries were sent
				expect(sentQuery).to.be.equal(2);

				// Queries should have been aborted
				expect(item1Aborted).to.be.equal(true);
				expect(item2Aborted).to.be.equal(true);

				// Validate data
				expect(data).to.be.equal(void 0);
				expect(error).to.be.equal(void 0);

				// Check status
				const status = getStatus();
				expect(status.status).to.be.equal('failed');
				expect(status.queriesSent).to.be.equal(2);
				expect(status.queriesPending).to.be.equal(0);

				// rotate * 2 + timeout
				const diff = Date.now() - startTime;
				expect(diff > 90 && diff < 120).to.be.equal(
					true,
					`Time difference: ${diff}, should have been ~100ms`
				);

				done();
			},
			(newIndex) => {
				done('This should have never been called');
			}
		);

		// Check status
		const status = getStatus();
		expect(status.status).to.be.equal('pending');
		expect(status.queriesSent).to.be.equal(0);
		expect(status.queriesPending).to.be.equal(0);

		isSync = false;
	});

	it('Start with second resource (~100ms)', (done) => {
		const payload = {};
		const resources = [{}, {}];
		const config: RedundancyConfig = {
			resources,
			index: 1,
			timeout: 50,
			rotate: 25,
			random: false,
			dataAfterTimeout: false,
		};

		// Tracking
		let isSync = true;
		const startTime = Date.now();
		let sentQuery = 0;
		let item1Aborted = false;
		let item2Aborted = false;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(queryPayload).to.be.equal(payload);

				// Resource order should be: 1, 0
				expect(resource).to.not.be.equal(resources[sentQuery]);
				expect(resource).to.be.equal(resources[1 - sentQuery]);

				// Bump counter
				sentQuery++;

				// Add abort functions
				switch (sentQuery) {
					case 1:
						queryItem.abort = (): void => {
							item1Aborted = true;
						};
						return;

					case 2:
						queryItem.abort = (): void => {
							item2Aborted = true;
						};
						return;

					default:
						done('This code should not have been reached');
				}
			},
			(data, error) => {
				// Make sure queries were sent
				expect(sentQuery).to.be.equal(2);

				// Queries should have been aborted
				expect(item1Aborted).to.be.equal(true);
				expect(item2Aborted).to.be.equal(true);

				// Validate data
				expect(data).to.be.equal(void 0);
				expect(error).to.be.equal(void 0);

				// rotate * 2 + timeout
				const diff = Date.now() - startTime;
				expect(diff > 90 && diff < 120).to.be.equal(
					true,
					`Time difference: ${diff}, should have been ~100ms`
				);

				done();
			},
			(newIndex) => {
				done('This should have never been called');
			}
		);

		// Check status
		const status = getStatus();
		expect(status.status).to.be.equal('pending');
		expect(status.queriesSent).to.be.equal(0);
		expect(status.queriesPending).to.be.equal(0);

		isSync = false;
	});

	it('Start with last resource (~150ms)', (done) => {
		const payload = {};
		const resources = [{}, {}, {}, {}];
		const config: RedundancyConfig = {
			resources,
			index: 3,
			timeout: 50,
			rotate: 25,
			random: false,
			dataAfterTimeout: false,
		};

		// Tracking
		let isSync = true;
		let sentQuery = 0;
		const startTime = Date.now();

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(queryPayload).to.be.equal(payload);

				// Resource order should be: 3, 0, 1, 2
				expect(resource).to.not.be.equal(resources[sentQuery]);

				const expectedIndex = sentQuery === 0 ? 3 : sentQuery - 1;
				expect(resource).to.be.equal(resources[expectedIndex]);

				// Bump counter
				sentQuery++;
			},
			(data, error) => {
				// Make sure queries were sent
				expect(sentQuery).to.be.equal(4);

				// Validate data
				expect(data).to.be.equal(void 0);
				expect(error).to.be.equal(void 0);

				// rotate * 4 + timeout
				const diff = Date.now() - startTime;
				expect(diff > 140 && diff < 170).to.be.equal(
					true,
					`Time difference: ${diff}, should have been ~150ms`
				);

				done();
			},
			(newIndex) => {
				done('This should have never been called');
			}
		);

		// Check status
		const status = getStatus();
		expect(status.status).to.be.equal('pending');
		expect(status.queriesSent).to.be.equal(0);
		expect(status.queriesPending).to.be.equal(0);

		isSync = false;
	});
});
