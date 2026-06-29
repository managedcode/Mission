# Mission

Static Astro site for ManagedCode's open-source patronage initiative, published at
[mission.managed-code.com](https://mission.managed-code.com).

Mission explains the "Patrons of the digital commons" offer: companies fund a salary-grade
maintainer seat, and ManagedCode reserves maintainer capacity to triage, fix, release, report,
and mentor in the open.

## Source Of Truth

Keep public copy, grade details, funding figures, URLs, FAQ, SEO/AEO/GEO metadata, and project
facts in [`src/data/site.ts`](src/data/site.ts). Components should render from that data instead
of duplicating landing-page copy.

This README is intentionally short. Do not mirror the whole site here; update it only when the
repo purpose, public URL, setup, deployment path, or source-of-truth rule changes.

## Links

- Production: [mission.managed-code.com](https://mission.managed-code.com)
- Repository: [github.com/managedcode/Mission](https://github.com/managedcode/Mission)
- ManagedCode: [github.com/managedcode](https://github.com/managedcode)

## Develop

```bash
npm install
npm run dev
npm run check
npm run lint
npm run build
```

`npm run dev` uses the Astro dev server from `package.json`. Playwright uses port 4333.

## Test

```bash
npm test
npm run test:update
```

Visual baselines are committed under `tests/__screenshots__/` and platform-suffixed.
CI compares them, but never commits or pushes regenerated screenshots back to `main`.

## Deploy

GitHub Pages deploys from [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
The custom domain is configured in GitHub Pages settings.

## License

[CC BY 4.0](LICENSE) © Managed Code.
