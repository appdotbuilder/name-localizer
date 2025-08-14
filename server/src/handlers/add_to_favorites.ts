import { db } from '../db';
import { userFavoritesTable, nameLocalizationRequestsTable, nameVariantsTable } from '../db/schema';
import { type AddToFavoritesInput, type UserFavorite } from '../schema';
import { eq, and } from 'drizzle-orm';

export const addToFavorites = async (input: AddToFavoritesInput): Promise<UserFavorite> => {
  try {
    // First verify that the request exists
    const requestExists = await db.select()
      .from(nameLocalizationRequestsTable)
      .where(eq(nameLocalizationRequestsTable.id, input.request_id))
      .execute();

    if (requestExists.length === 0) {
      throw new Error('Name localization request not found');
    }

    // Verify that the variant exists and belongs to the request
    const variantExists = await db.select()
      .from(nameVariantsTable)
      .where(and(
        eq(nameVariantsTable.id, input.variant_id),
        eq(nameVariantsTable.request_id, input.request_id)
      ))
      .execute();

    if (variantExists.length === 0) {
      throw new Error('Name variant not found or does not belong to the specified request');
    }

    // Check if the favorite already exists for this user
    const existingFavorite = await db.select()
      .from(userFavoritesTable)
      .where(and(
        eq(userFavoritesTable.user_id, input.user_id),
        eq(userFavoritesTable.request_id, input.request_id),
        eq(userFavoritesTable.variant_id, input.variant_id)
      ))
      .execute();

    if (existingFavorite.length > 0) {
      throw new Error('This name variant is already in user favorites');
    }

    // Create the new favorite entry
    const result = await db.insert(userFavoritesTable)
      .values({
        user_id: input.user_id,
        request_id: input.request_id,
        variant_id: input.variant_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Add to favorites failed:', error);
    throw error;
  }
};