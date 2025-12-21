🌱 Digital Life Lessons — Backend

A secure and scalable REST API powering the Digital Life Lessons platform, handling authentication, payments, lesson management, and admin moderation.

🛠️ Tech Stack (Backend)

Node.js

Express.js

MongoDB

Firebase Admin SDK

Stripe API

JWT Token Verification

dotenv

CORS

🔐 Security & Authentication

Firebase Admin token verification

Protected routes for users & admins

Role-based access control

Secure environment variable handling

Owner-only lesson modification

🗄️ Database Collections

users

lessons

favorites

comments

lessonReports

payments

🚀 Core Backend Features
👤 User Management

Store user profile & role

Premium plan tracking

Role update (Admin only)

User deletion (Admin only)

📚 Lesson Management

Create, read, update & delete lessons

Public / Private visibility control

Free / Premium access control

Featured lesson support

Pagination, search & filter APIs

❤️ Engagement System

Like & unlike lessons

Favorites storage

Comment storage

View count support

Real-time compatible API responses

🚩 Reporting & Moderation

Lesson reporting with reason & timestamp

Store reports in dedicated collection

Admin review & action system

Delete or ignore reported lessons

💳 Stripe Payment Integration

Create checkout session

Stripe webhook handling

Update isPremium status in MongoDB

MongoDB as single source of truth

Payment success & cancel handling

📊 Admin Analytics

Total users count

Total public lessons

Reported lessons count

Most active contributors

Lesson growth tracking APIs

🔄 API Best Practices

Clean RESTful endpoints

Secure protected routes

Proper HTTP status codes

No CORS / 404 / reload issues

Optimized MongoDB queries


Create a .env file with:

MongoDB URI

Firebase Admin credentials

Stripe secret & webhook key

✅ Project Compliance

Secure credentials

No hardcoded secrets

Stable production-ready server

Reload-safe frontend support

Admin-only moderation controls

👨‍💻 Developer

Rakibul Hasan
Full-Stack Web Developer
