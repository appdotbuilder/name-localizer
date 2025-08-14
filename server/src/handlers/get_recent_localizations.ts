import { db } from '../db';
import { nameLocalizationRequestsTable, nameVariantsTable } from '../db/schema';
import { type NameLocalizationResponse } from '../schema';
import { desc, eq } from 'drizzle-orm';

export async function getRecentLocalizations(limit: number = 10): Promise<NameLocalizationResponse[]> {
  try {
    // Fetch the most recent name localizations, sorted by creation date (most recent first)
    const recentRequests = await db.select()
      .from(nameLocalizationRequestsTable)
      .orderBy(desc(nameLocalizationRequestsTable.created_at))
      .limit(limit)
      .execute();

    // For each request, fetch its variants
    const results: NameLocalizationResponse[] = [];

    for (const request of recentRequests) {
      const variants = await db.select()
        .from(nameVariantsTable)
        .where(eq(nameVariantsTable.request_id, request.id))
        .orderBy(desc(nameVariantsTable.created_at))
        .execute();

      // Convert numeric fields and anonymize user_id
      const convertedVariants = variants.map(variant => ({
        ...variant,
        confidence_score: parseFloat(variant.confidence_score) // Convert numeric to number
      }));

      // Add to results with anonymized user_id (set to null for privacy)
      results.push({
        ...request,
        user_id: null, // Anonymize user data for public endpoint
        variants: convertedVariants
      });
    }

    return results;
  } catch (error) {
    console.error('Failed to fetch recent localizations:', error);
    throw error;
  }
}