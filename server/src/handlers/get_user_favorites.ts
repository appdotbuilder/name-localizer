import { db } from '../db';
import { nameLocalizationRequestsTable, nameVariantsTable, userFavoritesTable } from '../db/schema';
import { type GetUserFavoritesInput, type NameLocalizationResponse } from '../schema';
import { eq, desc, inArray } from 'drizzle-orm';

export async function getUserFavorites(input: GetUserFavoritesInput): Promise<NameLocalizationResponse[]> {
  try {
    // Get all favorites for the user with related request and variant data
    const favoriteResults = await db.select({
      request_id: userFavoritesTable.request_id,
      created_at: userFavoritesTable.created_at
    })
      .from(userFavoritesTable)
      .where(eq(userFavoritesTable.user_id, input.user_id))
      .orderBy(desc(userFavoritesTable.created_at))
      .execute();

    if (favoriteResults.length === 0) {
      return [];
    }

    // Get unique request IDs to fetch complete localization data
    const requestIds = [...new Set(favoriteResults.map(fav => fav.request_id))];

    // Fetch all localization requests with their variants
    const allResults = await db.select()
      .from(nameLocalizationRequestsTable)
      .innerJoin(
        nameVariantsTable,
        eq(nameLocalizationRequestsTable.id, nameVariantsTable.request_id)
      )
      .where(inArray(nameLocalizationRequestsTable.id, requestIds))
      .execute();

    // Group variants by request ID
    const localizationMap = new Map<number, {
      request: typeof nameLocalizationRequestsTable.$inferSelect;
      variants: Array<Omit<typeof nameVariantsTable.$inferSelect, 'confidence_score'> & { confidence_score: number }>;
    }>();

    allResults.forEach(result => {
      const requestData = (result as any).name_localization_requests;
      const variantData = (result as any).name_variants;

      if (!localizationMap.has(requestData.id)) {
        localizationMap.set(requestData.id, {
          request: requestData,
          variants: []
        });
      }

      // Convert numeric confidence_score back to number
      const variant = {
        ...variantData,
        confidence_score: parseFloat(variantData.confidence_score)
      };

      localizationMap.get(requestData.id)!.variants.push(variant);
    });

    // Build response array maintaining the original favorite order
    const responses: NameLocalizationResponse[] = [];
    for (const favorite of favoriteResults) {
      const localizationData = localizationMap.get(favorite.request_id);
      if (localizationData) {
        responses.push({
          id: localizationData.request.id,
          original_name: localizationData.request.original_name,
          target_language: localizationData.request.target_language,
          gender_preference: localizationData.request.gender_preference,
          output_format: localizationData.request.output_format,
          tone: localizationData.request.tone,
          user_id: localizationData.request.user_id,
          created_at: localizationData.request.created_at,
          variants: localizationData.variants
        });
      }
    }

    return responses;
  } catch (error) {
    console.error('Failed to get user favorites:', error);
    throw error;
  }
}