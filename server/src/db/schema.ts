import { serial, text, pgTable, timestamp, numeric, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const targetLanguageEnum = pgEnum('target_language', ['chinese', 'japanese']);
export const genderPreferenceEnum = pgEnum('gender_preference', ['male', 'female', 'neutral', 'any']);
export const outputFormatEnum = pgEnum('output_format', ['native', 'romanization', 'both']);
export const toneEnum = pgEnum('tone', ['formal', 'casual', 'traditional', 'modern']);
export const variantTypeEnum = pgEnum('variant_type', ['short', 'medium', 'long']);

// Name localization requests table
export const nameLocalizationRequestsTable = pgTable('name_localization_requests', {
  id: serial('id').primaryKey(),
  original_name: text('original_name').notNull(),
  target_language: targetLanguageEnum('target_language').notNull(),
  gender_preference: genderPreferenceEnum('gender_preference').notNull(),
  output_format: outputFormatEnum('output_format').notNull(),
  tone: toneEnum('tone').notNull(),
  user_id: text('user_id'), // Nullable - for guest users
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Name variants table
export const nameVariantsTable = pgTable('name_variants', {
  id: serial('id').primaryKey(),
  request_id: integer('request_id').notNull().references(() => nameLocalizationRequestsTable.id, { onDelete: 'cascade' }),
  variant_type: variantTypeEnum('variant_type').notNull(),
  native_script: text('native_script').notNull(),
  romanization: text('romanization').notNull(),
  meaning: text('meaning').notNull(),
  pronunciation: text('pronunciation').notNull(),
  cultural_notes: text('cultural_notes').notNull(),
  confidence_score: numeric('confidence_score', { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
  created_at: timestamp('created_at').defaultNow().notNull()
});

// User favorites table
export const userFavoritesTable = pgTable('user_favorites', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  request_id: integer('request_id').notNull().references(() => nameLocalizationRequestsTable.id, { onDelete: 'cascade' }),
  variant_id: integer('variant_id').notNull().references(() => nameVariantsTable.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Rate limiting table
export const rateLimitsTable = pgTable('rate_limits', {
  id: serial('id').primaryKey(),
  ip_address: text('ip_address').notNull(),
  user_id: text('user_id'), // Nullable - for guest users
  request_count: integer('request_count').notNull().default(0),
  window_start: timestamp('window_start').notNull().defaultNow(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const nameLocalizationRequestsRelations = relations(nameLocalizationRequestsTable, ({ many }) => ({
  variants: many(nameVariantsTable),
  favorites: many(userFavoritesTable)
}));

export const nameVariantsRelations = relations(nameVariantsTable, ({ one, many }) => ({
  request: one(nameLocalizationRequestsTable, {
    fields: [nameVariantsTable.request_id],
    references: [nameLocalizationRequestsTable.id]
  }),
  favorites: many(userFavoritesTable)
}));

export const userFavoritesRelations = relations(userFavoritesTable, ({ one }) => ({
  request: one(nameLocalizationRequestsTable, {
    fields: [userFavoritesTable.request_id],
    references: [nameLocalizationRequestsTable.id]
  }),
  variant: one(nameVariantsTable, {
    fields: [userFavoritesTable.variant_id],
    references: [nameVariantsTable.id]
  })
}));

// TypeScript types for the table schemas
export type NameLocalizationRequest = typeof nameLocalizationRequestsTable.$inferSelect;
export type NewNameLocalizationRequest = typeof nameLocalizationRequestsTable.$inferInsert;

export type NameVariant = typeof nameVariantsTable.$inferSelect;
export type NewNameVariant = typeof nameVariantsTable.$inferInsert;

export type UserFavorite = typeof userFavoritesTable.$inferSelect;
export type NewUserFavorite = typeof userFavoritesTable.$inferInsert;

export type RateLimit = typeof rateLimitsTable.$inferSelect;
export type NewRateLimit = typeof rateLimitsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  nameLocalizationRequests: nameLocalizationRequestsTable,
  nameVariants: nameVariantsTable,
  userFavorites: userFavoritesTable,
  rateLimits: rateLimitsTable
};