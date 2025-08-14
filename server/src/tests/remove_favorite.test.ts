import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  nameLocalizationRequestsTable, 
  nameVariantsTable, 
  userFavoritesTable 
} from '../db/schema';
import { type RemoveFavoriteInput } from '../schema';
import { removeFavorite } from '../handlers/remove_favorite';
import { eq, and } from 'drizzle-orm';

describe('removeFavorite', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should remove a favorite successfully', async () => {
    // Create test data
    const requestResult = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'John',
        target_language: 'chinese',
        gender_preference: 'male',
        output_format: 'both',
        tone: 'formal',
        user_id: 'user123'
      })
      .returning()
      .execute();

    const variantResult = await db.insert(nameVariantsTable)
      .values({
        request_id: requestResult[0].id,
        variant_type: 'medium',
        native_script: '约翰',
        romanization: 'Yuē hàn',
        meaning: 'God is gracious',
        pronunciation: 'yue-han',
        cultural_notes: 'Common transliteration',
        confidence_score: '0.95'
      })
      .returning()
      .execute();

    const favoriteResult = await db.insert(userFavoritesTable)
      .values({
        user_id: 'user123',
        request_id: requestResult[0].id,
        variant_id: variantResult[0].id
      })
      .returning()
      .execute();

    const testInput: RemoveFavoriteInput = {
      user_id: 'user123',
      favorite_id: favoriteResult[0].id
    };

    // Execute handler
    const result = await removeFavorite(testInput);

    // Should return true for successful deletion
    expect(result).toBe(true);

    // Verify favorite was deleted from database
    const favorites = await db.select()
      .from(userFavoritesTable)
      .where(eq(userFavoritesTable.id, favoriteResult[0].id))
      .execute();

    expect(favorites).toHaveLength(0);
  });

  it('should return false when favorite does not exist', async () => {
    const testInput: RemoveFavoriteInput = {
      user_id: 'user123',
      favorite_id: 999 // Non-existent ID
    };

    // Execute handler
    const result = await removeFavorite(testInput);

    // Should return false when no favorite is found
    expect(result).toBe(false);
  });

  it('should return false when user tries to remove another users favorite', async () => {
    // Create test data for user1
    const requestResult = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'John',
        target_language: 'chinese',
        gender_preference: 'male',
        output_format: 'both',
        tone: 'formal',
        user_id: 'user1'
      })
      .returning()
      .execute();

    const variantResult = await db.insert(nameVariantsTable)
      .values({
        request_id: requestResult[0].id,
        variant_type: 'medium',
        native_script: '约翰',
        romanization: 'Yuē hàn',
        meaning: 'God is gracious',
        pronunciation: 'yue-han',
        cultural_notes: 'Common transliteration',
        confidence_score: '0.95'
      })
      .returning()
      .execute();

    const favoriteResult = await db.insert(userFavoritesTable)
      .values({
        user_id: 'user1',
        request_id: requestResult[0].id,
        variant_id: variantResult[0].id
      })
      .returning()
      .execute();

    // Try to remove as user2
    const testInput: RemoveFavoriteInput = {
      user_id: 'user2', // Different user
      favorite_id: favoriteResult[0].id
    };

    // Execute handler
    const result = await removeFavorite(testInput);

    // Should return false due to user ownership check
    expect(result).toBe(false);

    // Verify favorite still exists in database
    const favorites = await db.select()
      .from(userFavoritesTable)
      .where(eq(userFavoritesTable.id, favoriteResult[0].id))
      .execute();

    expect(favorites).toHaveLength(1);
    expect(favorites[0].user_id).toBe('user1');
  });

  it('should handle multiple favorites for same user correctly', async () => {
    // Create test data with multiple requests and variants
    const request1Result = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'John',
        target_language: 'chinese',
        gender_preference: 'male',
        output_format: 'both',
        tone: 'formal',
        user_id: 'user123'
      })
      .returning()
      .execute();

    const request2Result = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Mary',
        target_language: 'japanese',
        gender_preference: 'female',
        output_format: 'native',
        tone: 'casual',
        user_id: 'user123'
      })
      .returning()
      .execute();

    const variant1Result = await db.insert(nameVariantsTable)
      .values({
        request_id: request1Result[0].id,
        variant_type: 'medium',
        native_script: '约翰',
        romanization: 'Yuē hàn',
        meaning: 'God is gracious',
        pronunciation: 'yue-han',
        cultural_notes: 'Common transliteration',
        confidence_score: '0.95'
      })
      .returning()
      .execute();

    const variant2Result = await db.insert(nameVariantsTable)
      .values({
        request_id: request2Result[0].id,
        variant_type: 'short',
        native_script: 'まり',
        romanization: 'Mari',
        meaning: 'Beloved',
        pronunciation: 'ma-ri',
        cultural_notes: 'Popular Japanese name',
        confidence_score: '0.90'
      })
      .returning()
      .execute();

    // Create two favorites for the same user
    const favorite1Result = await db.insert(userFavoritesTable)
      .values({
        user_id: 'user123',
        request_id: request1Result[0].id,
        variant_id: variant1Result[0].id
      })
      .returning()
      .execute();

    const favorite2Result = await db.insert(userFavoritesTable)
      .values({
        user_id: 'user123',
        request_id: request2Result[0].id,
        variant_id: variant2Result[0].id
      })
      .returning()
      .execute();

    // Remove only the first favorite
    const testInput: RemoveFavoriteInput = {
      user_id: 'user123',
      favorite_id: favorite1Result[0].id
    };

    const result = await removeFavorite(testInput);

    // Should return true for successful deletion
    expect(result).toBe(true);

    // Verify only the first favorite was deleted
    const remainingFavorites = await db.select()
      .from(userFavoritesTable)
      .where(eq(userFavoritesTable.user_id, 'user123'))
      .execute();

    expect(remainingFavorites).toHaveLength(1);
    expect(remainingFavorites[0].id).toBe(favorite2Result[0].id);
  });

  it('should verify favorite ownership with correct user_id', async () => {
    // Create test data
    const requestResult = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Alice',
        target_language: 'chinese',
        gender_preference: 'female',
        output_format: 'romanization',
        tone: 'traditional',
        user_id: 'owner_user'
      })
      .returning()
      .execute();

    const variantResult = await db.insert(nameVariantsTable)
      .values({
        request_id: requestResult[0].id,
        variant_type: 'long',
        native_script: '爱丽丝',
        romanization: 'Ài lì sī',
        meaning: 'Noble kind',
        pronunciation: 'ai-li-si',
        cultural_notes: 'Western name adaptation',
        confidence_score: '0.85'
      })
      .returning()
      .execute();

    const favoriteResult = await db.insert(userFavoritesTable)
      .values({
        user_id: 'owner_user',
        request_id: requestResult[0].id,
        variant_id: variantResult[0].id
      })
      .returning()
      .execute();

    // Test successful removal with correct user
    const testInput: RemoveFavoriteInput = {
      user_id: 'owner_user',
      favorite_id: favoriteResult[0].id
    };

    const result = await removeFavorite(testInput);
    expect(result).toBe(true);

    // Verify favorite was actually deleted
    const checkFavorites = await db.select()
      .from(userFavoritesTable)
      .where(
        and(
          eq(userFavoritesTable.id, favoriteResult[0].id),
          eq(userFavoritesTable.user_id, 'owner_user')
        )
      )
      .execute();

    expect(checkFavorites).toHaveLength(0);
  });
});