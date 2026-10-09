## Project

See README.md for commands, content editing, events, styling (Tailwind v4 + the brand tokens and primitives from @proudindian/design, the proud-indian-ngo/design package) and the QA scripts. Package manager: bun. `bun run check`, `bun run check:types`, `bun run qa:behaviour` and `bun run qa:doodles` are the bar for any change (qa:behaviour needs a built site served at http://localhost:4321; see README "Quality checks").

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
