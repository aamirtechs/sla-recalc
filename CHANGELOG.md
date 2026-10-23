# Changelog

## 1.0.0

First release.

- Recompute first response and resolution time in business minutes from a raw ticket CSV.
- Config JSON for a fixed UTC offset, business hours per weekday, holiday dates and per priority targets in business minutes.
- Calendar minutes comparison columns so the gap between dashboard style counting and business hours counting is visible per ticket.
- Per ticket output CSV with breach flags, plus a summary report in Markdown with breach counts and rates by priority and by team.
- Tests covering weekend skipping, holiday skipping and overnight spans.
- Zero dependencies, library API and CLI.
