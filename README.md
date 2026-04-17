# parvishgajjar.github.io

Static GitHub Pages site for Parvish Gajjar.

## Files

- `index.html`: page structure and copy
- `styles.css`: visual system, layout, and motion
- `script.js`: scroll reveal and nav state
- `.nojekyll`: ensures GitHub Pages serves the site directly

## Publish to GitHub Pages

1. Create a GitHub repository named `parvishgajjar.github.io`.
2. Push these files to the `main` branch at the repository root.
3. If Pages is not enabled automatically, open `Settings -> Pages`.
4. Set the source to `Deploy from a branch`.
5. Select `main` and `/ (root)`, then save.
6. The site URL will be `https://parvishgajjar.github.io/`.

## Local preview

Run either command from this folder:

```powershell
python -m http.server 4173
```

or

```powershell
py -m http.server 4173
```

Then open `http://localhost:4173/`.

## Content assumptions

This draft uses public profile signals rather than local workspace content:

- GitHub profile details for name, company, location, avatar, bio, and repo links
- LinkedIn-accessible public snippets and public references to shape tone and values
- Dalhousie public convocation material for the MACS credential

The site is intentionally written to make mindset visible, not just skills or tools.

If you want to tune the positioning, edit the hero copy in `index.html` and the highlighted projects in the `Public Build Log` section.
