/* eslint-disable @typescript-eslint/no-unused-vars-experimental */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'mocha';
import { expect } from 'chai';
import type { RedundancyConfig } from '../lib/config';
import type { PendingQueryItem } from '../lib/query';
import { sendQuery } from '../lib/query';

describe('Advanced queries with multiple resources', () => {
	it('Simple query, time out on first, success on second after third is called, ignore third (~70ms)', (done) => {
		const payload = {};
		const resources = [{}, {}, {}];
		const result = {};
		const config: RedundancyConfig = {
			resources,
			index: 0,
			timeout: 200,
			rotate: 50,
			random: false,
			dataAfterTimeout: false,
		};

		// Tracking
		let isSync = true;
		const startTime = Date.now();
		let sentQuery = 0;
		let itemAborted = false;
		let secondItem: PendingQueryItem;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(queryPayload).to.be.equal(payload);

				// Query should be executed 3 times
				expect(sentQuery < 3).to.be.equal(true);
				expect(resource).to.be.equal(resources[sentQuery]);

				// Check status
				expect(queryItem.getQueryStatus).to.be.equal(getStatus);
				const status = getStatus();
				expect(status.status).to.be.equal('pending');
				expect(status.payload).to.be.equal(payload);

				// Bump counter
				sentQuery++;

				// Tests specific to each query
				switch (sentQuery) {
					case 1:
						// First query
						expect(status.queriesSent).to.be.equal(1);
						expect(status.queriesPending).to.be.equal(1);

						// Add abort
						queryItem.abort = (): void => {
							done(
								'Abort should have not been called for first item'
							);
						};

						// Fail in 20ms
						setTimeout(() => {
							// Status should not have changed
							const status = getStatus();
							expect(status.queriesSent).to.be.equal(1);
							expect(status.queriesPending).to.be.equal(1);

							// Fail
							queryItem.done(void 0, true);
						}, 20);
						return;

					case 2:
						// Only second query should be pending
						expect(status.queriesSent).to.be.equal(2);
						expect(status.queriesPending).to.be.equal(1);

						// Add abort
						queryItem.abort = (): void => {
							done(
								'Abort should have not been called for second item'
							);
						};

						// Save item
						secondItem = queryItem;
						return;

					case 3:
						// 2nd and 3rd queries should be pending
						expect(status.queriesSent).to.be.equal(3);
						expect(status.queriesPending).to.be.equal(2);

						// Add abort
						queryItem.abort = (): void => {
							// This item should be aborted, but only once
							expect(itemAborted).to.be.equal(false);
							expect(sentQuery).to.be.equal(3);
							itemAborted = true;
						};

						// Complete second item
						secondItem.done(result);
						return;

					default:
						done('This code should not have been reached');
				}
			},
			(data, error) => {
				// Make sure queries were sent
				expect(sentQuery).to.be.equal(3);

				// Third query should have been aborted
				expect(itemAborted).to.be.equal(true);

				// Validate data
				expect(data).to.be.equal(result);
				expect(error).to.be.equal(void 0);

				// Check status
				const status = getStatus();
				expect(status.status).to.be.equal('completed');
				expect(status.queriesSent).to.be.equal(3);
				expect(status.queriesPending).to.be.equal(0);

				// 20ms from first query failing, 50ms from delay between second and third
				const diff = Date.now() - startTime;
				expect(diff > 50 && diff < 90).to.be.equal(
					true,
					`Time difference: ${diff}, should have been ~70ms`
				);

				done();
			}
		);

		// Check status
		const status = getStatus();
		expect(status.status).to.be.equal('pending');
		expect(status.queriesSent).to.be.equal(0);
		expect(status.queriesPending).to.be.equal(0);

		isSync = false;
	});

	it('Multiple delayed responses (~100ms)', (done) => {
		const payload = {};
		const resources = [{}, {}];
		const result1 = {};
		const result2 = {};
		const config: RedundancyConfig = {
			resources,
			index: 0,
			timeout: 200,
			rotate: 50,
			random: false,
			dataAfterTimeout: false,
		};

		// Tracking
		let isSync = true;
		const startTime = Date.now();
		let sentQuery = 0;
		let itemAborted = false;
		let firstItem: PendingQueryItem;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(queryPayload).to.be.equal(payload);

				// Query should be executed 2 times
				expect(sentQuery < 2).to.be.equal(true);
				expect(resource).to.be.equal(resources[sentQuery]);

				// Check status
				expect(queryItem.getQueryStatus).to.be.equal(getStatus);
				const status = getStatus();
				expect(status.status).to.be.equal('pending');
				expect(status.payload).to.be.equal(payload);

				// Bump counter
				sentQuery++;

				// Tests specific to each query
				switch (sentQuery) {
					case 1:
						// First query
						expect(status.queriesSent).to.be.equal(1);
						expect(status.queriesPending).to.be.equal(1);

						// Add abort
						queryItem.abort = (): void => {
							done(
								'Abort should have not been called for first item'
							);
						};

						// Store item
						firstItem = queryItem;
						return;

					case 2:
						// Both queries should be pending
						expect(status.queriesSent).to.be.equal(2);
						expect(status.queriesPending).to.be.equal(2);

						// Add abort
						queryItem.abort = (): void => {
							expect(itemAborted).to.be.equal(false);
							itemAborted = true;
						};

						// Complete first item in 20ms (70ms from start), then second item
						setTimeout(() => {
							// Check status
							const status = getStatus();
							expect(status.status).to.be.equal('pending');
							expect(status.queriesSent).to.be.equal(2);
							expect(status.queriesPending).to.be.equal(2);

							firstItem.done(result1);

							// Complete second item in 30 ms
							setTimeout(() => {
								expect(queryItem.status).to.be.equal('aborted');

								// Should not change anything because query is already complete
								queryItem.done(result2);

								// Finish test
								done();
							}, 30);
						}, 20);
						return;

					default:
						done('This code should not have been reached');
				}
			},
			(data, error) => {
				// Make sure queries were sent
				expect(sentQuery).to.be.equal(2);

				// Second query should have been aborted
				expect(itemAborted).to.be.equal(true);

				// Validate data
				expect(data).to.be.equal(result1);
				expect(error).to.be.equal(void 0);

				// Check status
				const status = getStatus();
				expect(status.status).to.be.equal('completed');
				expect(status.queriesSent).to.be.equal(2);
				expect(status.queriesPending).to.be.equal(0);

				// 50ms delay between queries, 20ms delay by test timer
				const diff = Date.now() - startTime;
				expect(diff > 50 && diff < 90).to.be.equal(
					true,
					`Time difference: ${diff}, should have been ~70ms`
				);

				// Do not finish: second item is still pending
			}
		);

		// Check status
		const status = getStatus();
		expect(status.status).to.be.equal('pending');
		expect(status.queriesSent).to.be.equal(0);
		expect(status.queriesPending).to.be.equal(0);

		isSync = false;
	});

	it('Ignored response after time out (~150ms)', (done) => {
		const payload = {};
		const resources = [{}, {}];
		const result = {};
		const config: RedundancyConfig = {
			resources,
			index: 0,
			timeout: 100,
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
		let firstItem: PendingQueryItem;
		let completeCount = 0;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(queryPayload).to.be.equal(payload);

				// Query should be executed 2 times
				expect(sentQuery < 2).to.be.equal(true);
				expect(resource).to.be.equal(resources[sentQuery]);

				// Check status
				expect(queryItem.getQueryStatus).to.be.equal(getStatus);
				const status = getStatus();
				expect(status.status).to.be.equal('pending');
				expect(status.payload).to.be.equal(payload);

				// Bump counter
				sentQuery++;

				// Tests specific to each query
				switch (sentQuery) {
					case 1:
						// First query
						expect(status.queriesSent).to.be.equal(1);
						expect(status.queriesPending).to.be.equal(1);

						// Add abort
						queryItem.abort = (): void => {
							item1Aborted = true;
						};

						// Store item
						firstItem = queryItem;
						return;

					case 2:
						// Both queries should be pending
						expect(status.queriesSent).to.be.equal(2);
						expect(status.queriesPending).to.be.equal(2);

						// Add abort
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

				// Bump couneter
				completeCount++;
				switch (completeCount) {
					case 1:
						// First call: time out
						((): void => {
							// Validate data
							expect(data).to.be.equal(void 0);
							expect(error).to.be.equal(void 0);

							// Check status
							const status = getStatus();
							expect(status.status).to.be.equal('failed');
							expect(status.queriesSent).to.be.equal(2);
							expect(status.queriesPending).to.be.equal(0);

							// 25ms delay between queries * 2 + 100ms timeout
							const diff = Date.now() - startTime;
							expect(diff > 130 && diff < 170).to.be.equal(
								true,
								`Time difference: ${diff}, should have been ~150ms`
							);

							// Send data from first query, which should be ignored because dataAfterTimeout is false
							firstItem.done(result);

							// Complete test
							done();
						})();
						return;

					default:
						done('Callback should have been called only once');
				}
			}
		);

		// Check status
		const status = getStatus();
		expect(status.status).to.be.equal('pending');
		expect(status.queriesSent).to.be.equal(0);
		expect(status.queriesPending).to.be.equal(0);

		isSync = false;
	});

	it('Response after time out (~150ms)', (done) => {
		const payload = {};
		const resources = [{}, {}];
		const result = {};
		const config: RedundancyConfig = {
			resources,
			index: 0,
			timeout: 100,
			rotate: 25,
			random: false,
			dataAfterTimeout: true,
		};

		// Tracking
		let isSync = true;
		const startTime = Date.now();
		let sentQuery = 0;
		let item1Aborted = false;
		let item2Aborted = false;
		let firstItem: PendingQueryItem;
		let completeCount = 0;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(queryPayload).to.be.equal(payload);

				// Query should be executed 2 times
				expect(sentQuery < 2).to.be.equal(true);
				expect(resource).to.be.equal(resources[sentQuery]);

				// Check status
				expect(queryItem.getQueryStatus).to.be.equal(getStatus);
				const status = getStatus();
				expect(status.status).to.be.equal('pending');
				expect(status.payload).to.be.equal(payload);

				// Bump counter
				sentQuery++;

				// Tests specific to each query
				switch (sentQuery) {
					case 1:
						// First query
						expect(status.queriesSent).to.be.equal(1);
						expect(status.queriesPending).to.be.equal(1);

						// Add abort
						queryItem.abort = (): void => {
							item1Aborted = true;
						};

						// Store item
						firstItem = queryItem;
						return;

					case 2:
						// Both queries should be pending
						expect(status.queriesSent).to.be.equal(2);
						expect(status.queriesPending).to.be.equal(2);

						// Add abort
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

				// Bump couneter
				completeCount++;
				switch (completeCount) {
					case 1:
						// First call: time out
						((): void => {
							// Validate data
							expect(data).to.be.equal(void 0);
							expect(error).to.be.equal(void 0);

							// Check status
							const status = getStatus();
							expect(status.status).to.be.equal('failed');
							expect(status.queriesSent).to.be.equal(2);
							expect(status.queriesPending).to.be.equal(0);

							// 25ms delay between queries * 2 + 100ms timeout
							const diff = Date.now() - startTime;
							expect(diff > 130 && diff < 170).to.be.equal(
								true,
								`Time difference: ${diff}, should have been ~150ms`
							);

							// Send data from first query
							firstItem.done(result);
						})();
						return;

					case 2:
						// Second call: data
						((): void => {
							// Validate data
							expect(data).to.be.equal(result);
							expect(error).to.be.equal(void 0);

							// Check status
							const status = getStatus();
							expect(status.status).to.be.equal('completed');
							expect(status.queriesSent).to.be.equal(2);
							expect(status.queriesPending).to.be.equal(0);

							// Same as few lines above
							const diff = Date.now() - startTime;
							expect(diff > 130 && diff < 170).to.be.equal(
								true,
								`Time difference: ${diff}, should have been ~150ms`
							);

							// Done
							done();
						})();
						return;

					default:
						done('Callback should have been called only twice');
				}
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
