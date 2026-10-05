/**
 * AJ Classes: parent consent form for sharing a student's testimonial,
 * photo or name online (Release 1 PRP A.11, T20; needed before R2 testimonials).
 *
 * One generic form for every family. The parent enters their child's full name
 * and date of birth, picks what we may share, and signs by typing their name.
 *
 * HOW TO RUN
 *   1. script.google.com → New project → paste this file.
 *   2. Run `buildConsentForm` once. Approve the permission prompt (Forms + Sheets).
 *      The execution log prints the edit link, the link to send parents, and
 *      the response sheet.
 *   3. In the form: Settings → Responses → "Send responders a copy" → Always.
 *      (Apps Script can't set this one.)
 *
 * OPTIONAL: PRE-FILLED LINK PER STUDENT
 *   Fill in STUDENTS below and run `logConsentLinks`. Each parent gets a link
 *   with their child's name and date of birth already filled in.
 *   From another function you can also call makeConsentLink('Full Name', 'dd/MM/yyyy').
 */

// ─── Config ─────────────────────────────────────────────────────────────────
const CONFIG = {
  TITLE: 'AJ Classes: consent to share your child’s testimonial and results',
  DESCRIPTION:
    'Thank you for being part of AJ Classes! We would love to celebrate your child’s ' +
    'achievement. Please tell us what you are happy for us to share. ' +
    'Nothing is published without this form. Takes about 2 minutes.',
  CONFIRMATION:
    'Thank you! Your consent has been recorded. ' +
    'To change or withdraw it at any time, email hello@ajclasses.com.au.',
  RESPONSE_SHEET_NAME: 'AJ Classes: media consent responses',
  CONTACT_EMAIL: 'hello@ajclasses.com.au',
  WITHDRAWAL_DAYS: 7,
};

// Used by `logConsentLinks`. Full name and date of birth (dd/MM/yyyy).
const STUDENTS = [
  // { fullName: 'Priya Sharma', dob: '01/12/2014' },
];

// Question titles are reused when building pre-filled links, so keep them here.
const TITLES = {
  CHILD_NAME: 'Child’s full name',
  CHILD_DOB: 'Child’s date of birth',
  RESULT: 'School offer or scholarship to mention (optional)',
  SHARE: 'What are you happy for AJ Classes to share?',
  NAME_STYLE: 'How should we show your child’s name?',
  PARENT_NAME: 'Your full name',
  RELATIONSHIP: 'Your relationship to the child',
  PARENT_MOBILE: 'Your mobile number',
  DECLARATION: 'Declaration',
  SIGNATURE: 'Signature',
};

// Strict dd/MM/yyyy, e.g. 01/12/2020.
const DOB_PATTERN = '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/(19|20)[0-9]{2}$';

const SHARE_CHOICES = [
  'Testimonial video, on YouTube, Instagram, Facebook and the AJ Classes website',
  'Photo of my child, with their name and school offer / scholarship',
  'Name and school offer / scholarship only (no photo)',
];

const DECLARATION_TEXT =
  'I am the parent or legal guardian of this child and can give this consent. ' +
  'I understand I can change or withdraw it at any time by emailing ' +
  CONFIG.CONTACT_EMAIL + ', and AJ Classes will remove the content within ' +
  CONFIG.WITHDRAWAL_DAYS + ' days. Content already shared or downloaded by ' +
  'others may not be fully removable.';

const FORM_ID_PROPERTY = 'CONSENT_FORM_ID';

// ─── Build the form ─────────────────────────────────────────────────────────
function buildConsentForm() {
  const form = FormApp.create(CONFIG.TITLE)
    .setDescription(CONFIG.DESCRIPTION)
    .setConfirmationMessage(CONFIG.CONFIRMATION)
    .setProgressBar(true)
    .setAllowResponseEdits(false)
    .setEmailCollectionType(FormApp.EmailCollectionType.RESPONDER_INPUT);

  addChildSection(form);
  addConsentSection(form);
  addParentSection(form);

  const sheet = SpreadsheetApp.create(CONFIG.RESPONSE_SHEET_NAME);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  PropertiesService.getScriptProperties().setProperty(FORM_ID_PROPERTY, form.getId());

  Logger.log('Edit the form:     ' + form.getEditUrl());
  Logger.log('Send to parents:   ' + form.getPublishedUrl());
  Logger.log('Responses sheet:   ' + sheet.getUrl());
}

function addChildSection(form) {
  form.addSectionHeaderItem().setTitle('About your child');

  form.addTextItem().setTitle(TITLES.CHILD_NAME).setRequired(true);

  const dobValidation = FormApp.createTextValidation()
    .requireTextMatchesPattern(DOB_PATTERN)
    .setHelpText('Please use dd/mm/yyyy, e.g. 01/12/2014.')
    .build();
  form
    .addTextItem()
    .setTitle(TITLES.CHILD_DOB)
    .setHelpText('dd/mm/yyyy, e.g. 01/12/2014')
    .setValidation(dobValidation)
    .setRequired(true);

  form
    .addTextItem()
    .setTitle(TITLES.RESULT)
    .setHelpText('e.g. "Melbourne High School, 2027 intake" or "Scholarship, Haileybury"');
}

function addConsentSection(form) {
  form.addPageBreakItem().setTitle('What we may share');

  form
    .addCheckboxItem()
    .setTitle(TITLES.SHARE)
    .setHelpText('Tick everything you are comfortable with.')
    .setChoiceValues(SHARE_CHOICES)
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(TITLES.NAME_STYLE)
    .setChoiceValues(['First name and surname initial (e.g. Priya S.)', 'Full name'])
    .setRequired(true);
}

function addParentSection(form) {
  form.addPageBreakItem().setTitle('About you, and your signature');

  form.addTextItem().setTitle(TITLES.PARENT_NAME).setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(TITLES.RELATIONSHIP)
    .setChoiceValues(['Mother', 'Father', 'Legal guardian'])
    .showOtherOption(true)
    .setRequired(true);

  form.addTextItem().setTitle(TITLES.PARENT_MOBILE).setRequired(true);

  form
    .addCheckboxItem()
    .setTitle(TITLES.DECLARATION)
    .setChoiceValues([DECLARATION_TEXT])
    .setRequired(true);

  form
    .addTextItem()
    .setTitle(TITLES.SIGNATURE)
    .setHelpText('Type your full name to sign. The date and time are recorded automatically.')
    .setRequired(true);
}

// ─── Pre-filled links ───────────────────────────────────────────────────────
function logConsentLinks() {
  if (STUDENTS.length === 0) {
    Logger.log('Add students to the STUDENTS list first.');
    return;
  }
  STUDENTS.forEach((student) => {
    Logger.log(student.fullName + ':  ' + makeConsentLink(student.fullName, student.dob));
  });
}

/**
 * Returns a link to the consent form with the child's name and date of birth filled in.
 * @param {string} fullName  e.g. 'Priya Sharma'
 * @param {string} dob       dd/MM/yyyy, e.g. '01/12/2014'
 */
function makeConsentLink(fullName, dob) {
  const name = String(fullName || '').trim();
  if (!name) throw new Error('Full name is required.');
  if (!isValidDob(dob)) throw new Error('Date of birth must be a real date in dd/MM/yyyy: ' + dob);

  const form = openConsentForm();
  const response = form
    .createResponse()
    .withItemResponse(findTextItem(form, TITLES.CHILD_NAME).createResponse(name))
    .withItemResponse(findTextItem(form, TITLES.CHILD_DOB).createResponse(dob));
  return response.toPrefilledUrl();
}

function isValidDob(dob) {
  if (!new RegExp(DOB_PATTERN).test(dob)) return false;
  const [day, month, year] = dob.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  // Rejects dates like 31/02/2014, which JavaScript would roll over to March.
  return date.getDate() === day && date.getMonth() === month - 1 && date < new Date();
}

function openConsentForm() {
  const formId = PropertiesService.getScriptProperties().getProperty(FORM_ID_PROPERTY);
  if (!formId) throw new Error('Run buildConsentForm first.');
  return FormApp.openById(formId);
}

function findTextItem(form, title) {
  const item = form.getItems(FormApp.ItemType.TEXT).find((i) => i.getTitle() === title);
  if (!item) throw new Error('Question not found in the form: ' + title);
  return item.asTextItem();
}
