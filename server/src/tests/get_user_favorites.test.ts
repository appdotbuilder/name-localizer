import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { nameLocalizationRequestsTable, nameVariantsTable, userFavoritesTable } from '../db/schema';
import { type GetUserFavoritesInput } from '../schema';
import { getUserFavorites } from '../handlers/get_user_favorites';

// Test input
const testInput: GetUserFavoritesInput = {
  user_id: 'test-user-123'
};

describe('getUserFavorites', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no favorites', async () => {
    const result = await getUserFavorites(testInput);

    expect(result).toEqual([]);
  });

  it('should return user favorites with complete localization data', async () => {
    // Create a name localization request
    const [request] = await db.insert(nameLocalizationRequestsTable)
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

    // Create variants for the request
    const [variant1, variant2] = await db.insert(nameVariantsTable)
      .values([
        {
          request_id: request.id,
          variant_type: 'short',
          native_script: '约翰',
          romanization: 'Yuēhàn',
          meaning: 'God is gracious',
          pronunciation: 'yue-han',
          cultural_notes: 'Common Western name adaptation',
          confidence_score: '0.95'
        },
        {
          request_id: request.id,
          variant_type: 'medium',
          native_script: '约翰尼',
          romanization: 'Yuēhàn ní',
          meaning: 'Little John',
          pronunciation: 'yue-han-ni',
          cultural_notes: 'Diminutive form',
          confidence_score: '0.87'
        }
      ])
      .returning()
      .execute();

    // Add to user favorites
    await db.insert(userFavoritesTable)
      .values({
        user_id: 'test-user-123',
        request_id: request.id,
        variant_id: variant1.id
      })
      .execute();

    const result = await getUserFavorites(testInput);

    // Should return one localization response
    expect(result).toHaveLength(1);
    
    const response = result[0];
    expect(response.id).toEqual(request.id);
    expect(response.original_name).toEqual('John');
    expect(response.target_language).toEqual('chinese');
    expect(response.gender_preference).toEqual('male');
    expect(response.output_format).toEqual('both');
    expect(response.tone).toEqual('formal');
    expect(response.user_id).toEqual('test-user-123');
    expect(response.created_at).toBeInstanceOf(Date);

    // Should include all variants for the request
    expect(response.variants).toHaveLength(2);
    
    const firstVariant = response.variants[0];
    expect(firstVariant.variant_type).toEqual('short');
    expect(firstVariant.native_script).toEqual('约翰');
    expect(firstVariant.romanization).toEqual('Yuēhàn');
    expect(firstVariant.meaning).toEqual('God is gracious');
    expect(firstVariant.confidence_score).toEqual(0.95); // Should be converted to number
    expect(typeof firstVariant.confidence_score).toEqual('number');

    const secondVariant = response.variants[1];
    expect(secondVariant.variant_type).toEqual('medium');
    expect(secondVariant.confidence_score).toEqual(0.87); // Should be converted to number
  });

  it('should return multiple favorites sorted by creation date (most recent first)', async () => {
    // Create first request and favorite (older)
    const [request1] = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Alice',
        target_language: 'japanese',
        gender_preference: 'female',
        output_format: 'native',
        tone: 'casual',
        user_id: 'test-user-123'
      })
      .returning()
      .execute();

    const [variant1] = await db.insert(nameVariantsTable)
      .values({
        request_id: request1.id,
        variant_type: 'short',
        native_script: 'アリス',
        romanization: 'Arisu',
        meaning: 'Noble',
        pronunciation: 'a-ri-su',
        cultural_notes: 'Western name adaptation',
        confidence_score: '0.92'
      })
      .returning()
      .execute();

    await db.insert(userFavoritesTable)
      .values({
        user_id: 'test-user-123',
        request_id: request1.id,
        variant_id: variant1.id
      })
      .execute();

    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create second request and favorite (newer)
    const [request2] = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Bob',
        target_language: 'chinese',
        gender_preference: 'male',
        output_format: 'romanization',
        tone: 'modern',
        user_id: 'test-user-123'
      })
      .returning()
      .execute();

    const [variant2] = await db.insert(nameVariantsTable)
      .values({
        request_id: request2.id,
        variant_type: 'medium',
        native_script: '鲍勃',
        romanization: 'Bàobó',
        meaning: 'Famous',
        pronunciation: 'bao-bo',
        cultural_notes: 'Modern adaptation',
        confidence_score: '0.88'
      })
      .returning()
      .execute();

    await db.insert(userFavoritesTable)
      .values({
        user_id: 'test-user-123',
        request_id: request2.id,
        variant_id: variant2.id
      })
      .execute();

    const result = await getUserFavorites(testInput);

    expect(result).toHaveLength(2);
    
    // Should be sorted by favorite creation date (most recent first)
    expect(result[0].original_name).toEqual('Bob'); // More recent favorite
    expect(result[1].original_name).toEqual('Alice'); // Older favorite
  });

  it('should only return favorites for the specified user', async () => {
    // Create request for test user
    const [request1] = await db.insert(nameLocalizationRequestsTable)
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

    const [variant1] = await db.insert(nameVariantsTable)
      .values({
        request_id: request1.id,
        variant_type: 'short',
        native_script: '约翰',
        romanization: 'Yuēhàn',
        meaning: 'God is gracious',
        pronunciation: 'yue-han',
        cultural_notes: 'Common adaptation',
        confidence_score: '0.95'
      })
      .returning()
      .execute();

    // Create request for different user
    const [request2] = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Jane',
        target_language: 'japanese',
        gender_preference: 'female',
        output_format: 'native',
        tone: 'casual',
        user_id: 'other-user-456'
      })
      .returning()
      .execute();

    const [variant2] = await db.insert(nameVariantsTable)
      .values({
        request_id: request2.id,
        variant_type: 'short',
        native_script: 'ジェーン',
        romanization: 'Jēn',
        meaning: 'God is gracious',
        pronunciation: 'je-n',
        cultural_notes: 'Western adaptation',
        confidence_score: '0.90'
      })
      .returning()
      .execute();

    // Add favorites for both users
    await db.insert(userFavoritesTable)
      .values([
        {
          user_id: 'test-user-123',
          request_id: request1.id,
          variant_id: variant1.id
        },
        {
          user_id: 'other-user-456',
          request_id: request2.id,
          variant_id: variant2.id
        }
      ])
      .execute();

    const result = await getUserFavorites(testInput);

    // Should only return favorites for the specified user
    expect(result).toHaveLength(1);
    expect(result[0].original_name).toEqual('John');
    expect(result[0].user_id).toEqual('test-user-123');
  });

  it('should handle requests with null user_id', async () => {
    // Create request with null user_id (guest user)
    const [request] = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Guest',
        target_language: 'chinese',
        gender_preference: 'neutral',
        output_format: 'both',
        tone: 'formal',
        user_id: null
      })
      .returning()
      .execute();

    const [variant] = await db.insert(nameVariantsTable)
      .values({
        request_id: request.id,
        variant_type: 'short',
        native_script: '客人',
        romanization: 'Kèrén',
        meaning: 'Guest',
        pronunciation: 'ke-ren',
        cultural_notes: 'Generic term',
        confidence_score: '0.85'
      })
      .returning()
      .execute();

    await db.insert(userFavoritesTable)
      .values({
        user_id: 'test-user-123',
        request_id: request.id,
        variant_id: variant.id
      })
      .execute();

    const result = await getUserFavorites(testInput);

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBeNull();
    expect(result[0].original_name).toEqual('Guest');
  });

  it('should include all variants for favorited requests', async () => {
    // Create request with multiple variants
    const [request] = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Michael',
        target_language: 'chinese',
        gender_preference: 'male',
        output_format: 'both',
        tone: 'formal',
        user_id: 'test-user-123'
      })
      .returning()
      .execute();

    // Create three variants
    const variants = await db.insert(nameVariantsTable)
      .values([
        {
          request_id: request.id,
          variant_type: 'short',
          native_script: '迈克',
          romanization: 'Màikè',
          meaning: 'Who is like God',
          pronunciation: 'mai-ke',
          cultural_notes: 'Short form',
          confidence_score: '0.95'
        },
        {
          request_id: request.id,
          variant_type: 'medium',
          native_script: '迈克尔',
          romanization: 'Màikè\'ěr',
          meaning: 'Who is like God',
          pronunciation: 'mai-ke-er',
          cultural_notes: 'Full form',
          confidence_score: '0.92'
        },
        {
          request_id: request.id,
          variant_type: 'long',
          native_script: '迈克尔·约翰逊',
          romanization: 'Màikè\'ěr Yuēhànxùn',
          meaning: 'Michael Johnson',
          pronunciation: 'mai-ke-er yue-han-xun',
          cultural_notes: 'With surname',
          confidence_score: '0.88'
        }
      ])
      .returning()
      .execute();

    // Favorite only one variant, but should get all variants in response
    await db.insert(userFavoritesTable)
      .values({
        user_id: 'test-user-123',
        request_id: request.id,
        variant_id: variants[0].id
      })
      .execute();

    const result = await getUserFavorites(testInput);

    expect(result).toHaveLength(1);
    expect(result[0].variants).toHaveLength(3);
    
    // Verify all variant types are included
    const variantTypes = result[0].variants.map(v => v.variant_type);
    expect(variantTypes).toContain('short');
    expect(variantTypes).toContain('medium');
    expect(variantTypes).toContain('long');
  });
});