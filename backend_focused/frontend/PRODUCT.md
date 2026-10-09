# Product context

Fleet Tracker is a small administrative interface for the backend-focused technical challenge. Its users manage office locations, vehicles, mechanics, and maintenance records.

The core workflow is to register offices and mechanics, add vehicles to an office, and record maintenance. Operators can combine vehicle filters, inspect a vehicle's history, and identify vehicles needing maintenance. Office summaries and mechanic workload provide supporting operational views.

The priorities are working API integration, clear forms, useful loading and error states, and straightforward code organization. All screens use the real API. The backend supports JWT authentication, but a frontend login flow and advanced reporting remain outside the current scope.

Keep future changes simple: page-specific components and hooks remain within the owning route; reuse existing Material UI components and shared RHF controls before adding abstractions or dependencies.
