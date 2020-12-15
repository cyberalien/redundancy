/* eslint-disable @typescript-eslint/no-unused-vars-experimental */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'mocha';
import { expect } from 'chai';
import type { RedundancyConfig } from '../lib/config';
import { sendQuery } from '../lib/query';

describe('Basic queries', () => {
	it('Empty query', (done) => {
		const payload = {};
		const config: RedundancyConfig = {
			resources: [],
			index: 0,
			timeout: 200,
			rotate: 100,
			random: false,
			dataAfterTimeout: false,
		};

		// Tracking
		let isSync = true;
		const startTime = Date.now();

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				done('Query should not be called when resources list is empty');
			},
			(data, error) => {
				expect(isSync).to.be.equal(false);
				expect(data).to.be.equal(void 0);
				expect(error).to.be.equal(void 0);

				// Check status
				const status = getStatus();
				expect(status.status).to.be.equal('failed');
				expect(status.queriesSent).to.be.equal(0);
				expect(status.queriesPending).to.be.equal(0);

				// Should be almost instant: no items in queue
				const diff = Date.now() - startTime;
				expect(diff < 50).to.be.equal(
					true,
					`Time difference: ${diff}, should have been almost instant`
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

	it('Simple query', (done) => {
		const payload = {};
		const resources = [{}];
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
		let sentQuery = false;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(resource).to.be.equal(resources[0]);
				expect(queryPayload).to.be.equal(payload);

				// Make sure query was executed only once
				expect(sentQuery).to.be.equal(false);
				sentQuery = true;

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
				expect(sentQuery).to.be.equal(true);

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
			}
		);

		// Check status
		const status = getStatus();
		expect(status.status).to.be.equal('pending');
		expect(status.queriesSent).to.be.equal(0);
		expect(status.queriesPending).to.be.equal(0);

		isSync = false;
	});

	it('Failing query', (done) => {
		const payload = {};
		const resources = [{}];
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
		let sentQuery = false;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(resource).to.be.equal(resources[0]);
				expect(queryPayload).to.be.equal(payload);

				// Make sure query was executed only once
				expect(sentQuery).to.be.equal(false);
				sentQuery = true;

				// Add abort function
				queryItem.abort = (): void => {
					done('Abort should have not been called');
				};

				// Fail
				queryItem.done(void 0, result);
			},
			(data, error) => {
				// Make sure query was sent
				expect(sentQuery).to.be.equal(true);

				// Validate data
				expect(data).to.be.equal(void 0);
				expect(error).to.be.equal(result);

				// Check status
				const status = getStatus();
				expect(status.status).to.be.equal('failed');
				expect(status.queriesSent).to.be.equal(1);
				expect(status.queriesPending).to.be.equal(0);

				// Should be almost instant
				const diff = Date.now() - startTime;
				expect(diff < 40).to.be.equal(
					true,
					`Time difference: ${diff}, should have been almost instant`
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

	it('Timed out query (~300ms)', (done) => {
		const payload = {};
		const resources = [{}];
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
		let sentQuery = false;
		let itemAborted = false;

		// Send query
		const getStatus = sendQuery(
			config,
			payload,
			(resource, queryPayload, queryItem) => {
				expect(isSync).to.be.equal(false);
				expect(resource).to.be.equal(resources[0]);
				expect(queryPayload).to.be.equal(payload);

				// Make sure query was executed only once
				expect(sentQuery).to.be.equal(false);
				sentQuery = true;

				// Add abort function
				queryItem.abort = (): void => {
					expect(itemAborted).to.be.equal(false);
					itemAborted = true;
				};

				// Do not do anything
			},
			(data, error) => {
				// Make sure query was sent
				expect(sentQuery).to.be.equal(true);

				// Validate data
				expect(data).to.be.equal(void 0);
				expect(error).to.be.equal(void 0);

				// Check status
				const status = getStatus();
				expect(status.status).to.be.equal('failed');
				expect(status.queriesSent).to.be.equal(1);
				expect(status.queriesPending).to.be.equal(0);

				// Item should have been aborted
				expect(itemAborted).to.be.equal(true);

				// Should have been config.rotate + config.timeout
				const diff = Date.now() - startTime;
				expect(diff > 250).to.be.equal(
					true,
					`Time difference: ${diff}, should have been >= 300ms`
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
});
