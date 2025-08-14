import { db } from '../db';
import { nameLocalizationRequestsTable, nameVariantsTable } from '../db/schema';
import { type GetLocalizationByIdInput, type NameLocalizationResponse } from '../schema';
import { eq } from 'drizzle-orm';

export async function getLocalizationById(input: GetLocalizationByIdInput): Promise<NameLocalizationResponse | null> {
  try {
    // First, fetch the localization request
    const requests = await db.select()
      .from(nameLocalizationRequestsTable)
      .where(eq(nameLocalizationRequestsTable.id, input.id))
      .execute();

    if (requests.length === 0) {
      return null;
    }

    const request = requests[0];

    // Fetch all associated variants
    const variants = await db.select()
      .from(nameVariantsTable)
      .where(eq(nameVariantsTable.request_id, request.id))
      .execute();

    // Convert numeric fields back to numbers and build response
    return {
      id: request.id,
      original_name: request.original_name,
      target_language: request.target_language,
      gender_preference: request.gender_preference,
      output_format: request.output_format,
      tone: request.tone,
      user_id: request.user_id,
      created_at: request.created_at,
      variants: variants.map(variant => ({
        id: variant.id,
        request_id: variant.request_id,
        variant_type: variant.variant_type,
        native_script: variant.native_script,
        romanization: variant.romanization,
        meaning: variant.meaning,
        pronunciation: variant.pronunciation,
        cultural_notes: variant.cultural_notes,
        confidence_score: parseFloat(variant.confidence_score), // Convert numeric to number
        created_at: variant.created_at
      }))
    };
  } catch (error) {
    console.error('Failed to fetch localization by ID:', error);
    throw error;
  }
}