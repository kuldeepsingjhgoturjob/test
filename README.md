# Got UR Job website

- Public website, one page each: index.html (Home), jobs.html, services.html, employers.html, premium.html, apply.html, about.html, contact.html
- style.css, site.js and assets/ (logo.jpg, founder.jpg) are shared by every page
- apply.html#job and apply.html#hire open the candidate or employer form directly
- admin.html: admin console (open /admin). Admin creates sub-users and gives permissions
- netlify/functions/api.mjs: jobs, applications, resumes, premium, users (stored in Netlify Blobs)
- netlify/functions/chat.js: AI chat assistant

Netlify environment variables:
- ADMIN_PASS (required): the admin password
- ADMIN_USER (optional, default "admin")
- SESSION_SECRET (required): a long random text
- ANTHROPIC_API_KEY (for the AI chat)
- RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (for online Premium payment of Rs 99). Without them the site falls back to the manual UPI/WhatsApp flow.
- RAZORPAY_WEBHOOK_SECRET (recommended): in the Razorpay dashboard add a webhook to https://YOUR-SITE/api/razorpay-webhook with events payment.captured and order.paid, and use the same secret here.
