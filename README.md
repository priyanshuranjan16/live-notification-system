# 🚀 Real-Time CRM & Intelligent Notification Platform

A modern, high-performance **Real-Time CRM & Notification Platform** built with **Next.js 15 (App Router)**, **Custom Express + Socket.IO Server**, **Prisma ORM**, **PostgreSQL**, and powered by **Bun**.

This platform provides real-time entity assignment notifications (Companies & Contacts), automated background cron reminders (`node-cron`), instant audio alerts, persistent unread state management, and role-based CRM access.

---

## 🏗 System Architecture

The system features a **hybrid Next.js + Express architecture** running seamlessly under a single server process, sharing real-time WebSocket connections and database pools.

```
                  +-----------------------------------+
                  |      Browser Client (React 19)    |
                  +-----------------------------------+
                               |         ^
                       HTTP /  |         | WebSocket /
                     REST API  v         | Socket.IO
                  +-----------------------------------+
                  |   Custom Server (server/server.js)|
                  |  Express API  +  Socket.IO Server |
                  +-----------------------------------+
                     |              |             |
                     v              v             v
            +----------------+ +----------+ +---------------+
            | Next.js Router | | Node Cron| | Prisma ORM    |
            | (SSR / Pages)  | | Engine   | | (Database API)|
            +----------------+ +----------+ +---------------+
                                                  |
                                                  v
                                         +------------------+
                                         | PostgreSQL DB    |
                                         +------------------+
```

### Architectural Highlights
- **Unified Server**: Custom Express HTTP server hosting both Next.js request handler and Socket.IO real-time engine on port `3000`.
- **Targeted WebSocket Broadcasting**: Notifications are emitted directly to user-specific WebSocket rooms (`user_<userId>`), avoiding unnecessary broad network broadcasts.
- **Automated Cron Service**: `node-cron` background scheduler checks every 2 minutes for pending activities and dispatches system notifications to users.
- **Transactional Consistency**: Entity creations and assignments write atomically to PostgreSQL via Prisma ORM before triggering real-time alerts.

---

## 🗄️ Database Schema & Data Model

The database is built on **PostgreSQL** managed through **Prisma ORM**.

```mermaid
erDiagram
    User ||--o{ Assignment : "has many"
    User ||--o{ Notification : "receives"
    Company ||--o{ Contact : "contains"
    Company ||--o{ Assignment : "assigned in"
    Contact ||--o{ Assignment : "assigned in"

    User {
        String id PK "UUID"
        String name
        String email UK
        Role role "Enum"
        DateTime createdAt
        DateTime updatedAt
    }

    Company {
        String id PK "UUID"
        String name
        String industry
        String website
        DateTime createdAt
        DateTime updatedAt
    }

    Contact {
        String id PK "UUID"
        String name
        String email
        String phone
        String companyId FK "Optional"
        DateTime createdAt
        DateTime updatedAt
    }

    Assignment {
        String id PK "UUID"
        AssignmentRole role "Enum"
        String userId FK
        String companyId FK "Optional"
        String contactId FK "Optional"
        DateTime createdAt
    }

    Notification {
        String id PK "UUID"
        String userId FK
        String title
        String message
        NotificationType type "Enum"
        Boolean isRead
        DateTime createdAt
    }
```

### Core Enums
- **`Role`**: `SYSTEM_ADMIN`, `SUPREME_COMMANDER`, `AVENGER_LEAD`, `STRATEGIC_TACTICIAN`, `FIELD_AGENT`, `TECH_SPECIALIST`, `GUARDIAN_DEFENDER`, `ADMIN`, `MANAGER`, `AGENT`
- **`AssignmentRole`**: `SHIELD_DIRECTOR`, `STARK_TECH_ADVISOR`, `VIBRANIUM_SPECIALIST`, `MULTIVERSE_GUARDIAN`, `HEAD_TACTICIAN`, `FIELD_LEAD`, `ACCOUNT_OWNER`, `SUPPORT_LEAD`, `SALES_REP`
- **`NotificationType`**: `ASSIGNMENT`, `CRON_REMINDER`, `SYSTEM`

---

## ⚡ Prerequisites

Make sure you have installed on your machine:
- **[Bun](https://bun.sh/)** (v1.0.0 or higher)
- **Node.js** (v18+ recommended)
- **PostgreSQL** (Running locally or hosted via Supabase/Neon/Railway)

---

## 🛠️ Quick Start & Setup Instructions

### 1. Clone & Install Dependencies

Using **Bun**:
```bash
bun install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/notification_db?schema=public"
PORT=3000
NODE_ENV=development
```

### 3. Database Migration & Setup

Generate Prisma Client and push the schema to PostgreSQL:
```bash
# Push schema changes to database
bunx prisma db push

# Generate Prisma Client types
bunx prisma generate
```

### 4. Seed Database

Populate the database with superhero-themed team members, companies, contacts, and initial assignments:
```bash
bunx prisma db seed
```

### 5. Run Development Server

Launch the full-stack development server with hot reloading using **Bun**:
```bash
bun dev
```

Open your browser and visit: **`http://localhost:3000`**

---

## 📜 Available Bun Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| **`bun dev`** | `bun run dev` | Starts the custom Express + Socket.IO + Next.js server |
| **`bun run build`** | `bun run build` | Compiles the Next.js frontend for production |
| **`bun start`** | `bun start` | Runs the compiled server in production mode |
| **`bunx prisma studio`** | `bunx prisma studio` | Opens interactive Prisma GUI for database inspection |
| **`bunx prisma db seed`**| `bunx prisma db seed` | Executes initial seed script (`prisma/seed.ts`) |

---

## 🔔 Key Features

- 🎧 **Web Audio Synthesizer**: Uses Web Audio API for custom generated chime audio alerts without external MP3 asset dependency.
- ⚡ **Instant Multi-User Switching**: Seamlessly switch active user identity in the UI header to test real-time targeted notification delivery.
- 📊 **Real-Time Toast Notifications**: Live badge counters, slide-out notification drawer, filter by read/unread status, and bulk "Mark all as read".
- 📈 **Interactive CRM Dashboard**: Quick stats cards, assignment manager, company directory, and contact directory with search filters.
