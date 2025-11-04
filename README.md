# Discord Channel Manager Dashboard

A modern dashboard for managing Discord channels and sending messages via webhooks, built with Next.js, Tailwind CSS, shadcn/ui, and Supabase.

## Features

- **Workspace/Server Management**: Create and manage multiple Discord servers/workspaces
- **Channel Management**: Add Discord channels with webhook URLs
- **Message Composer**: Create messages with content, embeds, and custom webhook settings
- **Template System**: Save and load message templates for quick reuse
- **Message History**: View, edit, and delete previously sent messages
- **Real-time Preview**: See how your message will look before sending
- **Dark Theme**: Beautiful dark-themed interface

## Tech Stack

- **Next.js 14+** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality component library
- **Supabase** - Backend as a service (PostgreSQL, Auth)
- **date-fns** - Date formatting utilities

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account and project
- Discord webhook URLs for your channels

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd discord-manager
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

4. Set up the database:
   - Start Supabase locally: `supabase start`
   - Run migrations: `supabase migration up`
   - Or manually run all migration files in `supabase/migrations/` in order
   - This will create all necessary tables, set up Row Level Security policies, and configure cron jobs

5. Deploy and configure Supabase Edge Function for scheduled messages:
   - **For local development:**
     ```bash
     supabase functions serve process-scheduled-messages --no-verify-jwt
     ```
     Note: The `--no-verify-jwt` flag disables JWT verification for local development, allowing the cron job to call the function without authentication.
   - **For production:**
     ```bash
     supabase functions deploy process-scheduled-messages
     ```
   - Sync Edge Function URL configuration:
     ```bash
     npm run sync-cron-config
     ```
   - Or manually update the database:
     ```sql
     -- Local development
     UPDATE cron_config SET value = 'http://127.0.0.1:54321/functions/v1/process-scheduled-messages' 
     WHERE key = 'edge_function_url';
     
     -- Production (replace YOUR_PROJECT_REF with your actual project reference)
     UPDATE cron_config SET value = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-scheduled-messages' 
     WHERE key = 'edge_function_url';
     ```

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

**Note:** For scheduled messages to work, ensure:
- The cron job is set up (migration 007_setup_scheduled_messages_cron.sql)
- The Edge Function is deployed and running
- The Edge Function URL is configured in the `cron_config` table
- The `pg_net` extension is enabled (configured in `supabase/config.toml`)

## Database Schema

The application uses the following tables:

- **workspaces**: Discord servers/workspaces
- **channels**: Discord channels with webhook URLs
- **templates**: Saved message templates
- **messages**: Message history

All tables have Row Level Security (RLS) enabled to ensure users can only access their own data.

## Usage

1. **Sign Up/Login**: Create an account or sign in
2. **Add a Server**: Click the "+" icon to add a new Discord server
3. **Add Channels**: Click "Add Channel" to add Discord channels with webhook URLs
4. **Compose Messages**: 
   - Use the Content tab for plain text messages
   - Use the Embed tab to create rich embeds
   - Use the Settings tab to override webhook username/avatar
5. **Send Messages**: Click "Send" to post your message to Discord
6. **Manage Templates**: Save frequently used messages as templates
7. **View History**: Check your message history and edit/resend previous messages

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── auth/             # Authentication pages
│   ├── protected/       # Protected dashboard route
│   └── layout.tsx        # Root layout
├── components/
│   ├── modals/           # Modal components
│   ├── ui/               # shadcn/ui components
│   ├── Dashboard.tsx     # Main dashboard component
│   ├── ChannelsSidebar.tsx
│   ├── Composer.tsx
│   └── PreviewSidebar.tsx
├── lib/
│   ├── discord/          # Discord webhook utilities
│   ├── supabase/         # Supabase client utilities
│   └── utils.ts          # Utility functions
└── supabase/
    └── migrations/       # Database migrations
```

## License

MIT
