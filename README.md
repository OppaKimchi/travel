# Our Trips

A private trip planner for Vitou and Carmen, served at `vitou.au/travel/`.

- Day-by-day plan with drag-and-drop, plus an Ideas list for places not on a day yet
- Map of every stop, numbered in visiting order, with Google Maps directions
- Place search through OpenStreetMap, or paste a full Google Maps link
- Live sync between phones, and the last saved copy opens with no signal
- Installs to the home screen (Share > Add to Home Screen on iPhone)

Built with React, TypeScript and Vite. Data and sign-in are on Supabase. Hosted on GitHub Pages.

## One-time setup

1. **Supabase project.** Create a free project at supabase.com (region: Sydney).
2. **Database.** In the project, open SQL Editor, paste `supabase/001_core.sql` and run it.
3. **Sign-in settings.** Under Authentication > Sign In / Providers, keep Email enabled, turn off
   "Allow new users to sign up", and turn off "Confirm email".
4. **Accounts.** Under Authentication > Users, use Add user > Create new user for each of you,
   with "Auto Confirm User" ticked. Each person can change their password in the app afterwards.
5. **Connect the app.** Copy the Project URL and the publishable key (Project Settings > API Keys)
   into `src/config.ts`. Never use the secret or service_role key.
6. **Share a trip.** Create a trip, open its settings and add the other person by their email.

Supabase pauses free projects after a week with no activity. If the app stops loading data after
a quiet spell, open the Supabase dashboard and restore the project.

## Run it locally

```bash
npm install
npm run dev
```

## Deploy

Pushing to `main` builds the site and publishes it with GitHub Actions. In the repository's
Settings > Pages, Source must be set to GitHub Actions.
