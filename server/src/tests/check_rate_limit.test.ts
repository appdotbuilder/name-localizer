import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { rateLimitsTable } from '../db/schema';
import { type CheckRateLimitInput } from '../schema';
import { checkRateLimit } from '../handlers/check_rate_limit';
import { eq, and, isNull } from 'drizzle-orm';

// Test inputs
const testInputIP: CheckRateLimitInput = {
    ip_address: '192.168.1.100'
};

const testInputIPWithUser: CheckRateLimitInput = {
    ip_address: '192.168.1.101',
    user_id: 'user123'
};

describe('checkRateLimit', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    it('should allow first request and create rate limit record', async () => {
        const result = await checkRateLimit(testInputIP);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(99); // 100 max - 1 used = 99 remaining
        expect(result.resetTime).toBeInstanceOf(Date);
        expect(result.resetTime.getTime()).toBeGreaterThan(Date.now());

        // Verify rate limit record was created
        const rateLimits = await db.select()
            .from(rateLimitsTable)
            .where(
                and(
                    eq(rateLimitsTable.ip_address, testInputIP.ip_address),
                    isNull(rateLimitsTable.user_id)
                )
            )
            .execute();

        expect(rateLimits).toHaveLength(1);
        expect(rateLimits[0].ip_address).toEqual(testInputIP.ip_address);
        expect(rateLimits[0].user_id).toBeNull();
        expect(rateLimits[0].request_count).toEqual(1);
        expect(rateLimits[0].window_start).toBeInstanceOf(Date);
    });

    it('should track requests with user_id when provided', async () => {
        const result = await checkRateLimit(testInputIPWithUser);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(99);

        // Verify rate limit record was created with user_id
        const rateLimits = await db.select()
            .from(rateLimitsTable)
            .where(
                and(
                    eq(rateLimitsTable.ip_address, testInputIPWithUser.ip_address),
                    eq(rateLimitsTable.user_id, testInputIPWithUser.user_id!)
                )
            )
            .execute();

        expect(rateLimits).toHaveLength(1);
        expect(rateLimits[0].user_id).toEqual(testInputIPWithUser.user_id!);
        expect(rateLimits[0].request_count).toEqual(1);
    });

    it('should increment request count for subsequent requests', async () => {
        // First request
        await checkRateLimit(testInputIP);

        // Second request
        const result = await checkRateLimit(testInputIP);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(98); // 100 max - 2 used = 98 remaining

        // Verify request count was updated
        const rateLimits = await db.select()
            .from(rateLimitsTable)
            .where(eq(rateLimitsTable.ip_address, testInputIP.ip_address))
            .execute();

        expect(rateLimits).toHaveLength(1);
        expect(rateLimits[0].request_count).toEqual(2);
    });

    it('should reject requests when rate limit is exceeded', async () => {
        // Create a rate limit record with max requests
        await db.insert(rateLimitsTable)
            .values({
                ip_address: testInputIP.ip_address,
                user_id: null,
                request_count: 100,
                window_start: new Date()
            })
            .execute();

        const result = await checkRateLimit(testInputIP);

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.resetTime).toBeInstanceOf(Date);
        expect(result.resetTime.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle multiple rate limit records within window', async () => {
        const now = new Date();
        const windowStart = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

        // Create multiple records within the window
        await db.insert(rateLimitsTable)
            .values([
                {
                    ip_address: testInputIP.ip_address,
                    user_id: null,
                    request_count: 50,
                    window_start: windowStart
                },
                {
                    ip_address: testInputIP.ip_address,
                    user_id: null,
                    request_count: 25,
                    window_start: new Date(windowStart.getTime() + 10 * 60 * 1000) // 10 minutes later
                }
            ])
            .execute();

        const result = await checkRateLimit(testInputIP);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(24); // 100 max - 75 existing - 1 current = 24 remaining
    });

    it('should reset rate limit after window expires', async () => {
        const oldWindowStart = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

        // Create old rate limit record outside current window
        await db.insert(rateLimitsTable)
            .values({
                ip_address: testInputIP.ip_address,
                user_id: null,
                request_count: 100,
                window_start: oldWindowStart
            })
            .execute();

        const result = await checkRateLimit(testInputIP);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(99); // Should allow requests again

        // Verify new rate limit record was created
        const rateLimits = await db.select()
            .from(rateLimitsTable)
            .where(eq(rateLimitsTable.ip_address, testInputIP.ip_address))
            .execute();

        expect(rateLimits).toHaveLength(2); // Old record + new record
        const newRecord = rateLimits.find(record => record.request_count === 1);
        expect(newRecord).toBeDefined();
        expect(newRecord!.window_start.getTime()).toBeGreaterThan(oldWindowStart.getTime());
    });

    it('should calculate correct reset time based on earliest request', async () => {
        const windowStart = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

        await db.insert(rateLimitsTable)
            .values({
                ip_address: testInputIP.ip_address,
                user_id: null,
                request_count: 50,
                window_start: windowStart
            })
            .execute();

        const result = await checkRateLimit(testInputIP);

        expect(result.allowed).toBe(true);
        
        // Reset time should be 1 hour from the earliest window start
        const expectedResetTime = new Date(windowStart.getTime() + 60 * 60 * 1000);
        expect(Math.abs(result.resetTime.getTime() - expectedResetTime.getTime())).toBeLessThan(1000); // Within 1 second
    });

    it('should handle separate tracking for different IPs', async () => {
        const input1: CheckRateLimitInput = { ip_address: '192.168.1.1' };
        const input2: CheckRateLimitInput = { ip_address: '192.168.1.2' };

        // Make requests from different IPs
        const result1 = await checkRateLimit(input1);
        const result2 = await checkRateLimit(input2);

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);
        expect(result1.remaining).toBe(99);
        expect(result2.remaining).toBe(99);

        // Verify separate records were created
        const allRateLimits = await db.select()
            .from(rateLimitsTable)
            .execute();

        expect(allRateLimits).toHaveLength(2);
        const ips = allRateLimits.map(record => record.ip_address);
        expect(ips).toContain(input1.ip_address);
        expect(ips).toContain(input2.ip_address);
    });

    it('should handle separate tracking for same IP with different users', async () => {
        const input1: CheckRateLimitInput = { 
            ip_address: '192.168.1.1',
            user_id: 'user1'
        };
        const input2: CheckRateLimitInput = { 
            ip_address: '192.168.1.1',
            user_id: 'user2'
        };

        const result1 = await checkRateLimit(input1);
        const result2 = await checkRateLimit(input2);

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);
        expect(result1.remaining).toBe(99);
        expect(result2.remaining).toBe(99);

        // Verify separate records were created for different users
        const rateLimits = await db.select()
            .from(rateLimitsTable)
            .where(eq(rateLimitsTable.ip_address, '192.168.1.1'))
            .execute();

        expect(rateLimits).toHaveLength(2);
        const userIds = rateLimits.map(record => record.user_id);
        expect(userIds).toContain('user1');
        expect(userIds).toContain('user2');
    });

    it('should handle edge case when exactly at rate limit', async () => {
        // Create record with 99 requests (one below limit)
        await db.insert(rateLimitsTable)
            .values({
                ip_address: testInputIP.ip_address,
                user_id: null,
                request_count: 99,
                window_start: new Date()
            })
            .execute();

        const result = await checkRateLimit(testInputIP);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0); // This will be the 100th request

        // Verify the request count was updated
        const rateLimits = await db.select()
            .from(rateLimitsTable)
            .where(eq(rateLimitsTable.ip_address, testInputIP.ip_address))
            .execute();

        expect(rateLimits[0].request_count).toBe(100);
    });
});