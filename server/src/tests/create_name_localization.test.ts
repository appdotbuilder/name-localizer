import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { nameLocalizationRequestsTable, nameVariantsTable } from '../db/schema';
import { type CreateNameLocalizationInput } from '../schema';
import { createNameLocalization } from '../handlers/create_name_localization';
import { eq, and } from 'drizzle-orm';

// Test input for Chinese localization
const testChineseInput: CreateNameLocalizationInput = {
  original_name: 'John Smith',
  target_language: 'chinese',
  gender_preference: 'male',
  output_format: 'both',
  tone: 'formal',
  user_id: 'test-user-123'
};

// Test input for Japanese localization
const testJapaneseInput: CreateNameLocalizationInput = {
  original_name: 'Alice Johnson',
  target_language: 'japanese',
  gender_preference: 'female',
  output_format: 'native',
  tone: 'casual',
  user_id: 'test-user-456'
};

// Test input without user_id (guest user)
const testGuestInput: CreateNameLocalizationInput = {
  original_name: 'Bob Wilson',
  target_language: 'chinese',
  gender_preference: 'neutral',
  output_format: 'romanization',
  tone: 'modern'
};

describe('createNameLocalization', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a Chinese name localization with variants', async () => {
    const result = await createNameLocalization(testChineseInput);

    // Validate request fields
    expect(result.original_name).toEqual('John Smith');
    expect(result.target_language).toEqual('chinese');
    expect(result.gender_preference).toEqual('male');
    expect(result.output_format).toEqual('both');
    expect(result.tone).toEqual('formal');
    expect(result.user_id).toEqual('test-user-123');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Validate variants
    expect(result.variants).toHaveLength(3);
    expect(result.variants.map(v => v.variant_type)).toEqual(['short', 'medium', 'long']);
    
    // Check short variant
    const shortVariant = result.variants.find(v => v.variant_type === 'short');
    expect(shortVariant).toBeDefined();
    expect(shortVariant!.native_script).toEqual('李');
    expect(shortVariant!.romanization).toEqual('Li');
    expect(shortVariant!.meaning).toEqual('Plum');
    expect(shortVariant!.pronunciation).toEqual('Lee');
    expect(shortVariant!.cultural_notes).toContain('John Smith');
    expect(typeof shortVariant!.confidence_score).toBe('number');
    expect(shortVariant!.confidence_score).toEqual(0.9);
  });

  it('should create a Japanese name localization with variants', async () => {
    const result = await createNameLocalization(testJapaneseInput);

    // Validate request fields
    expect(result.original_name).toEqual('Alice Johnson');
    expect(result.target_language).toEqual('japanese');
    expect(result.gender_preference).toEqual('female');
    expect(result.output_format).toEqual('native');
    expect(result.tone).toEqual('casual');
    expect(result.user_id).toEqual('test-user-456');

    // Validate Japanese-specific variants
    expect(result.variants).toHaveLength(3);
    
    const shortVariant = result.variants.find(v => v.variant_type === 'short');
    expect(shortVariant!.native_script).toEqual('田中');
    expect(shortVariant!.romanization).toEqual('Tanaka');
    expect(shortVariant!.meaning).toEqual('Middle of rice field');
    expect(shortVariant!.cultural_notes).toContain('Alice Johnson');
    expect(typeof shortVariant!.confidence_score).toBe('number');
  });

  it('should handle guest users (null user_id)', async () => {
    const result = await createNameLocalization(testGuestInput);

    expect(result.user_id).toBeNull();
    expect(result.original_name).toEqual('Bob Wilson');
    expect(result.variants).toHaveLength(3);
  });

  it('should save request to database', async () => {
    const result = await createNameLocalization(testChineseInput);

    // Query the request from database
    const requests = await db.select()
      .from(nameLocalizationRequestsTable)
      .where(eq(nameLocalizationRequestsTable.id, result.id))
      .execute();

    expect(requests).toHaveLength(1);
    const savedRequest = requests[0];
    expect(savedRequest.original_name).toEqual('John Smith');
    expect(savedRequest.target_language).toEqual('chinese');
    expect(savedRequest.user_id).toEqual('test-user-123');
    expect(savedRequest.created_at).toBeInstanceOf(Date);
  });

  it('should save variants to database with correct foreign key relationship', async () => {
    const result = await createNameLocalization(testChineseInput);

    // Query the variants from database
    const variants = await db.select()
      .from(nameVariantsTable)
      .where(eq(nameVariantsTable.request_id, result.id))
      .execute();

    expect(variants).toHaveLength(3);
    
    // Check that all variants reference the correct request
    variants.forEach(variant => {
      expect(variant.request_id).toEqual(result.id);
      expect(variant.created_at).toBeInstanceOf(Date);
      expect(['short', 'medium', 'long']).toContain(variant.variant_type);
      // Verify numeric conversion worked correctly
      expect(typeof parseFloat(variant.confidence_score)).toBe('number');
    });

    // Verify specific variant data
    const shortVariant = variants.find(v => v.variant_type === 'short');
    expect(shortVariant).toBeDefined();
    expect(shortVariant!.native_script).toEqual('李');
    expect(parseFloat(shortVariant!.confidence_score)).toEqual(0.9);
  });

  it('should create different variants for different tones and preferences', async () => {
    const traditionalInput: CreateNameLocalizationInput = {
      ...testChineseInput,
      tone: 'traditional',
      gender_preference: 'female'
    };

    const result = await createNameLocalization(traditionalInput);

    // Check that cultural notes reflect the tone and gender preference
    const mediumVariant = result.variants.find(v => v.variant_type === 'medium');
    expect(mediumVariant!.cultural_notes).toContain('traditional');
    expect(mediumVariant!.cultural_notes).toContain('female');
  });

  it('should generate variants with decreasing confidence scores', async () => {
    const result = await createNameLocalization(testChineseInput);

    const shortVariant = result.variants.find(v => v.variant_type === 'short');
    const mediumVariant = result.variants.find(v => v.variant_type === 'medium');
    const longVariant = result.variants.find(v => v.variant_type === 'long');

    // Chinese variants should have decreasing confidence: 0.9, 0.85, 0.8
    expect(shortVariant!.confidence_score).toBeGreaterThan(mediumVariant!.confidence_score);
    expect(mediumVariant!.confidence_score).toBeGreaterThan(longVariant!.confidence_score);
  });

  it('should handle all variant types correctly', async () => {
    const result = await createNameLocalization(testJapaneseInput);

    const variantTypes = result.variants.map(v => v.variant_type).sort();
    expect(variantTypes).toEqual(['long', 'medium', 'short']);

    // Each variant should have all required fields
    result.variants.forEach(variant => {
      expect(variant.id).toBeDefined();
      expect(variant.request_id).toEqual(result.id);
      expect(variant.native_script).toBeTruthy();
      expect(variant.romanization).toBeTruthy();
      expect(variant.meaning).toBeTruthy();
      expect(variant.pronunciation).toBeTruthy();
      expect(variant.cultural_notes).toBeTruthy();
      expect(variant.confidence_score).toBeGreaterThan(0);
      expect(variant.confidence_score).toBeLessThanOrEqual(1);
      expect(variant.created_at).toBeInstanceOf(Date);
    });
  });

  it('should maintain referential integrity between request and variants', async () => {
    const result = await createNameLocalization(testChineseInput);

    // Query with join to verify relationship
    const joinedResults = await db.select()
      .from(nameLocalizationRequestsTable)
      .innerJoin(
        nameVariantsTable,
        eq(nameLocalizationRequestsTable.id, nameVariantsTable.request_id)
      )
      .where(eq(nameLocalizationRequestsTable.id, result.id))
      .execute();

    expect(joinedResults).toHaveLength(3); // One row per variant
    
    joinedResults.forEach(row => {
      expect(row.name_localization_requests.id).toEqual(result.id);
      expect(row.name_variants.request_id).toEqual(result.id);
      expect(row.name_localization_requests.original_name).toEqual('John Smith');
    });
  });
});