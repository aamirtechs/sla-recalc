# Good first issues

These are seeded ideas for first time contributors. Everything runs offline on synthetic CSV files, so no helpdesk account is needed.

## 1. Holiday presets for US, UK and PK

Add preset holiday lists for the United States, the United Kingdom and Pakistan that a user can select in the config instead of typing dates by hand. Ship each preset as a small JSON file with the year in its name, load it when the config names a preset, and keep hand typed holiday dates working alongside a preset. Add a test that proves a preset holiday is skipped the same way a hand typed one is.

## 2. Pause-on-Pending support from a status-change export

Many SLAs pause while a ticket waits on the customer. Add support for an optional second CSV that lists status changes per ticket, and subtract the time a ticket spent in a Pending style status from its business minutes. Keep the current behaviour unchanged when no status file is given, document the expected columns clearly, and add tests for a pause that crosses a weekend.

## 3. Percentile (median and p90) response-time output

Extend the summary report with median and 90th percentile first response and resolution times, in business minutes, overall and by priority. Percentiles make a support lead far less dependent on averages that a few very old tickets can distort. Sort carefully, handle groups with a single ticket, and add tests with a small hand checked data set where the median and p90 are known in advance.
