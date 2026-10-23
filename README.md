# sla-recalc

Recompute first response and resolution SLAs from a raw ticket CSV using your own business hours, holidays and per priority targets, and see where the helpdesk dashboard number is wrong.

## Why

Helpdesk dashboards often count elapsed calendar time, count business hours for the wrong timezone, or quietly use a holiday calendar from another country. Any of those makes an SLA report wrong in a way nobody can see from the dashboard itself. This tool recomputes everything from the raw ticket export with a config you control, and puts the calendar minutes beside the business minutes for every ticket, so the difference is a number you can point at rather than an argument.

## Install

Requires Node.js 20 or later. No dependencies.

```bash
git clone https://github.com/aamirtechs/sla-recalc.git
cd sla-recalc
node src/cli.js --input examples/tickets.csv --config examples/config.json --out out.csv --report report.md
```

## Input

A ticket CSV with these columns. `first_reply_at` and `resolved_at` may be empty.

```csv
id,created_at,first_reply_at,resolved_at,priority,team
1001,2026-01-05T09:30:00Z,2026-01-05T10:00:00Z,2026-01-05T15:30:00Z,urgent,support
1002,2026-01-02T16:00:00Z,2026-01-05T10:00:00Z,2026-01-05T12:00:00Z,high,support
1003,2026-01-01T10:00:00Z,2026-01-02T10:30:00Z,2026-01-02T16:00:00Z,normal,billing
1004,2026-01-05T16:30:00Z,2026-01-06T09:30:00Z,,low,billing
1005,2026-01-05T09:00:00Z,,2026-01-07T17:00:00Z,urgent,support
1006,2026-01-06T10:00:00Z,2026-01-06T14:00:00Z,2026-01-06T16:00:00Z,high,tech
```

Timestamps are ISO 8601. See the offset note below for how they are interpreted.

## Config

```json
{
  "utcOffsetMinutes": 0,
  "businessHours": {
    "0": null,
    "1": {
      "start": "09:00",
      "end": "17:00"
    },
    "2": {
      "start": "09:00",
      "end": "17:00"
    },
    "3": {
      "start": "09:00",
      "end": "17:00"
    },
    "4": {
      "start": "09:00",
      "end": "17:00"
    },
    "5": {
      "start": "09:00",
      "end": "17:00"
    },
    "6": null
  },
  "holidays": [
    "2026-01-01"
  ],
  "targets": {
    "urgent": {
      "firstResponse": 60,
      "resolution": 480
    },
    "high": {
      "firstResponse": 120,
      "resolution": 960
    },
    "normal": {
      "firstResponse": 240,
      "resolution": 1920
    },
    "low": {
      "firstResponse": 480,
      "resolution": 3840
    }
  }
}
```

- `utcOffsetMinutes`: the fixed UTC offset your support hours run in, in minutes. For example 300 for UTC+5, -300 for UTC-5, 0 for UTC.
- `businessHours`: keys are weekday numbers, 0 for Sunday through 6 for Saturday. A `null` day, or a missing day, is not a business day. Start and end are 24 hour wall clock times in that offset.
- `holidays`: dates, in `YYYY-MM-DD` form, in that same offset, which are skipped even when they fall on a business weekday.
- `targets`: per priority, the first response and resolution targets in business minutes.

### Offset handling, kept simple and deterministic

All wall clock reasoning happens in the single fixed offset from the config. Timestamps are shifted by that offset and their shifted wall clock time decides the weekday, the holiday match and whether a minute falls inside business hours. There is no timezone database and no daylight saving logic, by design: the same input and config always give the same answer on any machine. If your team changes clocks seasonally, split the export at the change and run each part with its own offset.

## Usage

```bash
node src/cli.js --input tickets.csv --config config.json --out tickets-out.csv --report report.md
```

## Example

Running the command above on the files in `examples/` produces this real per ticket output:

```csv
id,created_at,first_reply_at,resolved_at,priority,team,first_response_business_minutes,first_response_calendar_minutes,first_response_breach,resolution_business_minutes,resolution_calendar_minutes,resolution_breach
1001,2026-01-05T09:30:00Z,2026-01-05T10:00:00Z,2026-01-05T15:30:00Z,urgent,support,30,30,false,360,360,false
1002,2026-01-02T16:00:00Z,2026-01-05T10:00:00Z,2026-01-05T12:00:00Z,high,support,120,3960,false,240,4080,false
1003,2026-01-01T10:00:00Z,2026-01-02T10:30:00Z,2026-01-02T16:00:00Z,normal,billing,90,1470,false,420,1800,false
1004,2026-01-05T16:30:00Z,2026-01-06T09:30:00Z,,low,billing,60,1020,false,,,
1005,2026-01-05T09:00:00Z,,2026-01-07T17:00:00Z,urgent,support,,,,1440,3360,true
1006,2026-01-06T10:00:00Z,2026-01-06T14:00:00Z,2026-01-06T16:00:00Z,high,tech,240,240,true,360,360,false
```

Read ticket 1002 closely: a first reply that took 3,960 calendar minutes took only 120 business minutes, because most of the wait was a weekend. A dashboard counting calendar time reports a breach that never happened under business hours rules. Ticket 1003 shows the same effect for the 2026-01-01 holiday.

And this real summary report:

```markdown
# SLA summary

Tickets processed: 6

First response breaches: 1
Resolution breaches: 1

## By priority

| Group | Tickets | First response breaches | First response breach rate | Resolution breaches | Resolution breach rate |
| --- | --- | --- | --- | --- | --- |
| high | 2 | 1 | 50% | 0 | 0% |
| low | 1 | 0 | 0% | 0 | n/a |
| normal | 1 | 0 | 0% | 0 | 0% |
| urgent | 2 | 0 | 0% | 1 | 50% |

## By team

| Group | Tickets | First response breaches | First response breach rate | Resolution breaches | Resolution breach rate |
| --- | --- | --- | --- | --- | --- |
| billing | 2 | 0 | 0% | 0 | 0% |
| support | 3 | 0 | 0% | 1 | 33.3% |
| tech | 1 | 1 | 100% | 0 | 0% |

Business minutes count only time inside the configured business hours on business days, skipping holidays. Calendar minutes count every minute, so the gap between the two columns in the CSV is where a dashboard that uses calendar time, or the wrong business hours, misstates the SLA.
```

Tickets with an empty `first_reply_at` or `resolved_at` get blank minutes and a blank breach flag for that measure. They are counted in the ticket totals but excluded from that measure's breach rate, rather than being silently treated as breaches or as instant replies.

## Library API

```js
import { parseCsv, evaluateTickets, businessMinutesBetween } from "./src/sla.js";

const rows = evaluateTickets(parseCsv(csvText), config);
console.log(businessMinutesBetween("2026-01-02T16:00:00Z", "2026-01-05T10:00:00Z", config)); // 120
```

## Tests

```bash
npm test
```

The suite covers weekend skipping, holiday skipping, overnight spans, offsets, breach flags and the summary report.

## License

MIT, see LICENSE.
