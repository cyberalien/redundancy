/* eslint-disable @typescript-eslint/no-unused-vars-experimental */
/* eslint-disable @typescript-eslint/no-unused-vars */
import 'mocha';
import { expect } from 'chai';
import { RedundancyConfig } from '../lib/config';
import { Query } from '../lib/query';
import { Redundancy } from '../lib/redundancy';

describe('Query resource order tests', () => {
	const failTimeout = 500;

	it('3 resources, 2 loops', done => {
		const config: RedundancyConfig = {
			resources: ['item 1', 'item 2', 'item 3'],
			index: 0,
			timeout: 10,
			rotate: 10,
			random: false,
			limit: 2,
		};

		const log: string[] = [];

		const fakeParent = {
			setIndex: (index: number): void => {
				done('setIndex should not have been called');
			},
			cleanup: (): void => {
				// Do nothing
			},
		};

		const q1 = new Query(
			fakeParent as Redundancy,
			config,
			'query',
			(resource, payload, status) => {
				log.push(resource);
			}
		);

		setTimeout(() => {
			expect(log).to.be.eql([
				// First loop
				'item 1',
				'item 2',
				'item 3',
				// Second loop
				'item 1',
				'item 2',
				'item 3',
			]);
			done();
		}, failTimeout);
	});

	it('3 resources, 2 loops, start with index 2', done => {
		const config: RedundancyConfig = {
			resources: ['item 1', 'item 2', 'item 3'],
			index: 2,
			timeout: 10,
			rotate: 10,
			random: false,
			limit: 2,
		};

		const log: string[] = [];

		const fakeParent = {
			setIndex: (index: number): void => {
				done('setIndex should not have been called');
			},
			cleanup: (): void => {
				// Do nothing
			},
		};

		const q1 = new Query(
			fakeParent as Redundancy,
			config,
			'query',
			(resource, payload, status) => {
				log.push(resource);
			}
		);

		setTimeout(() => {
			expect(log).to.be.eql([
				// First loop
				'item 3',
				'item 1',
				'item 2',
				// Second loop
				'item 3',
				'item 1',
				'item 2',
			]);
			done();
		}, failTimeout);
	});

	it('3 resources, 2 loops, start with index 1, success on index 2', done => {
		const config: RedundancyConfig = {
			resources: ['item 1', 'item 2', 'item 3'],
			index: 1,
			timeout: 10,
			rotate: 10,
			random: false,
			limit: 3,
		};

		const log: string[] = [];

		const fakeParent = {
			setIndex: (index: number): void => {
				expect(index).to.be.equal(2);
				expect(log).to.be.eql([
					// First loop
					'item 2',
					'item 3',
					'item 1',
					// Second loop
					'item 2',
					'item 3',
				]);
				done();
			},
			cleanup: (): void => {
				// Do nothing
			},
		};

		const q1 = new Query(
			fakeParent as Redundancy,
			config,
			'query',
			(resource, payload, status) => {
				log.push(resource);

				// Complete on attempt 5
				if (status.attempt === 5) {
					status.done();
				}
			}
		);
	});
});
