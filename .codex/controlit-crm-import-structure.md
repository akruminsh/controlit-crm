# Controlit CRM Import Structure

Date checked: 2026-05-13
Production URL: https://crm.controlitfactory.eu
Database: `default`
Workspace ID: `63c3e463-fa79-4e0e-8f48-1363976393df`
Workspace schema: `workspace_5wmm9pi4cq3zt1f5aj99x2g9r`

## Current Data Counts

| Object | Rows |
| --- | ---: |
| Company | 12 |
| Person | 19 |
| Opportunity | 7 |
| Task | 6 |
| Note | 9 |
| Attachment | 1 |
| Timeline activity | 199 |
| Workspace member | 4 |

## Workspace Members

| Name | Email | Role |
| --- | --- | --- |
| CRM Admin | crm@controlitfactory.eu | Admin |
| Erik Stankevics | erik@controlit.ae | Member |
| Sofija Strelita Strele | sofija@controlitfactory.eu | Member |
| Eriks Stankevics | eriks@controlit.lv | Member |

All four roles currently have read/update/destroy access to all object records.

## Main Import Order

1. Companies
2. People, linked to companies
3. Opportunities, linked to companies and optionally point-of-contact people
4. Tasks, linked through `taskTarget`
5. Notes, linked through `noteTarget`
6. Attachments, if files are provided separately

## Company

Table: `workspace_5wmm9pi4cq3zt1f5aj99x2g9r.company`

Core import fields:
- `name` - company name
- `domainNamePrimaryLinkUrl` - website URL, unique when not empty
- `domainNamePrimaryLinkLabel` - display label for website
- `linkedinLinkPrimaryLinkUrl`
- `linkedinLinkPrimaryLinkLabel`
- `employees`
- `annualRecurringRevenueAmountMicros`
- `annualRecurringRevenueCurrencyCode`
- `addressAddressStreet1`
- `addressAddressStreet2`
- `addressAddressCity`
- `addressAddressPostcode`
- `addressAddressState`
- `addressAddressCountry`
- `idealCustomerProfile`
- `companyType`
- `accountOwnerId` - links to `workspaceMember.id`

`companyType` options:
- `DEVELOPER` - Developer
- `ARCHITECTURAL_BUREAU` - Architectural bureau
- `BUILDERS` - Builders
- `DISTIBUTORS` - Distibutors, spelling is exactly as stored

## Person

Table: `workspace_5wmm9pi4cq3zt1f5aj99x2g9r.person`

Core import fields:
- `nameFirstName`
- `nameLastName`
- `emailsPrimaryEmail` - unique when not empty
- `emailsAdditionalEmails` - JSONB
- `phonesPrimaryPhoneNumber`
- `phonesPrimaryPhoneCountryCode`
- `phonesPrimaryPhoneCallingCode`
- `phonesAdditionalPhones` - JSONB
- `jobTitle`
- `city`
- `linkedinLinkPrimaryLinkUrl`
- `linkedinLinkPrimaryLinkLabel`
- `xLinkPrimaryLinkUrl`
- `xLinkPrimaryLinkLabel`
- `companyId` - links to `company.id`

## Opportunity

Table: `workspace_5wmm9pi4cq3zt1f5aj99x2g9r.opportunity`

Core import fields:
- `name`
- `stage`
- `amountAmountMicros`
- `amountCurrencyCode`
- `closeDate`
- `companyId` - links to `company.id`
- `pointOfContactId` - links to `person.id`

`stage` options:
- `POTENTIAL` - Potential
- `OUTGOING` - Outgoing
- `PROPOSAL` - Proposal
- `FINISHED` - Finished

Money is stored in micros: `100 EUR` is `100000000`.

## Task

Table: `workspace_5wmm9pi4cq3zt1f5aj99x2g9r.task`

Core import fields:
- `title`
- `bodyV2Markdown`
- `bodyV2Blocknote`
- `dueAt`
- `status`
- `assigneeId` - links to `workspaceMember.id`

`status` options:
- `TODO` - To do
- `IN_PROGRESS` - In progress
- `DONE` - Done

Task links are stored in `workspace_5wmm9pi4cq3zt1f5aj99x2g9r.taskTarget`:
- `taskId`
- one of `companyId`, `personId`, `opportunityId`

## Note

Table: `workspace_5wmm9pi4cq3zt1f5aj99x2g9r.note`

Core import fields:
- `title`
- `bodyV2Markdown`
- `bodyV2Blocknote`

Note links are stored in `workspace_5wmm9pi4cq3zt1f5aj99x2g9r.noteTarget`:
- `noteId`
- one of `companyId`, `personId`, `opportunityId`

## Current Data Quality Notes

- Several existing companies and people are blank records.
- Existing `createdByName`, `createdByWorkspaceMemberId`, and company `accountOwnerId` are effectively empty, so historical author/owner attribution is not reliable.
- Future imports can explicitly set `createdByName`, `createdByWorkspaceMemberId`, and owner/assignee IDs if the source file contains manager names/emails.
- Existing records use website/email as the practical dedupe keys: company domain and person primary email.

## Login Diagnosis Notes

- `AUTH_PASSWORD_ENABLED=true`.
- `crm@controlitfactory.eu` exists.
- Admin email is verified.
- Admin user has a password hash.
- API `checkUserExists` returns `exists=true`, `availableWorkspacesCount=1`, `isEmailVerified=true`.
- API returns `Wrong password` when a wrong password is submitted, so the login endpoint itself is working.
- If the known admin password fails, the most likely root cause is that the stored password hash does not match the password being used. Reset password rather than trying to recover plaintext.
