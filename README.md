# Adventure Builder Website — Stage W2A Shared Authentication

Clean replacement build adding website Login, Register, remembered sessions, account display and Logout.

The website uses the same Supabase project and user accounts as the Adventure Builder app.

## Files replaced
- `index.html`
- `css/styles.css` authentication/header section
- `js/main.js`

## New modules
- `js/config.js`
- `js/auth.js`

## Supabase requirement
Add these URLs to Supabase Authentication → URL Configuration:
- Site URL: `https://adventurebuilder.co.uk`
- Redirect URL: `https://adventurebuilder.co.uk/**`

## Test
1. Register on the website.
2. Confirm email if Supabase email confirmation is enabled.
3. Log in on the website.
4. Refresh and confirm the website remembers the session.
5. Log out.
6. Use the same email/password in the Adventure Builder app.
