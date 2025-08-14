import { db } from '../db';
import { nameLocalizationRequestsTable, nameVariantsTable } from '../db/schema';
import { type CreateNameLocalizationInput, type NameLocalizationResponse, type NameVariant } from '../schema';

// Mock AI service function to generate name variants
const generateNameVariants = (request: CreateNameLocalizationInput): Array<{
  variant_type: 'short' | 'medium' | 'long';
  native_script: string;
  romanization: string;
  meaning: string;
  pronunciation: string;
  cultural_notes: string;
  confidence_score: number;
}> => {
  const { original_name, target_language, gender_preference, tone } = request;
  
  // Simple mock implementation - in reality this would call an AI service
  if (target_language === 'chinese') {
    return [
      {
        variant_type: 'short',
        native_script: '李',
        romanization: 'Li',
        meaning: 'Plum',
        pronunciation: 'Lee',
        cultural_notes: `A common Chinese surname derived from "${original_name}"`,
        confidence_score: 0.9
      },
      {
        variant_type: 'medium',
        native_script: '李明',
        romanization: 'Li Ming',
        meaning: 'Bright Plum',
        pronunciation: 'Lee Ming',
        cultural_notes: `Traditional Chinese name with ${tone} tone, suitable for ${gender_preference} preference`,
        confidence_score: 0.85
      },
      {
        variant_type: 'long',
        native_script: '李明华',
        romanization: 'Li Ming Hua',
        meaning: 'Bright and Magnificent Plum',
        pronunciation: 'Lee Ming Hwa',
        cultural_notes: `Formal Chinese name with poetic meaning in ${tone} style`,
        confidence_score: 0.8
      }
    ];
  } else {
    // Japanese variants
    return [
      {
        variant_type: 'short',
        native_script: '田中',
        romanization: 'Tanaka',
        meaning: 'Middle of rice field',
        pronunciation: 'Ta-na-ka',
        cultural_notes: `Common Japanese surname derived from "${original_name}"`,
        confidence_score: 0.88
      },
      {
        variant_type: 'medium',
        native_script: '田中太郎',
        romanization: 'Tanaka Taro',
        meaning: 'First son from the rice field',
        pronunciation: 'Ta-na-ka Ta-ro',
        cultural_notes: `Traditional Japanese name with ${tone} tone, suitable for ${gender_preference} preference`,
        confidence_score: 0.82
      },
      {
        variant_type: 'long',
        native_script: '田中太郎丸',
        romanization: 'Tanaka Taromaru',
        meaning: 'Beloved first son from the rice field',
        pronunciation: 'Ta-na-ka Ta-ro-ma-ru',
        cultural_notes: `Formal Japanese name with traditional suffix in ${tone} style`,
        confidence_score: 0.75
      }
    ];
  }
};

export const createNameLocalization = async (input: CreateNameLocalizationInput): Promise<NameLocalizationResponse> => {
  try {
    // 1. Create the name localization request in the database
    const requestResult = await db.insert(nameLocalizationRequestsTable)
      .values({
        original_name: input.original_name,
        target_language: input.target_language,
        gender_preference: input.gender_preference,
        output_format: input.output_format,
        tone: input.tone,
        user_id: input.user_id || null
      })
      .returning()
      .execute();

    const request = requestResult[0];

    // 2. Generate name variants using mock AI service
    const generatedVariants = generateNameVariants(input);

    // 3. Store the generated variants in the database
    const variantResults = await db.insert(nameVariantsTable)
      .values(
        generatedVariants.map(variant => ({
          request_id: request.id,
          variant_type: variant.variant_type,
          native_script: variant.native_script,
          romanization: variant.romanization,
          meaning: variant.meaning,
          pronunciation: variant.pronunciation,
          cultural_notes: variant.cultural_notes,
          confidence_score: variant.confidence_score.toString() // Convert number to string for numeric column
        }))
      )
      .returning()
      .execute();

    // 4. Convert numeric fields back to numbers and prepare response
    const variants: NameVariant[] = variantResults.map(variant => ({
      ...variant,
      confidence_score: parseFloat(variant.confidence_score) // Convert string back to number
    }));

    // 5. Return the complete response
    return {
      ...request,
      variants
    };

  } catch (error) {
    console.error('Name localization creation failed:', error);
    throw error;
  }
};