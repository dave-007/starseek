# Deployment Notes

## Open Graph & Twitter Card Images

The `index.html` file currently uses relative paths for Open Graph and Twitter Card image URLs:
- `og:image` → `/og-image.png`
- `twitter:image` → `/og-image.png`

### Post-Deployment Action Required

After deploying to Vercel, you should update these meta tags to use absolute URLs with your Vercel domain:

```html
<!-- Replace relative paths with absolute URLs -->
<meta property="og:image" content="https://your-app.vercel.app/og-image.png" />
<meta name="twitter:image" content="https://your-app.vercel.app/og-image.png" />
```

Alternatively, you can use Vercel environment variables to inject the URL at build time. Create a build script that replaces the placeholders with the actual URL from `VERCEL_URL` environment variable.

### Why Absolute URLs?

Social media platforms (Facebook, Twitter, Slack, Discord, etc.) require absolute URLs in Open Graph and Twitter Card meta tags to properly fetch and display preview images when links are shared.
