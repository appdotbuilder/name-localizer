import { db } from '../db';
import { userFavoritesTable } from '../db/schema';
import { type RemoveFavoriteInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export const removeFavorite = async (input: RemoveFavoriteInput): Promise<boolean> => {
  try {
    // Delete the favorite by ID and user_id to ensure ownership
    const result = await db.delete(userFavoritesTable)
      .where(
        and(
          eq(userFavoritesTable.id, input.favorite_id),
          eq(userFavoritesTable.user_id, input.user_id)
        )
      )
      .returning()
      .execute();

    // Return true if a record was deleted, false if no matching favorite was found
    return result.length > 0;
  } catch (error) {
    console.error('Remove favorite failed:', error);
    throw error;
  }
};