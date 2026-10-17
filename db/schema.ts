import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const rooms = sqliteTable('rooms', {
 code: text('code').primaryKey(),
 data: text('data').notNull(),
 revision: integer('revision').notNull().default(0),
});
