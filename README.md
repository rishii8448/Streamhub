# Streamhub

A backend API for a YouTube-like app built with Express, MongoDB, Mongoose, JWT auth, Cloudinary image uploads, and Multer file handling.

## Features

- User registration with avatar and optional cover image upload
- Login with email or username
- JWT-based authentication middleware
- Refresh token support via cookies
- Update account details, avatar, and cover image
- Fetch current user profile
- Fetch user channel profile by username
- Fetch watch history with video lookup

## Project Structure

- `src/app.js` - Express app setup
- `src/index.js` - App entry point and DB connection
- `src/db/index.js` - MongoDB connection
- `src/constants.js` - Application constants
- `src/routes/user.routes.js` - User API routes
- `src/controllers/user.controller.js` - User request handlers
- `src/middlewares/auth.middlewares.js` - JWT verification
- `src/middlewares/multer.middleware.js` - File upload handling
- `src/models/` - Mongoose schemas and models
- `src/utils/` - Helpers: Cloudinary uploader, async handler, API response/error wrappers

## Requirements

- Node 18+ or compatible version
- npm
- MongoDB instance
- Cloudinary account

## Setup

1. Install dependencies

```sh
npm install
