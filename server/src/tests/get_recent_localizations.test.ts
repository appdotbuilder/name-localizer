import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { nameLocalizationRequestsTable, nameVariantsTable } from '../db/schema';
import { getRecentLocalizations } from '../handlers/get_recent_localizations';

describe('getRecentLocalizations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no localizations exist', async () => {
    const result = await getRecentLocalizations();

    expect(result).toEqual([]);
  });

  it('should fetch recent localizations with variants', async () => {
    // Create test localization request
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

    // Create test variants
    await db.insert(nameVariantsTable)
      .values([
        {
          request_id: request.id,
          variant_type: 'short',
          native_script: '约翰',
          romanization: 'Yuē hàn',
          meaning: 'God is gracious',
          pronunciation: 'yoo-eh hahn',
          cultural_notes: 'Common Chinese transliteration',
          confidence_score: '0.95' // String for numeric column
        },
        {
          request_id: request.id,
          variant_type: 'medium',
          native_script: '约翰尼',
          romanization: 'Yuē hàn ní',
          meaning: 'Little John',
          pronunciation: 'yoo-eh hahn nee',
          cultural_notes: 'More casual variant',
          confidence_score: '0.87'
        }
      ])
      .execute();

    const result = await getRecentLocalizations();

    expect(result).toHaveLength(1);
    
    const localization = result[0];
    expect(localization.id).toEqual(request.id);
    expect(localization.original_name).toEqual('John');
    expect(localization.target_language).toEqual('chinese');
    expect(localization.gender_preference).toEqual('male');
    expect(localization.output_format).toEqual('both');
    expect(localization.tone).toEqual('formal');
    expect(localization.user_id).toBeNull(); // Should be anonymized
    expect(localization.created_at).toBeInstanceOf(Date);
    expect(localization.variants).toHaveLength(2);

    // Check first variant
    const variant1 = localization.variants[0];
    expect(variant1.variant_type).toEqual('short');
    expect(variant1.native_script).toEqual('约翰');
    expect(variant1.romanization).toEqual('Yuē hàn');
    expect(variant1.meaning).toEqual('God is gracious');
    expect(variant1.pronunciation).toEqual('yoo-eh hahn');
    expect(variant1.cultural_notes).toEqual('Common Chinese transliteration');
    expect(variant1.confidence_score).toEqual(0.95); // Should be converted to number
    expect(typeof variant1.confidence_score).toEqual('number');
    expect(variant1.created_at).toBeInstanceOf(Date);

    // Check second variant
    const variant2 = localization.variants[1];
    expect(variant2.variant_type).toEqual('medium');
    expect(variant2.confidence_score).toEqual(0.87);
    expect(typeof variant2.confidence_score).toEqual('number');
  });

  it('should respect the limit parameter', async () => {
    // Create multiple test requests
    const requests = [];
    for (let i = 0; i < 5; i++) {
      const requestResult = await db.insert(nameLocalizationRequestsTable)
        .values({
          original_name: `Test${i}`,
          target_language: 'japanese',
          gender_preference: 'female',
          output_format: 'native',
          tone: 'casual',
          user_id: `user-${i}`
        })
        .returning()
        .execute();
      
      requests.push(requestResult[0]);

      // Add a variant for each request
      await db.insert(nameVariantsTable)
        .values({
          request_id: requestResult[0].id,
          variant_type: 'short',
          native_script: `テスト${i}`,
          romanization: `tesuto${i}`,
          meaning: `Test ${i}`,
          pronunciation: `te-su-to-${i}`,
          cultural_notes: `Test variant ${i}`,
          confidence_score: '0.80'
        })
        .execute();
    }

    // Test with limit of 3
    const result = await getRecentLocalizations(3);

    expect(result).toHaveLength(3);
    result.forEach(localization => {
      expect(localization.variants).toHaveLength(1);
      expect(localization.user_id).toBeNull(); // Should be anonymized
    });
  });

  it('should sort results by creation date (most recent first)', async () => {
    // Create requests with slight delays to ensure different timestamps
    const request1Result = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'First',
        target_language: 'chinese',
        gender_preference: 'any',
        output_format: 'romanization',
        tone: 'modern',
        user_id: 'user1'
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const request2Result = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'Second',
        target_language: 'japanese',
        gender_preference: 'neutral',
        output_format: 'both',
        tone: 'traditional',
        user_id: 'user2'
      })
      .returning()
      .execute();

    // Add variants for both requests
    await db.insert(nameVariantsTable)
      .values([
        {
          request_id: request1Result[0].id,
          variant_type: 'short',
          native_script: '第一',
          romanization: 'dì yī',
          meaning: 'first',
          pronunciation: 'dee yee',
          cultural_notes: 'First test',
          confidence_score: '0.90'
        },
        {
          request_id: request2Result[0].id,
          variant_type: 'medium',
          native_script: '二番目',
          romanization: 'ni ban me',
          meaning: 'second',
          pronunciation: 'nee bahn meh',
          cultural_notes: 'Second test',
          confidence_score: '0.85'
        }
      ])
      .execute();

    const result = await getRecentLocalizations();

    expect(result).toHaveLength(2);
    
    // Most recent should be first (Second request)
    expect(result[0].original_name).toEqual('Second');
    expect(result[1].original_name).toEqual('First');
    
    // Verify timestamps are ordered correctly
    expect(result[0].created_at.getTime()).toBeGreaterThan(result[1].created_at.getTime());
  });

  it('should handle requests without variants', async () => {
    // Create request without any variants
    await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: 'NoVariants',
        target_language: 'chinese',
        gender_preference: 'male',
        output_format: 'native',
        tone: 'formal',
        user_id: 'lonely-user'
      })
      .execute();

    const result = await getRecentLocalizations();

    expect(result).toHaveLength(1);
    expect(result[0].original_name).toEqual('NoVariants');
    expect(result[0].variants).toHaveLength(0);
    expect(result[0].user_id).toBeNull(); // Should still be anonymized
  });

  it('should use default limit of 10 when no limit specified', async () => {
    // Create 15 test requests to verify default limit
    for (let i = 0; i < 15; i++) {
      await db.insert(nameLocalizationRequestsTable)
        .values({
          original_name: `Name${i}`,
          target_language: i % 2 === 0 ? 'chinese' : 'japanese',
          gender_preference: 'any',
          output_format: 'both',
          tone: 'casual',
          user_id: `user-${i}`
        })
        .execute();
    }

    // Call without limit parameter
    const result = await getRecentLocalizations();

    expect(result).toHaveLength(10); // Should use default limit of 10
    result.forEach(localization => {
      expect(localization.user_id).toBeNull(); // All should be anonymized
    });
  });
});