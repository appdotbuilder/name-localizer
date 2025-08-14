import { z } from 'zod';

// Enums
export const targetLanguageSchema = z.enum(['chinese', 'japanese']);
export type TargetLanguage = z.infer<typeof targetLanguageSchema>;

export const genderPreferenceSchema = z.enum(['male', 'female', 'neutral', 'any']);
export type GenderPreference = z.infer<typeof genderPreferenceSchema>;

export const outputFormatSchema = z.enum(['native', 'romanization', 'both']);
export type OutputFormat = z.infer<typeof outputFormatSchema>;

export const toneSchema = z.enum(['formal', 'casual', 'traditional', 'modern']);
export type Tone = z.infer<typeof toneSchema>;

export const variantTypeSchema = z.enum(['short', 'medium', 'long']);
export type VariantType = z.infer<typeof variantTypeSchema>;

// Name localization request schema
export const nameLocalizationRequestSchema = z.object({
  original_name: z.string().min(1).max(100),
  target_language: targetLanguageSchema,
  gender_preference: genderPreferenceSchema,
  output_format: outputFormatSchema,
  tone: toneSchema,
  user_id: z.string().optional() // For associating with user sessions
});

export type NameLocalizationRequest = z.infer<typeof nameLocalizationRequestSchema>;

// Name variant schema
export const nameVariantSchema = z.object({
  id: z.number(),
  request_id: z.number(),
  variant_type: variantTypeSchema,
  native_script: z.string(),
  romanization: z.string(),
  meaning: z.string(),
  pronunciation: z.string(),
  cultural_notes: z.string(),
  confidence_score: z.number().min(0).max(1), // 0-1 confidence score
  created_at: z.coerce.date()
});

export type NameVariant = z.infer<typeof nameVariantSchema>;

// User favorite schema
export const userFavoriteSchema = z.object({
  id: z.number(),
  user_id: z.string(),
  request_id: z.number(),
  variant_id: z.number(),
  created_at: z.coerce.date()
});

export type UserFavorite = z.infer<typeof userFavoriteSchema>;

// Name localization response schema (with variants)
export const nameLocalizationResponseSchema = z.object({
  id: z.number(),
  original_name: z.string(),
  target_language: targetLanguageSchema,
  gender_preference: genderPreferenceSchema,
  output_format: outputFormatSchema,
  tone: toneSchema,
  user_id: z.string().nullable(),
  created_at: z.coerce.date(),
  variants: z.array(nameVariantSchema)
});

export type NameLocalizationResponse = z.infer<typeof nameLocalizationResponseSchema>;

// Input schemas for handlers
export const createNameLocalizationInputSchema = nameLocalizationRequestSchema;
export type CreateNameLocalizationInput = z.infer<typeof createNameLocalizationInputSchema>;

export const addToFavoritesInputSchema = z.object({
  user_id: z.string(),
  request_id: z.number(),
  variant_id: z.number()
});

export type AddToFavoritesInput = z.infer<typeof addToFavoritesInputSchema>;

export const removeFavoriteInputSchema = z.object({
  user_id: z.string(),
  favorite_id: z.number()
});

export type RemoveFavoriteInput = z.infer<typeof removeFavoriteInputSchema>;

export const getUserFavoritesInputSchema = z.object({
  user_id: z.string()
});

export type GetUserFavoritesInput = z.infer<typeof getUserFavoritesInputSchema>;

export const getLocalizationByIdInputSchema = z.object({
  id: z.number()
});

export type GetLocalizationByIdInput = z.infer<typeof getLocalizationByIdInputSchema>;

// Rate limiting schema
export const rateLimitSchema = z.object({
  id: z.number(),
  ip_address: z.string(),
  user_id: z.string().nullable(),
  request_count: z.number().int(),
  window_start: z.coerce.date(),
  created_at: z.coerce.date()
});

export type RateLimit = z.infer<typeof rateLimitSchema>;

export const checkRateLimitInputSchema = z.object({
  ip_address: z.string(),
  user_id: z.string().optional()
});

export type CheckRateLimitInput = z.infer<typeof checkRateLimitInputSchema>;