import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { nameLocalizationRequestsTable, nameVariantsTable, userFavoritesTable } from '../db/schema';
import { type AddToFavoritesInput } from '../schema';
import { addToFavorites } from '../handlers/add_to_favorites';
import { eq, and } from 'drizzle-orm';

describe('addToFavorites', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create a name localization request
    const requestResult = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'John',
        target_language: 'chinese',
        gender_preference: 'male',
        output_format: 'both',
        tone: 'formal',
        user_id: 'test-user-123'
      })
      .returning()
      .execute();

    const request = requestResult[0];

    // Create a name variant
    const variantResult = await db.insert(nameVariantsTable)
      .values({
        request_id: request.id,
        variant_type: 'medium',
        native_script: '约翰',
        romanization: 'Yuēhàn',
        meaning: 'God is gracious',
        pronunciation: 'yue-han',
        cultural_notes: 'Common transliteration for John',
        confidence_score: '0.85'
      })
      .returning()
      .execute();

    const variant = variantResult[0];

    return { request, variant };
  };

  it('should add a favorite successfully', async () => {
    const { request, variant } = await createTestData();

    const input: AddToFavoritesInput = {
      user_id: 'favorite-user-456',
      request_id: request.id,
      variant_id: variant.id
    };

    const result = await addToFavorites(input);

    expect(result.user_id).toEqual('favorite-user-456');
    expect(result.request_id).toEqual(request.id);
    expect(result.variant_id).toEqual(variant.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save favorite to database', async () => {
    const { request, variant } = await createTestData();

    const input: AddToFavoritesInput = {
      user_id: 'favorite-user-789',
      request_id: request.id,
      variant_id: variant.id
    };

    const result = await addToFavorites(input);

    // Verify the favorite was saved to the database
    const favorites = await db.select()
      .from(userFavoritesTable)
      .where(eq(userFavoritesTable.id, result.id))
      .execute();

    expect(favorites).toHaveLength(1);
    expect(favorites[0].user_id).toEqual('favorite-user-789');
    expect(favorites[0].request_id).toEqual(request.id);
    expect(favorites[0].variant_id).toEqual(variant.id);
    expect(favorites[0].created_at).toBeInstanceOf(Date);
  });

  it('should reject duplicate favorites', async () => {
    const { request, variant } = await createTestData();

    const input: AddToFavoritesInput = {
      user_id: 'duplicate-user',
      request_id: request.id,
      variant_id: variant.id
    };

    // First addition should succeed
    await addToFavorites(input);

    // Second addition should fail
    await expect(addToFavorites(input))
      .rejects
      .toThrow(/already in user favorites/i);
  });

  it('should reject non-existent request', async () => {
    const { variant } = await createTestData();

    const input: AddToFavoritesInput = {
      user_id: 'test-user',
      request_id: 99999, // Non-existent request ID
      variant_id: variant.id
    };

    await expect(addToFavorites(input))
      .rejects
      .toThrow(/request not found/i);
  });

  it('should reject non-existent variant', async () => {
    const { request } = await createTestData();

    const input: AddToFavoritesInput = {
      user_id: 'test-user',
      request_id: request.id,
      variant_id: 99999 // Non-existent variant ID
    };

    await expect(addToFavorites(input))
      .rejects
      .toThrow(/variant not found/i);
  });

  it('should reject variant that does not belong to the request', async () => {
    const { request: request1 } = await createTestData();
    const { variant: variant2 } = await createTestData(); // Different request

    const input: AddToFavoritesInput = {
      user_id: 'test-user',
      request_id: request1.id,
      variant_id: variant2.id // Variant belongs to different request
    };

    await expect(addToFavorites(input))
      .rejects
      .toThrow(/does not belong to the specified request/i);
  });

  it('should allow different users to favorite the same variant', async () => {
    const { request, variant } = await createTestData();

    const input1: AddToFavoritesInput = {
      user_id: 'user-1',
      request_id: request.id,
      variant_id: variant.id
    };

    const input2: AddToFavoritesInput = {
      user_id: 'user-2',
      request_id: request.id,
      variant_id: variant.id
    };

    // Both users should be able to favorite the same variant
    const result1 = await addToFavorites(input1);
    const result2 = await addToFavorites(input2);

    expect(result1.user_id).toEqual('user-1');
    expect(result2.user_id).toEqual('user-2');
    expect(result1.variant_id).toEqual(variant.id);
    expect(result2.variant_id).toEqual(variant.id);

    // Verify both favorites exist in database
    const allFavorites = await db.select()
      .from(userFavoritesTable)
      .where(eq(userFavoritesTable.variant_id, variant.id))
      .execute();

    expect(allFavorites).toHaveLength(2);
  });

  it('should handle foreign key constraints correctly', async () => {
    const { request, variant } = await createTestData();

    // Create a favorite
    const input: AddToFavoritesInput = {
      user_id: 'cascade-test-user',
      request_id: request.id,
      variant_id: variant.id
    };

    const favorite = await addToFavorites(input);

    // Verify favorite exists
    const favoriteExists = await db.select()
      .from(userFavoritesTable)
      .where(eq(userFavoritesTable.id, favorite.id))
      .execute();

    expect(favoriteExists).toHaveLength(1);

    // Delete the variant (should cascade delete the favorite)
    await db.delete(nameVariantsTable)
      .where(eq(nameVariantsTable.id, variant.id))
      .execute();

    // Verify favorite was deleted due to cascade
    const favoriteAfterDelete = await db.select()
      .from(userFavoritesTable)
      .where(eq(userFavoritesTable.id, favorite.id))
      .execute();

    expect(favoriteAfterDelete).toHaveLength(0);
  });
});