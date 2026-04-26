# ECR Lifecycle Manager

A professional web UI for managing AWS Elastic Container Registry (ECR) lifecycle policies across all your repositories — with a safe dry-run preview before applying any changes.

![ECR Lifecycle Manager](https://img.shields.io/badge/AWS-ECR-orange?logo=amazonaws) ![React](https://img.shields.io/badge/React-18-blue?logo=react) ![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=nodedotjs) ![Docker](https://img.shields.io/badge/Docker-Compose-blue?logo=docker)

---

## Features

- **AWS Credential Configuration** — Connect securely using your AWS Access Key ID and Secret Access Key. Credentials are held in memory only, never persisted.
- **Dynamic Policy Builder** — Build custom image retention rules per tag prefix (e.g. `prod`, `uat`, `dev`). Three presets available: Conservative, Standard, Aggressive.
- **Repository Selection** — Search, filter, and select individual repositories from your ECR registry.
- **Dry Run Preview** — See exactly which images would be deleted before applying anything. Per-repo expandable results with image tags, digests, and push dates.
- **Apply Dashboard** — Live per-repo progress feed via Server-Sent Events. Two-step confirmation before any changes are made.
- **Dry Run History** — Session log of all dry runs for comparison before committing to apply.

---

## Architecture

```
Browser (React + Vite + Tailwind)
        ↓
Express Backend (Node.js)
        ↓
AWS SDK v3 → ECR API
```

The Express backend proxies all AWS API calls, keeping credentials server-side and avoiding browser CORS restrictions.

---

## Getting Started

### Prerequisites

- Node.js 18+
- AWS IAM user with the following ECR permissions:
  - `ecr:DescribeRepositories`
  - `ecr:PutLifecyclePolicy`
  - `ecr:GetLifecyclePolicy`
  - `ecr:DeleteLifecyclePolicy`
  - `ecr:StartLifecyclePolicyPreview`
  - `ecr:GetLifecyclePolicyPreview`

### Run Locally

**1. Clone the repo**

```bash
git clone https://github.com/meet302001/ecr-lifecycle-manager.git
cd ecr-lifecycle-manager
```

**2. Start the backend**

```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:3001
```

**3. Start the frontend**

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

---

## Run with Docker Compose

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

---

## IAM Policy

Attach the following policy to your IAM user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRLifecycleManagement",
      "Effect": "Allow",
      "Action": [
        "ecr:PutLifecyclePolicy",
        "ecr:GetLifecyclePolicy",
        "ecr:DeleteLifecyclePolicy",
        "ecr:StartLifecyclePolicyPreview",
        "ecr:GetLifecyclePolicyPreview",
        "ecr:DescribeRepositories"
      ],
      "Resource": "arn:aws:ecr:<REGION>:<ACCOUNT_ID>:repository/*"
    }
  ]
}
```

---

## Lifecycle Policy Rules

The default policy (configurable in the UI):

| Rule | Tag Prefix | Retention |
|---|---|---|
| Untagged images | — | Deleted after 1 day |
| Production images | `prod` | Keep last 20 |
| UAT images | `uat` | Keep last 10 |
| Dev images | `dev` | Keep last 5 |
| All other tagged | `*` | Keep last 5 |

---

## Project Structure

```
ecr-lifecycle-manager/
├── frontend/                  # React + Vite + Tailwind CSS
│   └── src/
│       ├── components/
│       │   ├── AwsConfig.jsx         # Credentials + connect
│       │   ├── PolicyBuilder.jsx     # Dynamic policy rules
│       │   ├── RepoSelector.jsx      # Repo filter + selection
│       │   ├── DryRunPanel.jsx       # Preview + polling
│       │   ├── ApplyDashboard.jsx    # Live apply progress
│       │   └── DryRunHistory.jsx     # Session history
│       └── App.jsx
├── backend/                   # Express + AWS SDK v3
│   ├── routes/ecr.js          # ECR API proxy routes
│   └── index.js
├── docker-compose.yml
└── iam-policy.json            # Reference IAM policy
```

---

## Security Notes

- AWS credentials are never logged or written to disk
- Credentials are stored in React component state (cleared on refresh)
- The backend only exposes ECR-specific endpoints
- Always run a dry run before applying

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

## License

MIT
