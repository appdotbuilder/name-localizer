import { db } from '../db';
import { rateLimitsTable } from '../db/schema';
import { type CheckRateLimitInput } from '../schema';
import { eq, and, gte } from 'drizzle-orm';

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
}

// Rate limiting configuration
const MAX_REQUESTS_PER_WINDOW = 100; // 100 requests per hour
const WINDOW_SIZE_MS = 60 * 60 * 1000; // 1 hour in milliseconds

export async function checkRateLimit(input: CheckRateLimitInput): Promise<RateLimitResult> {
    try {
        const now = new Date();
        const windowStart = new Date(now.getTime() - WINDOW_SIZE_MS);

        // Look for existing rate limit record for this IP/user within the current window
        const conditions = [
            eq(rateLimitsTable.ip_address, input.ip_address),
            gte(rateLimitsTable.window_start, windowStart)
        ];

        // Add user_id condition if provided
        if (input.user_id) {
            conditions.push(eq(rateLimitsTable.user_id, input.user_id));
        }

        const existingLimits = await db.select()
            .from(rateLimitsTable)
            .where(and(...conditions))
            .execute();

        // Calculate total requests in current window
        const totalRequests = existingLimits.reduce((sum, limit) => sum + limit.request_count, 0);
        const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - totalRequests - 1);
        
        // Calculate when the window resets (1 hour from the earliest request in window)
        const earliestRequest = existingLimits.length > 0 
            ? new Date(Math.min(...existingLimits.map(limit => limit.window_start.getTime())))
            : now;
        const resetTime = new Date(earliestRequest.getTime() + WINDOW_SIZE_MS);

        // Check if rate limit is exceeded
        if (totalRequests >= MAX_REQUESTS_PER_WINDOW) {
            return {
                allowed: false,
                remaining: 0,
                resetTime
            };
        }

        // Create or update rate limit record
        if (existingLimits.length > 0) {
            // Update existing record (increment request count)
            const latestLimit = existingLimits.reduce((latest, current) => 
                current.created_at > latest.created_at ? current : latest
            );

            await db.update(rateLimitsTable)
                .set({ 
                    request_count: latestLimit.request_count + 1,
                    created_at: now
                })
                .where(eq(rateLimitsTable.id, latestLimit.id))
                .execute();
        } else {
            // Create new rate limit record
            await db.insert(rateLimitsTable)
                .values({
                    ip_address: input.ip_address,
                    user_id: input.user_id ?? null,
                    request_count: 1,
                    window_start: now
                })
                .execute();
        }

        return {
            allowed: true,
            remaining,
            resetTime
        };
    } catch (error) {
        console.error('Rate limit check failed:', error);
        throw error;
    }
}