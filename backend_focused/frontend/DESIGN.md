# Design context

Use the shared Material UI theme in `theme.ts` and standard Material UI components. The interface favors familiar administrative tables, forms, and dialogs over custom visual treatments.

- Light background `#f5f7fb`, white surfaces, blue primary actions `#2459a6`.
- Primary text `#172b45`, secondary text `#526175`, and the system font stack.
- Eight-pixel corner radius, no default Paper elevation, and sentence-case buttons.
- A shared app header with four sections: Vehicles, Offices, Mechanics, and Maintenance. Desktop uses top-level tabs; below the `sm` breakpoint a labeled Material UI Section selector replaces them.
- Grid and Stack for responsive layout; contained primary actions, plain secondary actions, and error-colored delete actions.
- Visible labels, field-level validation, confirmation before deletion, and explicit loading, empty, error, and success feedback.
- Tables may scroll horizontally on narrow screens. Forms should fit their dialog width and collapse columns on mobile.
- Shared pagination has two spacing units of horizontal padding, keeping counts and controls inset from table/card edges.

Keep styling in the theme or Material UI props. Avoid a separate custom CSS system, decorative dashboards, and overly generic CRUD component generators.

## Section hierarchy

The selected section remains active on every route below it. Below the page title and description, use local route tabs: Vehicles has All vehicles / Needing maintenance, Offices has All offices / Fleet summary, and Mechanics has All mechanics / Workload. Maintenance has no redundant single-item tab row. Report titles retain the section name, with their selected view and reporting period immediately below. Vehicle details keep their vehicle-specific title and belong to All vehicles, including loading and error states.

`MainNavigation` and `SectionTabs` share a small route configuration in `components/navigation/`. Selection derives from the URL, not separate component state; links, refresh, and browser history keep both levels synchronized. `PageHeader` accepts an optional navigation slot without owning routing. Local tabs retain MUI scrolling and mobile scroll buttons when their labels need more room. The mascot, primary actions, existing URLs, and page-level data behavior stay intact.

## Navigation feedback

Use one shared `NavigationProgress` with `nextjs-toploader`: a fixed 3 px line in the theme's primary blue, without spinner or glow. It acknowledges route changes from links and programmatic navigation, without blocking interactions or adding artificial delays. Hash-only links do not trigger it. Reduced motion disables crawling and transitions. Page-level query states continue to communicate API loading and errors separately.

## Report navigation and views

Aggregate reports have dedicated routes and local tabs within their owning section, not sections below CRUD results. The reading order is section title and period, local view tabs, List/Chart controls, metric choice, then results. Use a single MUI surface with responsive Stack layout. List remains the default for exact values and full fields; Chart uses Community MUI X horizontal bars with a zero baseline, one metric at a time, and all returned records. Costs and counts never share an axis. Long chart labels shorten only on the axis; tooltips and keyboard descriptions preserve the complete label. Empty, error, and refreshing states reuse the existing query conventions.

## Vehicle maintenance history

The vehicle detail screen receives the complete history with the vehicle in one API response. Use a virtualized Material UI table (`react-virtuoso`) with all records available locally, a sticky header, and a keyboard-focusable scroll region. Keep the visible total and complete-history label; do not paginate, truncate notes, or fetch additional records while scrolling. The API owns newest-first ordering. Preserve mechanic details, costs, notes, the empty state, horizontal table scrolling on mobile, and the Manage maintenance link to the separate paginated CRUD screen. Expose total row count and virtual row positions to assistive technology; native browser Find is limited to mounted rows.

## Mascot interactions

Piston is a small capybara mechanic in blue workwear. This remains an operational interface: the mascot adds warmth at the start of a task, without competing with data or changing workflows.

- Reuse `FleetMascot` in the app header and `MascotDialogTitle` in create/edit and record-detail dialogs; both stay still and are decorative for accessibility. Long record titles wrap without pushing the mascot or dialog beyond the viewport.
- Use `MascotButton` only for the primary Add actions. A 200 ms reveal brings the mascot out from behind the button on fine-pointer hover or keyboard focus, without moving layout or intercepting clicks.
- Touch keeps the normal one-tap action. Disabled/loading buttons do not reveal the mascot. Reduced-motion users get the state change without a transition.
- Keep delete, error, and confirmation flows neutral. No looping animation, confetti, extra providers, or animation dependency.
