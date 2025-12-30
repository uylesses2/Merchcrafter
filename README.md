# MerchCrafter

A full-stack web application for creating merch from books.

## Tech Stack
- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Backend**: Node.js, Fastify, TypeScript, Prisma (SQLite), JWT Auth
- **Shared**: TypeScript DTOs

## Structure
- `frontend/`: React application
- `backend/`: API server
- `shared/`: Shared types

## Prerequisites
- Node.js (v18+)
- npm

## Getting Started

1.  **Install Dependencies**
    From the root directory:
    ```bash
    npm install
    # This installs dependencies for root, frontend, backend, and shared workspaces
    ```

2.  **Database Setup**
    The database (SQLite) is automatically initialized. If you need to reset it:
    ```bash
    npm run prisma:migrate -w backend
    ```

3.  **Run Development Servers**
    To run both backend and frontend concurrently:
    ```bash
    npm run dev
    ```
    - Frontend: http://localhost:5173
    - Backend: http://localhost:3000

## Features (Skeleton)
- **Auth**: Register/Login (email/password).
- **Projects**: Upload (dummy), List, Details.
- **Generation**: Stubbed preview and upscale generation (decrements credits).
- **Billing**: Stubbed credit purchase.
- **PWA**: Installable as a progressive web app.

## Development
- `npm run dev:backend` - Run only backend
- `npm run dev:frontend` - Run only frontend
"# Merchcrafter" 
