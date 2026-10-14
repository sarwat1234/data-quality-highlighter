# Data Quality Highlighter

A small working demo of a rule-driven data quality feature: administrators write formula rules, a form highlights the fields that fail those rules, and an API reports a status for a customer without opening the record.

This is an independent demonstration built from scratch with made-up data. It is inspired by a type of feature I specified and tested in my day job as a business analyst, but it does not contain any employer code, screens, or data.

The documents in [`docs/`](docs) describe the feature the way I would on a real project:

- [Business Requirements Document](docs/BRD_Data_Quality_Field_Highlighting.pdf) (FR-01 to FR-14, user stories, acceptance criteria)
- [Test Plan](docs/Test_Plan_Data_Quality_Field_Highlighting.pdf) (19 sample test cases, TC-01 to TC-19)
- [Traceability Matrix](docs/Traceability_Matrix_Data_Quality_Field_Highlighting.pdf) (requirements mapped to stories and tests)

The code and tests follow those documents, and the requirement and test case numbers match.

## What it does

- **Rules:** each rule has a formula, a type (mandatory or desired), a description, and the fields it highlights. A rule **fails when its formula returns true**, for example `revenue < 50000`.
- **Highlighting:** pressing "Check data quality" puts a colored halo around failing fields (one color for mandatory, another for desired). Hovering shows the rule description as a tooltip. Fix the data and press the button again to clear the highlights.
- **Never blocks:** the rules inform the user. Saving always works.
- **Status API:** `GET /api/customers/<id>/check` returns `Blocked` (a mandatory rule failed), `Warning` (only desired rules failed), or `Passed`, plus the list of failed rules. One customer per call.
- **Admin:** add rules from the page. Invalid formulas are rejected by the parser and never saved.

### Formula basics

Field names, numbers, text in quotes, `< <= > >= == !=`, `&& || !`, `+ - * /`, brackets, and `isBlank(field)`.
A blank value never satisfies a comparison, so test for it explicitly: `isBlank(revenue) || revenue < 50000`.

## Run it

You need [Node.js](https://nodejs.org) version 18 or newer. There is nothing else to install.

```bash
npm start
```

Then open <http://localhost:3000>. Stop it with `Ctrl+C`.

Run the automated tests:

```bash
npm test
```

## Things to try in the demo

1. Pick **C-1002 Birch Bakery** and press **Check data quality**. Revenue is under 50,000, so it gets a red halo. Hover over it to see the tooltip.
2. Change revenue to `50000` (the boundary) and check again. The highlight clears.
3. Pick **C-1003** and check. Cost is over 100,000 with no comment, so the comment field gets the amber warning color. Type a comment and check again.
4. Pick **C-1004** and check. It has both mandatory and desired failures. Then press **Check via API** to see `Blocked` with all failed rules.
5. In the admin panel, add the rule `netIncome > revenue` (type desired, highlight `netIncome`). Then try a broken formula such as `revenue <` and see it rejected.

Data lives in memory only. Restarting the server resets everything.

## Project layout

```
server.js          small HTTP server (no dependencies)
src/engine.js      formula parser, rule evaluation, rule creation
src/session.js     the form behaviour (check, highlights, save)
src/api.js         customer status check and save
src/data.js        made-up template, rules and customers
public/            the demo page
test/              19 automated tests mapped to the test plan
docs/              BRD, test plan, traceability matrix
```

## Test coverage note

The 19 tests cover the rule engine, form behaviour and API. The browser checks in the test plan (for example, how the halo and tooltip look in Chrome and Edge) are manual and are not part of the automated suite.

## License

MIT
