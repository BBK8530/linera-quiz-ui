# Quiz Application

## Project Overview

This is a feature-rich quiz application built on the Linera SDK that enables creating interactive quizzes with multiple question types, real-time scoring, and leaderboard functionality. The application provides a comprehensive GraphQL API for managing quizzes, submitting answers, and tracking performance metrics.

### Key Features

- Create and manage multiple-choice quizzes with configurable time limits
- Support for multiple correct answers and weighted question points
- Real-time scoring and detailed performance analytics
- Global and quiz-specific leaderboards
- User profile management with nickname customization
- Time-based quiz availability (start/end time configuration)

### Code Structure

- `src/service.rs` - Service implementation containing GraphQL Schema and query handling
- `src/lib.rs` - ABI definitions including data models and operation enums
- `src/state.rs` - State definitions using Linera Views
- `src/contract.rs` - Contract implementation with Linera SDK
- `front-end` - Vue.js application for the quiz interface and user interactions
- `run.bash`: Script to build and run the application locally
- `compose.yaml`: Docker Compose configuration
- `Dockerfile`: Docker configuration for containerized deployment

### Running with Docker

Docker support is available through `compose.yaml`

```bash
docker compose up --force-recreate
```

The application will be accessible at:

- Frontend: http://localhost:5173
- GraphQL API: http://localhost:8080/chains/[CHAIN_ID]/applications/[APP_ID]

The application uses the Linera SDK for smart contract development and GraphQL for the API layer.
