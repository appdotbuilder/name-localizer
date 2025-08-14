import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { nameLocalizationRequestsTable, nameVariantsTable } from '../db/schema';
import { type GetLocalizationByIdInput } from '../schema';
import { getLocalizationById } from '../handlers/get_localization_by_id';
import { eq } from 'drizzle-orm';

describe('getLocalizationById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return localization with variants when found', async () => {
    // Create a test localization request
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

    const requestId = requestResult[0].id;

    // Create test variants
    await db.insert(nameVariantsTable)
      .values([
        {
          request_id: requestId,
          variant_type: 'short',
          native_script: '约翰',
          romanization: 'Yuēhàn',
          meaning: 'God is gracious',
          pronunciation: 'yue1-han4',
          cultural_notes: 'Common Western name adaptation',
          confidence_score: '0.95'
        },
        {
          request_id: requestId,
          variant_type: 'medium',
          native_script: '约翰逊',
          romanization: 'Yuēhànxùn',
          meaning: 'Son of John',
          pronunciation: 'yue1-han4-xun4',
          cultural_notes: 'Formal adaptation with surname suffix',
          confidence_score: '0.87'
        }
      ])
      .execute();

    // Test the handler
    const input: GetLocalizationByIdInput = { id: requestId };
    const result = await getLocalizationById(input);

    // Verify the result structure
    expect(result).toBeDefined();
    expect(result!.id).toEqual(requestId);
    expect(result!.original_name).toEqual('John');
    expect(result!.target_language).toEqual('chinese');
    expect(result!.gender_preference).toEqual('male');
    expect(result!.output_format).toEqual('both');
    expect(result!.tone).toEqual('formal');
    expect(result!.user_id).toEqual('user123');
    expect(result!.created_at).toBeInstanceOf(Date);

    // Verify variants
    expect(result!.variants).toHaveLength(2);
    
    const shortVariant = result!.variants.find(v => v.variant_type === 'short')!;
    expect(shortVariant.native_script).toEqual('约翰');
    expect(shortVariant.romanization).toEqual('Yuēhàn');
    expect(shortVariant.meaning).toEqual('God is gracious');
    expect(shortVariant.pronunciation).toEqual('yue1-han4');
    expect(shortVariant.cultural_notes).toEqual('Common Western name adaptation');
    expect(shortVariant.confidence_score).toEqual(0.95);
    expect(typeof shortVariant.confidence_score).toEqual('number');
    expect(shortVariant.created_at).toBeInstanceOf(Date);

    const mediumVariant = result!.variants.find(v => v.variant_type === 'medium')!;
    expect(mediumVariant.native_script).toEqual('约翰逊');
    expect(mediumVariant.confidence_score).toEqual(0.87);
    expect(typeof mediumVariant.confidence_score).toEqual('number');
  });

  it('should return localization without variants when no variants exist', async () => {
    // Create a test localization request without variants
    const requestResult = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Sarah',
        target_language: 'japanese',
        gender_preference: 'female',
        output_format: 'native',
        tone: 'casual',
        user_id: null // Guest user
      })
      .returning()
      .execute();

    const requestId = requestResult[0].id;

    // Test the handler
    const input: GetLocalizationByIdInput = { id: requestId };
    const result = await getLocalizationById(input);

    // Verify the result
    expect(result).toBeDefined();
    expect(result!.id).toEqual(requestId);
    expect(result!.original_name).toEqual('Sarah');
    expect(result!.target_language).toEqual('japanese');
    expect(result!.gender_preference).toEqual('female');
    expect(result!.output_format).toEqual('native');
    expect(result!.tone).toEqual('casual');
    expect(result!.user_id).toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.variants).toHaveLength(0);
  });

  it('should return null when localization not found', async () => {
    const input: GetLocalizationByIdInput = { id: 9999 };
    const result = await getLocalizationById(input);

    expect(result).toBeNull();
  });

  it('should handle numeric confidence scores correctly', async () => {
    // Create a test localization request
    const requestResult = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Alice',
        target_language: 'chinese',
        gender_preference: 'female',
        output_format: 'romanization',
        tone: 'modern',
        user_id: 'user456'
      })
      .returning()
      .execute();

    const requestId = requestResult[0].id;

    // Create variant with various confidence scores
    await db.insert(nameVariantsTable)
      .values([
        {
          request_id: requestId,
          variant_type: 'long',
          native_script: '艾丽斯',
          romanization: 'Àilìsī',
          meaning: 'Noble',
          pronunciation: 'ai4-li4-si1',
          cultural_notes: 'Popular modern adaptation',
          confidence_score: '0.12' // Test low confidence score
        }
      ])
      .execute();

    const input: GetLocalizationByIdInput = { id: requestId };
    const result = await getLocalizationById(input);

    expect(result).toBeDefined();
    expect(result!.variants).toHaveLength(1);
    expect(result!.variants[0].confidence_score).toEqual(0.12);
    expect(typeof result!.variants[0].confidence_score).toEqual('number');
  });

  it('should verify data is correctly saved to database', async () => {
    // Create a test localization request
    const requestResult = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Michael',
        target_language: 'japanese',
        gender_preference: 'male',
        output_format: 'both',
        tone: 'traditional',
        user_id: 'user789'
      })
      .returning()
      .execute();

    const requestId = requestResult[0].id;

    // Create a variant
    await db.insert(nameVariantsTable)
      .values({
        request_id: requestId,
        variant_type: 'medium',
        native_script: 'マイケル',
        romanization: 'Maikeru',
        meaning: 'Who is like God',
        pronunciation: 'mai-ke-ru',
        cultural_notes: 'Standard katakana adaptation',
        confidence_score: '0.91'
      })
      .execute();

    // Query database directly to verify data integrity
    const dbRequest = await db.select()
      .from(nameLocalizationRequestsTable)
      .where(eq(nameLocalizationRequestsTable.id, requestId))
      .execute();

    const dbVariants = await db.select()
      .from(nameVariantsTable)
      .where(eq(nameVariantsTable.request_id, requestId))
      .execute();

    // Verify database state
    expect(dbRequest).toHaveLength(1);
    expect(dbRequest[0].original_name).toEqual('Michael');
    expect(dbRequest[0].target_language).toEqual('japanese');
    
    expect(dbVariants).toHaveLength(1);
    expect(dbVariants[0].native_script).toEqual('マイケル');
    expect(dbVariants[0].confidence_score).toEqual('0.91'); // Still string in DB

    // Now test the handler returns correct format
    const input: GetLocalizationByIdInput = { id: requestId };
    const result = await getLocalizationById(input);

    expect(result!.variants[0].confidence_score).toEqual(0.91); // Number in result
    expect(typeof result!.variants[0].confidence_score).toEqual('number');
  });
});