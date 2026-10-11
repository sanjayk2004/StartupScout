# StartupScout

StartupScout is a startup discovery and investor networking platform that connects founders with potential investors. Founders can create and manage startup profiles, while investors can discover startups, describe their investment interests, maintain watchlists, and connect with founders.

The platform provides role-based access control, secure authentication, startup discovery, profile management, notifications, administrative workflows, and image uploads using S3-compatible object storage.

## Key Features

- **Role-specific authentication:** Separate registration and sign-in flows for investors and founders.
- **Investor profiles:** Manage investment interests, preferred industries, funding stages, investment ranges, and preferred startup locations.
- **Founder onboarding:** Create a founder account and a linked primary startup profile.
- **Startup management:** Create, view, update, and manage startup information.
- **Startup discovery:** Explore public startup listings and filter results using search criteria.
- **Investor discovery:** Allow founders to discover investor profiles through controlled public profile projections.
- **Watchlists:** Allow investors to save startups for later reference.
- **Connection requests:** Support investor-to-founder networking through connection requests and status updates.
- **Notifications:** Generate and manage notifications associated with platform events.
- **Administrative workflows:** Provide protected functionality for account management, startup moderation, reports, and verification.
- **Image uploads:** Store profile photos and startup images using S3-compatible object storage.
- **Financial information:** Capture founder annual turnover as revenue for a specified financial year, separately from funding raised and valuation.
- **Security and authorization:** Enforce role checks, resource ownership, input validation, and protected API access on the server.

## Technologies Used

| Technology | Purpose |
|---|---|
| React | Frontend user interface and reusable components |
| Vite | Frontend development server and production build |
| JavaScript | Frontend and backend application logic |
| Node.js | Backend runtime |
| Express.js | REST API and server-side routing |
| MongoDB | Persistent application data |
| Mongoose | Database models, schemas, and operations |
| Cookie-based authentication | Authenticated sessions and protected API access |
| S3-compatible object storage | Profile and startup image storage |
| Node.js test runner | Automated frontend API and backend tests |
| Git and GitHub | Version control and repository hosting |
| Code0 | AI-assisted development, implementation, debugging, and testing support |

## System Architecture

StartupScout uses a client-server architecture.

### Frontend

The React application is built with Vite. It provides authentication screens, investor and founder onboarding, profiles, startup discovery, and role-specific workspaces.

Frontend API modules communicate with the Express backend through `/api` requests.

### Backend

The Express API handles registration, authentication, validation, profile management, startup operations, discovery, notifications, networking, administrative workflows, and image uploads.

The server enforces role-based permissions and resource ownership independently of frontend controls.

### Database and Storage

MongoDB stores application records, including accounts, profiles, startups, and platform-related data.

S3-compatible object storage stores uploaded images. MongoDB stores the associated object URLs and metadata rather than large image binaries.

## User Roles

| Role | Registration and Access |
|---|---|
| Investor | Public registration, investor profile management, startup discovery, watchlists, and networking features |
| Founder | Public registration, founder profile management, a linked primary startup, and investor discovery |
| Admin | No public registration. Authorized staff accounts are provisioned through a controlled server-side process and receive access to protected administrative APIs. |

The role selected during sign-in is only a request. The backend authenticates the account and verifies its saved role before establishing an authenticated session.

Administrative credentials and signing secrets must never be stored in source control.

## Prerequisites

Before running the project, install and configure:

- Node.js compatible with the installed Vite version. Vite 8 requires Node.js 20.19+ or 22.12+.
- npm.
- MongoDB, either locally or through a hosted provider.
- An S3-compatible storage bucket and credentials for image uploads.
- Git, if cloning the repository.

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/sanjayk2004/StartupScout.git
cd StartupScout
```

### 2. Install frontend dependencies

```bash
npm --prefix client install
```

### 3. Install backend dependencies

```bash
npm --prefix server install
```

### 4. Configure environment variables

Create a private server environment file from the example.

**Windows PowerShell:**

```powershell
Copy-Item .\server\.env.example .\server\.env
```

**macOS/Linux:**

```bash
cp server/.env.example server/.env
```

Configure the environment variables documented in `server/.env.example` and `server/src/config/environment.js`.

These settings include the MongoDB connection, JWT signing secret, token lifetime, client origin, cookie configuration, and S3-compatible storage settings.

Use strong, private credentials. Never commit `server/.env` or expose server secrets through frontend environment variables.

### 5. Configure MongoDB

Ensure that MongoDB is running and accessible using the configured connection string.

Set the database URI in `server/.env` according to the environment template. Verify that the database account has only the permissions the application requires.

Do not use production data for local development.

### 6. Configure image storage

Set the S3-compatible storage values documented in `server/.env.example`.

Configure the bucket, region, endpoint when required, and credentials. Ensure the server has the necessary permissions to upload supported images.

Use HTTPS object URLs and appropriate access policies for private profile assets.

## Running the Application

Start the backend and frontend in separate terminals from the repository root.

### Terminal 1: Start the backend

```bash
npm --prefix server run dev
```

If the package manifest uses a different development script, follow the scripts defined in `server/package.json`.

The Express server must be running and able to connect to MongoDB.

### Terminal 2: Start the frontend

```bash
npm --prefix client run dev
```

Open the local URL printed by Vite, typically:

`http://localhost:5173`

### API proxy configuration

The Vite development server is intended to proxy `/api` requests to the Express backend, with `http://localhost:5000` as the documented default target.

If Express listens on another port, configure `VITE_API_PROXY_TARGET` in `client/.env.local` if supported by the current Vite configuration. Restart Vite after changing environment variables.

Ensure the proxy target matches the actual Express listening port. Configure the server's allowed client origin to match the frontend origin.

For production deployments, use HTTPS and appropriate secure cookie settings.

## Authentication and Security

StartupScout uses cookie-based authenticated sessions.

- Session cookies are configured by the backend and should be HttpOnly.
- Registration and sign-in use separate investor and founder flows.
- The backend validates registration input before creating accounts.
- Passwords are validated and securely hashed by the server.
- Public registration cannot assign the admin role.
- Protected API routes enforce authentication, account roles, and resource ownership.
- The backend verifies the account's saved role rather than trusting the role selected in the frontend.
- Upload endpoints validate the upload purpose, file type, content, size, and authorization.
- Private signing secrets, database credentials, and storage credentials must remain on the server.

Frontend validation improves usability but does not replace backend validation.

## Database and Administration

Mongoose models define the application's accounts, profiles, startup records, and platform-related entities. Database indexes support common discovery queries.

Administrative accounts are intended for authorized StartupScout staff. They must be provisioned through the controlled server-side bootstrap or provisioning process using credentials supplied securely at runtime.

Never add administrator credentials to source files, fixtures, documentation, or version control.

The server enforces administrative permissions on protected endpoints.

## Image Storage

Profile photos and startup images are uploaded to configured S3-compatible object storage.

The API validates upload purpose, supported file types, content signatures, file size, authentication, and ownership. MongoDB stores image URLs and associated metadata, while the image bytes remain in object storage.

Configure bucket permissions and cross-origin access appropriately for the deployed application. Avoid unintended public access to private profile assets.

## Testing and Production Build

Run the frontend tests:

```bash
npm --prefix client test
```

Run the backend tests:

```bash
npm --prefix server test
```

Build the frontend for production:

```bash
npm --prefix client run build
```

The frontend API tests cover role-specific registration endpoints, cookie credentials, login role forwarding, authentication error handling, and logout behavior.

The backend tests cover authentication and registration security, role and ownership restrictions, profiles, startup CRUD operations, uploads, discovery, notifications, and platform workflows.

Tests and build results should be reported based on the latest commands actually executed.

## AI Development Experience — Code0

Code0 was used during the development of StartupScout as an AI-assisted development tool for implementing features, working with existing code, debugging issues, and supporting testing and documentation.

The development workflow involved breaking work into specific tasks, examining the existing project structure, implementing frontend and backend functionality, and using automated tests and production builds to verify changes.

Code0 supported development across authentication, APIs, profile and workspace functionality, and image-storage integration. Security requirements—including backend validation, authentication, role enforcement, and ownership checks—remain essential to the implementation.

AI-assisted changes were evaluated against the existing application architecture and the results of available tests rather than being considered correct solely because code was generated.

## Specific Tasks Completed Using Code0

The following development tasks were tracked as part of the StartupScout implementation:

1. **Authentication and registration:** Implemented separate investor and founder registration flows, role-specific authentication endpoints, input validation, and secure cookie-based sessions. Code0 task reference: `7e21d656`.

2. **API development and access control:** Added protected profile, discovery, and administrative APIs, including server-enforced role and ownership checks. Code0 task reference: `ce7272bc`.

3. **Database and image-storage integration:** Implemented S3-compatible image uploads and persisted image URLs and metadata alongside application records. Code0 task reference: `d940d9c3`.

4. **Frontend components and workspaces:** Built authentication and onboarding screens, role-specific profiles, and workspace interfaces for platform users. Code0 task references: `733e4a3f` and `56d1cb6d`.

5. **Testing and documentation:** Tracked a separate task for verification and project documentation. Code0 task reference: `f770afec`.

These references should be retained only if they match the task records in the Code0 workspace.

## Future Improvements

Potential future improvements include:

- More comprehensive automated frontend interaction tests.
- Additional accessibility and usability refinements.
- Enhanced startup discovery and investor matching.
- Further monitoring, logging, and deployment automation.
- Additional integration testing for MongoDB and S3-compatible storage.

## License

Add the appropriate license information here if the project is distributed under an open-source or other formal license.