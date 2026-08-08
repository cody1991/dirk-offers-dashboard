# Dirk offers dashboard

`npm install --prefix dirk-offers-dashboard` installs the isolated React dashboard.

Run `npm run refresh --prefix dirk-offers-dashboard -- --force` to fetch the latest offers, update `public/data/offers.json`, and record a SQLite snapshot in `data/offers.sqlite`.

The GitHub Actions workflow wakes at 08:00 and 09:00 UTC but proceeds only when the local time in Amsterdam is 10:00; this keeps the schedule correct through daylight saving time. It commits the refreshed data and deploys the static React build to GitHub Pages.
