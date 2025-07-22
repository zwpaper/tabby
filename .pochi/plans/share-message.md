This document outlines the plan to implement a new 'Clip' feature that allows users to create a shareable, paste-bin-like snapshot of a conversation.

### 1. Database Migration

- **DONE: 1.1. Create a new migration file** in `packages/server/migrations` to add the `clip` table to the database schema.
    - `id`: Primary key, auto-incrementing integer.
    - `data`: A `jsonb` column to store the raw message content.
    - `createdAt`: Timestamp of when the clip was created.

- **DONE: 1.2. Run the database migration** to apply the schema changes.

- **DONE: 1.3. Update the TypeScript schema definitions** by running `bun run db:genschema` in the `packages/db` directory. This will update `packages/db/src/schema.d.ts` to include the new `clip` table.

### 2. Backend Implementation (packages/server)

- **DONE: 2.1. Create a new API endpoint to create a clip**.
    - **Endpoint**: `POST /api/clips`
    - **Request Body**: A JSON object with a `data` field containing the raw message content.
    - **Action**: Saves the data to the `clip` table and returns the encoded ID of the new clip.

- **DONE: 2.2. Create a new API endpoint to retrieve a clip**.
    - **Endpoint**: `GET /api/clips/:id`
    - **Action**: Retrieves a clip by its encoded ID from the `clip` table and returns the `data` content.

### 3. Website Implementation (packages/website)

- **DONE: 3.1. Create a new page for creating a clip**.
    - **Route**: `/clip/new`
    - **Functionality**: This page will feature a text area for users to paste message content. A "Create Clip" button will submit the content to the `POST /api/clips` endpoint. Upon success, the user will be redirected to the view page for the newly created clip (e.g., `/clip/:id`).

- **DONE: 3.2. Create a new page for viewing a clip**.
    - **Route**: `/clip/:id`
    - **Functionality**: This page will fetch the clip data from `GET /api/clips/:id` and render the messages using the existing UI components.

