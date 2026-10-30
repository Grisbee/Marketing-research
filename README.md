# Marketing-research

Bubble tea survey for the Marketing Research course (Group 5).

| Path | What it is |
|------|------------|
| `survey.html` | Online survey (English / 中文), hosted on GitHub Pages |
| `logos/` | Brand logos used in Q16–Q17 |
| `apps-script/Code.gs` | Google Apps Script that stores responses in a Google Sheet |
| `paper/survey_paper.html` → `.pdf` | Printable paper form (English, A4) |

## Collecting responses in Google Sheets

GitHub Pages only serves files, so the survey sends each finished response to a Google Sheet.
A copy also stays in the respondent's browser and is re-sent on their next visit if sending failed.

1. Create a new Google Sheet (any name).
2. In the sheet: **Extensions → Apps Script**. Replace the editor contents with `apps-script/Code.gs`, save.
3. **Deploy → New deployment** → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**, allow the permissions Google asks for, copy the **Web app URL** (ends with `/exec`).
5. In `survey.html`, paste it into `STUDY.sheetUrl`, commit and push.

Responses appear in the `Responses` tab; the header row is created by the first response.
`received_at` is the server time of each row (the other times come from the respondent's device).
The sheet rejects a second response with the same email.

The web app URL is public (it is in the page source). The script only appends validated rows and
answers "has this email already answered?" with yes/no; it never returns stored answers. That
yes/no check is what lets the survey stop a repeat respondent before they spend five minutes on it.
To start over, delete the rows below the header (or the whole `Responses` tab).

After changing `Code.gs`: **Deploy → Manage deployments → Edit → Version: New version → Deploy**.
The URL stays the same.

## Publishing on GitHub Pages

The repository must be public on a free GitHub account.

1. Push the repository to GitHub.
2. **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. After a minute the survey is at `https://<user>.github.io/<repo>/survey.html`.

## Team page

`survey.html#staff` (password in `STUDY.staffPassword`) downloads or deletes the responses stored in
*that* browser. With Google Sheets set up, the sheet is the place to read results; this page is a backup.
The password only keeps casual visitors out: anyone can read it in the page source.

## Paper form

Edit `paper/survey_paper.html`, then print it to PDF (Chrome: Print → Save as PDF, A4, no headers and footers).
Keep it in sync with the questions in `survey.html`.
