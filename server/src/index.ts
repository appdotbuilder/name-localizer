import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import { 
  createNameLocalizationInputSchema,
  getLocalizationByIdInputSchema,
  addToFavoritesInputSchema,
  removeFavoriteInputSchema,
  getUserFavoritesInputSchema,
  checkRateLimitInputSchema
} from './schema';

// Import handlers
import { createNameLocalization } from './handlers/create_name_localization';
import { getLocalizationById } from './handlers/get_localization_by_id';
import { addToFavorites } from './handlers/add_to_favorites';
import { removeFavorite } from './handlers/remove_favorite';
import { getUserFavorites } from './handlers/get_user_favorites';
import { checkRateLimit } from './handlers/check_rate_limit';
import { getRecentLocalizations } from './handlers/get_recent_localizations';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Core name localization functionality
  createNameLocalization: publicProcedure
    .input(createNameLocalizationInputSchema)
    .mutation(({ input }) => createNameLocalization(input)),

  getLocalizationById: publicProcedure
    .input(getLocalizationByIdInputSchema)
    .query(({ input }) => getLocalizationById(input)),

  getRecentLocalizations: publicProcedure
    .query(() => getRecentLocalizations(10)),

  // User favorites management
  addToFavorites: publicProcedure
    .input(addToFavoritesInputSchema)
    .mutation(({ input }) => addToFavorites(input)),

  removeFavorite: publicProcedure
    .input(removeFavoriteInputSchema)
    .mutation(({ input }) => removeFavorite(input)),

  getUserFavorites: publicProcedure
    .input(getUserFavoritesInputSchema)
    .query(({ input }) => getUserFavorites(input)),

  // Rate limiting
  checkRateLimit: publicProcedure
    .input(checkRateLimitInputSchema)
    .query(({ input }) => checkRateLimit(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors({
        origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
        credentials: true
      })(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`NameLocalizer TRPC server listening at port: ${port}`);
}

start();