/**
 * Staff Welfare Committee, TCV School Selakui
 * Google Apps Script backend. Data lives in the spreadsheet this script is bound to;
 * bill and ID photos live in a private Google Drive folder.
 *
 * Deploy as a web app: Execute as "Me", Who has access "Anyone".
 * People sign in with their staff ID and PIN, not with a Google account.
 */

var APP_NAME = 'Staff Welfare Committee';
var SESSION_HOURS = 6;

var SCHEMA = {
  Staff: ['id', 'name', 'quarter', 'role', 'pinHash', 'salt', 'mustChange', 'active', 'createdAt'],
  Visitors: ['id', 'staffId', 'staffName', 'quarter', 'visitorNames', 'count', 'relation', 'arrival', 'leaving',
    'nights', 'phone', 'idType', 'purpose', 'photoId', 'status', 'reviewNote', 'reviewedBy', 'createdAt', 'updatedAt'],
  Disputes: ['id', 'caseNo', 'reporterId', 'anonymous', 'involved', 'kind', 'happenedOn', 'place', 'details',
    'wish', 'status', 'meetingDate', 'log', 'createdAt', 'updatedAt'],
  Events: ['id', 'name', 'date', 'status', 'createdBy', 'createdAt'],
  Donations: ['id', 'eventId', 'date', 'donor', 'mode', 'amount', 'note', 'addedBy', 'createdAt'],
  Expenses: ['id', 'eventId', 'date', 'category', 'paidBy', 'description', 'items', 'total', 'photoIds',
    'addedBy', 'createdAt'],
  Settings: ['key', 'value']
};

var DEFAULT_SETTINGS = {
  longStayNights: '7',
  expenseCategories: 'Groceries,Meat and fish,Gas and fuel,Decoration,Hall and tent,Transport,Gifts,Other',
  photoFolderId: '',
  committeeName: 'Staff Welfare Committee',
  schoolName: 'TCV School Selakui',
  logo: ''
};

var VISITOR_STATUSES = ['To review', 'Approved', 'Not approved', 'Left'];
var DISPUTE_STATUSES = ['Open', 'Meeting set', 'Resolved', 'Closed'];

/* ---------- Web app entry ---------- */

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ---------- One-time setup (run from the editor) ---------- */

function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    var cols = SCHEMA[name];
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  var settings = getSettings_();
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    if (settings[k] === undefined) setSetting_(k, DEFAULT_SETTINGS[k]);
  });
  if (!getSettings_().photoFolderId) {
    var folder = DriveApp.createFolder('SWC bills and photos (private)');
    setSetting_('photoFolderId', folder.getId());
  }
  var staff = readTable_('Staff');
  if (!staff.some(function (s) { return s.role === 'admin'; })) {
    var pin = String(Math.floor(100000 + Math.random() * 900000));
    var salt = Utilities.getUuid();
    insert_('Staff', {
      id: 'admin', name: 'SWC Admin', quarter: '', role: 'admin', pinHash: hash_(pin, salt), salt: salt,
      mustChange: 'yes', active: 'yes', createdAt: now_()
    });
    Logger.log('Admin created. Staff ID: admin   Temporary PIN: ' + pin);
    return 'Admin created. Staff ID: admin, temporary PIN: ' + pin;
  }
  Logger.log('Setup checked. Sheets are ready.');
  return 'Setup checked. Sheets are ready.';
}

// Run from the editor if the admin PIN is forgotten. Only someone signed in to the
// committee Google account can open the editor, so this is the recovery path.
function resetAdminPin() {
  var pin = String(Math.floor(100000 + Math.random() * 900000));
  var salt = Utilities.getUuid();
  var patch = { role: 'admin', pinHash: hash_(pin, salt), salt: salt, mustChange: 'yes', active: 'yes' };
  if (findBy_('Staff', 'id', 'admin')) {
    update_('Staff', 'admin', patch);
  } else {
    patch.id = 'admin'; patch.name = 'SWC Admin'; patch.quarter = ''; patch.createdAt = now_();
    insert_('Staff', patch);
  }
  CacheService.getScriptCache().remove('fail_admin');
  Logger.log('Admin PIN reset. Staff ID: admin   Temporary PIN: ' + pin);
  return 'Admin PIN reset. Staff ID: admin, temporary PIN: ' + pin;
}

/* ---------- Sign in ---------- */

function login(staffId, pin) {
  staffId = String(staffId || '').trim().toLowerCase();
  var cache = CacheService.getScriptCache();
  var failKey = 'fail_' + staffId;
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) throw new Error('Too many wrong PINs. Try again in 15 minutes.');
  var s = findBy_('Staff', 'id', staffId);
  if (!s || s.active !== 'yes' || hash_(String(pin || ''), s.salt) !== s.pinHash) {
    cache.put(failKey, String(fails + 1), 900);
    throw new Error('Staff ID or PIN is not right.');
  }
  cache.remove(failKey);
  var token = Utilities.getUuid();
  cache.put('sess_' + token, s.id, SESSION_HOURS * 3600);
  return { token: token, user: publicUser_(s) };
}

function logout(token) {
  CacheService.getScriptCache().remove('sess_' + token);
  return true;
}

function whoAmI(token) {
  return publicUser_(user_(token));
}

function changePin(token, oldPin, newPin) {
  var s = user_(token);
  if (hash_(String(oldPin || ''), s.salt) !== s.pinHash) throw new Error('Current PIN is not right.');
  if (!/^\d{4,8}$/.test(String(newPin))) throw new Error('New PIN must be 4 to 8 digits.');
  var salt = Utilities.getUuid();
  update_('Staff', s.id, { pinHash: hash_(String(newPin), salt), salt: salt, mustChange: 'no' });
  return true;
}

/* ---------- Start-up data ---------- */

// Names and logo for the header and the sign-in screen, so no sign-in is needed.
function branding() {
  var st = getSettings_();
  return { committeeName: st.committeeName || DEFAULT_SETTINGS.committeeName, schoolName: st.schoolName || DEFAULT_SETTINGS.schoolName, logo: st.logo || '' };
}

function bootstrap(token) {
  var u = user_(token);
  var settings = getSettings_();
  var staffList = readTable_('Staff').filter(function (s) { return s.active === 'yes' && s.role !== 'admin'; })
    .map(function (s) { return { id: s.id, name: s.name, quarter: s.quarter }; });
  return {
    user: publicUser_(u),
    staff: staffList,
    knownNames: knownNames_(staffList),
    branding: branding(),
    settings: {
      longStayNights: Number(settings.longStayNights || 7),
      expenseCategories: String(settings.expenseCategories || '').split(',').map(trim_).filter(String)
    },
    today: today_()
  };
}

function dashboard(token) {
  requireCommittee_(token);
  var today = today_();
  var visitors = readTable_('Visitors');
  var active = function (v) { return v.status === 'Approved' || v.status === 'To review'; };
  var staying = visitors.filter(function (v) { return active(v) && v.arrival <= today && v.leaving >= today; })
    .sort(function (a, b) { return a.quarter < b.quarter ? -1 : a.quarter > b.quarter ? 1 : 0; });
  var overdue = visitors.filter(function (v) { return active(v) && v.leaving < today; })
    .sort(function (a, b) { return a.leaving < b.leaving ? -1 : 1; });
  var arriving = visitors.filter(function (v) { return active(v) && v.arrival > today; })
    .sort(function (a, b) { return a.arrival < b.arrival ? -1 : 1; }).slice(0, 5);
  var quarters = {};
  staying.forEach(function (v) { quarters[v.quarter] = true; });
  var disputes = readTable_('Disputes');
  var open = disputes.filter(function (d) { return d.status === 'Open' || d.status === 'Meeting set'; });
  var meetings = open.filter(function (d) { return d.meetingDate && d.meetingDate >= today; })
    .sort(function (a, b) { return a.meetingDate < b.meetingDate ? -1 : 1; });
  var events = readTable_('Events');
  var names = {};
  events.forEach(function (e) { names[e.id] = e.name; });
  var nextEvent = events.filter(function (e) { return e.status !== 'Closed' && e.date >= today; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0] || null;
  var money = readTable_('Donations').map(function (n) {
    return { kind: 'donation', date: n.date, what: n.donor, event: names[n.eventId] || '', eventId: n.eventId, amount: money_(n.amount), createdAt: n.createdAt };
  }).concat(readTable_('Expenses').map(function (x) {
    return { kind: 'expense', date: x.date, what: x.category + (x.paidBy ? ', paid by ' + x.paidBy : ''), event: names[x.eventId] || '', eventId: x.eventId, amount: money_(x.total), createdAt: x.createdAt };
  })).sort(byDateDesc_).slice(0, 6);
  var totals = fundTotals_();
  return {
    stayingCount: staying.reduce(function (n, v) { return n + Number(v.count || 1); }, 0),
    stayingQuarters: Object.keys(quarters).length,
    toReview: visitors.filter(function (v) { return v.status === 'To review'; }).length,
    openDisputes: open.length,
    nextMeeting: meetings.length ? meetings[0].meetingDate : '',
    balance: totals.balance,
    staying: staying,
    overdue: overdue,
    arriving: arriving,
    recentVisitors: visitors.sort(byCreatedDesc_).slice(0, 6),
    openDisputesList: open.sort(byCreatedDesc_).slice(0, 4).map(disputeSummary_),
    meetings: meetings.slice(0, 5).map(disputeSummary_),
    nextEvent: nextEvent ? eventSummary_(nextEvent) : null,
    openEvents: events.filter(function (e) { return e.status !== 'Closed'; }).length,
    recentMoney: money
  };
}

/* ---------- Visitors ---------- */

function saveVisitor(token, data) {
  var u = user_(token);
  var isCommittee = u.role !== 'staff';
  var old = data.id ? findBy_('Visitors', 'id', data.id) : null;
  if (data.id && !old) throw new Error('Report not found.');
  if (old && !isCommittee && old.staffId !== u.id) throw new Error('You can only change your own reports.');
  required_(data, ['visitorNames', 'relation', 'arrival', 'leaving']);
  if (data.leaving < data.arrival) throw new Error('Leaving date is before the arrival date.');
  // The committee types the staff member's name; it is linked to a staff account when one matches.
  var staffId, staffName, quarter;
  if (isCommittee && (trim_(data.staffName) || data.staffId)) {
    var s = data.staffId ? findBy_('Staff', 'id', data.staffId) : staffByName_(data.staffName);
    staffId = s ? s.id : '';
    staffName = s ? s.name : trim_(data.staffName);
    quarter = trim_(data.quarter) || (s ? s.quarter : '');
  } else if (old) {
    staffId = old.staffId; staffName = old.staffName; quarter = trim_(data.quarter) || old.quarter;
  } else if (isCommittee) {
    throw new Error('Type the name of the staff member.');
  } else {
    staffId = u.id; staffName = u.name; quarter = trim_(data.quarter) || u.quarter;
  }
  var rec = {
    staffId: staffId, staffName: staffName, quarter: quarter,
    visitorNames: trim_(data.visitorNames), count: String(Math.max(1, Number(data.count) || 1)),
    relation: trim_(data.relation), arrival: data.arrival, leaving: data.leaving,
    nights: String(nightsBetween_(data.arrival, data.leaving)), phone: trim_(data.phone),
    idType: trim_(data.idType), purpose: trim_(data.purpose), updatedAt: now_()
  };
  if (data.photo) rec.photoId = savePhoto_(data.photo, 'ID ' + rec.staffName + ' ' + rec.arrival);
  if (old) {
    update_('Visitors', old.id, rec);
    return findBy_('Visitors', 'id', old.id);
  }
  rec.id = newId_('V');
  rec.status = 'To review';
  rec.createdAt = now_();
  insert_('Visitors', rec);
  return rec;
}

function deleteVisitor(token, id) {
  requireCommittee_(token);
  remove_('Visitors', id);
  return true;
}

function listVisitors(token, filter) {
  var u = user_(token);
  var today = today_();
  var rows = readTable_('Visitors');
  if (u.role === 'staff') rows = rows.filter(function (v) { return v.staffId === u.id; });
  if (filter === 'staying') rows = rows.filter(function (v) {
    return v.status !== 'Left' && v.status !== 'Not approved' && v.arrival <= today && v.leaving >= today;
  });
  if (filter === 'review') rows = rows.filter(function (v) { return v.status === 'To review'; });
  return rows.sort(byCreatedDesc_);
}

function setVisitorStatus(token, id, status, note) {
  var u = user_(token);
  var v = findBy_('Visitors', 'id', id);
  if (!v) throw new Error('Report not found.');
  if (VISITOR_STATUSES.indexOf(status) < 0) throw new Error('Unknown status.');
  if (u.role === 'staff') {
    if (v.staffId !== u.id || status !== 'Left') throw new Error('Only the committee can do this.');
  }
  var patch = { status: status, updatedAt: now_() };
  if (status === 'Left' && v.leaving > today_()) {
    patch.leaving = today_();
    patch.nights = String(nightsBetween_(v.arrival, patch.leaving));
  }
  if (u.role !== 'staff') { patch.reviewedBy = u.name; if (note) patch.reviewNote = trim_(note); }
  update_('Visitors', id, patch);
  return findBy_('Visitors', 'id', id);
}

/* ---------- Disputes ---------- */

function saveDispute(token, data) {
  var u = user_(token);
  required_(data, ['involved', 'kind', 'happenedOn', 'details']);
  var count = readTable_('Disputes').length + 1;
  var rec = {
    id: newId_('D'), caseNo: 'D-' + today_().slice(0, 4) + '-' + ('0' + count).slice(-2),
    reporterId: data.anonymous ? '' : u.id, anonymous: data.anonymous ? 'yes' : 'no',
    involved: trim_(data.involved), kind: trim_(data.kind), happenedOn: data.happenedOn,
    place: trim_(data.place), details: trim_(data.details), wish: trim_(data.wish),
    status: 'Open', meetingDate: '', log: '[]', createdAt: now_(), updatedAt: now_()
  };
  insert_('Disputes', rec);
  return { caseNo: rec.caseNo };
}

function listDisputes(token) {
  var u = user_(token);
  var rows = readTable_('Disputes').sort(byCreatedDesc_);
  if (u.role === 'staff') {
    return rows.filter(function (d) { return d.reporterId === u.id; }).map(function (d) {
      return { id: d.id, caseNo: d.caseNo, kind: d.kind, status: d.status, meetingDate: d.meetingDate, createdAt: d.createdAt };
    });
  }
  return rows.map(disputeSummary_);
}

function getDispute(token, id) {
  requireCommittee_(token);
  var d = findBy_('Disputes', 'id', id);
  if (!d) throw new Error('Case not found.');
  var reporter = d.reporterId ? findBy_('Staff', 'id', d.reporterId) : null;
  d.reporterName = d.anonymous === 'yes' ? 'Anonymous' : (reporter ? reporter.name : d.reporterId);
  d.log = JSON.parse(d.log || '[]');
  return d;
}

function updateDispute(token, id, patch) {
  var u = requireCommittee_(token);
  var d = findBy_('Disputes', 'id', id);
  if (!d) throw new Error('Case not found.');
  var log = JSON.parse(d.log || '[]');
  var change = { updatedAt: now_() };
  var entry = [];
  if (patch.status && patch.status !== d.status) {
    if (DISPUTE_STATUSES.indexOf(patch.status) < 0) throw new Error('Unknown status.');
    change.status = patch.status;
    entry.push('Status: ' + patch.status);
  }
  if (patch.meetingDate !== undefined && patch.meetingDate !== d.meetingDate) {
    change.meetingDate = patch.meetingDate;
    entry.push(patch.meetingDate ? 'Meeting set for ' + patch.meetingDate.split('-').reverse().join('-') : 'Meeting date removed');
  }
  if (patch.note) entry.push(trim_(patch.note));
  if (entry.length) log.push({ at: now_(), by: u.name, text: entry.join('. ') });
  change.log = JSON.stringify(log);
  update_('Disputes', id, change);
  return getDispute(token, id);
}

/* ---------- Party funds ---------- */

function listEvents(token) {
  requireCommittee_(token);
  var totals = fundTotals_();
  return {
    events: readTable_('Events').sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(eventSummary_),
    balance: totals.balance, collected: totals.collected, spent: totals.spent
  };
}

function saveEvent(token, data) {
  var u = requireCommittee_(token);
  required_(data, ['name', 'date']);
  if (data.id) {
    update_('Events', data.id, { name: trim_(data.name), date: data.date, status: data.status || 'Open' });
    return eventSummary_(findBy_('Events', 'id', data.id));
  }
  var rec = { id: newId_('E'), name: trim_(data.name), date: data.date, status: 'Open', createdBy: u.name, createdAt: now_() };
  insert_('Events', rec);
  return eventSummary_(rec);
}

function getEvent(token, id) {
  requireCommittee_(token);
  var e = findBy_('Events', 'id', id);
  if (!e) throw new Error('Event not found.');
  var donations = readTable_('Donations').filter(function (d) { return d.eventId === id; }).sort(byDateDesc_);
  var expenses = readTable_('Expenses').filter(function (x) { return x.eventId === id; }).sort(byDateDesc_)
    .map(function (x) {
      x.items = JSON.parse(x.items || '[]');
      x.photoIds = x.photoIds ? x.photoIds.split(',') : [];
      return x;
    });
  var s = eventSummary_(e);
  s.donations = donations;
  s.expenses = expenses;
  return s;
}

function saveDonation(token, data) {
  var u = requireCommittee_(token);
  required_(data, ['eventId', 'date', 'donor', 'amount']);
  var amount = money_(data.amount);
  if (!(amount > 0)) throw new Error('Amount must be more than 0.');
  var rec = { id: newId_('N'), eventId: data.eventId, date: data.date, donor: trim_(data.donor),
    mode: trim_(data.mode) || 'Cash', amount: String(amount), note: trim_(data.note), addedBy: u.name, createdAt: now_() };
  insert_('Donations', rec);
  return rec;
}

function saveExpense(token, data) {
  var u = requireCommittee_(token);
  required_(data, ['eventId', 'date', 'category', 'paidBy']);
  var items = (data.items || []).map(function (it) {
    var qty = Number(it.qty) || 0, rate = money_(it.rate);
    return { item: trim_(it.item), qty: qty, unit: trim_(it.unit), rate: rate, amount: Math.round(qty * rate * 100) / 100 };
  }).filter(function (it) { return it.item && it.amount > 0; });
  if (!items.length) throw new Error('Add at least one item with an amount.');
  var total = items.reduce(function (n, it) { return n + it.amount; }, 0);
  var photoIds = (data.photos || []).map(function (p, i) {
    return savePhoto_(p, 'Bill ' + data.date + ' ' + data.category + ' ' + (i + 1));
  });
  var rec = { id: newId_('X'), eventId: data.eventId, date: data.date, category: trim_(data.category),
    paidBy: trim_(data.paidBy), description: trim_(data.description), items: JSON.stringify(items),
    total: String(Math.round(total * 100) / 100), photoIds: photoIds.join(','), addedBy: u.name, createdAt: now_() };
  insert_('Expenses', rec);
  return rec;
}

function deleteEntry(token, kind, id) {
  requireCommittee_(token);
  var table = kind === 'donation' ? 'Donations' : kind === 'expense' ? 'Expenses' : null;
  if (!table) throw new Error('Unknown entry.');
  remove_(table, id);
  return true;
}

function getPhoto(token, fileId) {
  user_(token);
  var file = DriveApp.getFileById(fileId);
  var folderId = getSettings_().photoFolderId;
  var parents = file.getParents();
  var inFolder = false;
  while (parents.hasNext()) { if (parents.next().getId() === folderId) inFolder = true; }
  if (!inFolder) throw new Error('Photo not found.');
  var blob = file.getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

/* ---------- Reports ---------- */

// Everything the Reports page prints, for one date range (yyyy-MM-dd, both days included).
function reportData(token, from, to) {
  requireCommittee_(token);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to))) throw new Error('Choose both dates.');
  if (to < from) throw new Error('The end date is before the start date.');
  var inRange = function (dt) { dt = String(dt).slice(0, 10); return dt >= from && dt <= to; };
  var names = {};
  readTable_('Events').forEach(function (e) { names[e.id] = e.name + ' (' + e.date.split('-').reverse().join('-') + ')'; });
  var visitors = readTable_('Visitors').filter(function (v) { return v.arrival <= to && v.leaving >= from; })
    .sort(function (a, b) { return a.arrival === b.arrival ? (a.quarter < b.quarter ? -1 : 1) : (a.arrival < b.arrival ? -1 : 1); });
  var disputes = readTable_('Disputes').filter(function (d) { return inRange(d.happenedOn) || inRange(d.createdAt); })
    .sort(function (a, b) { return a.caseNo < b.caseNo ? -1 : 1; })
    .map(function (d) { var o = disputeSummary_(d); o.involved = d.involved; o.wish = d.wish; o.anonymous = d.anonymous; return o; });
  var donations = readTable_('Donations').filter(function (n) { return inRange(n.date); })
    .map(function (n) { n.event = names[n.eventId] || ''; n.amount = money_(n.amount); return n; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  var expenses = readTable_('Expenses').filter(function (x) { return inRange(x.date); })
    .map(function (x) {
      return { id: x.id, date: x.date, eventId: x.eventId, event: names[x.eventId] || '', category: x.category, paidBy: x.paidBy,
        description: x.description, items: JSON.parse(x.items || '[]'), bills: x.photoIds ? x.photoIds.split(',').length : 0, total: money_(x.total) };
    })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return { from: from, to: to, today: today_(), visitors: visitors, disputes: disputes, donations: donations, expenses: expenses };
}

/* ---------- Staff and settings (admin) ---------- */

function listStaff(token) {
  requireAdmin_(token);
  return readTable_('Staff').map(publicUser_);
}

function saveStaff(token, data) {
  requireAdmin_(token);
  var id = String(data.id || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,30}$/.test(id)) throw new Error('Staff ID: 2 to 30 letters or numbers, no spaces.');
  required_(data, ['name']);
  var role = ['staff', 'committee', 'admin'].indexOf(data.role) >= 0 ? data.role : 'staff';
  var existing = findBy_('Staff', 'id', id);
  if (existing && !data.editing) throw new Error('That staff ID is already used.');
  if (existing) {
    update_('Staff', id, { name: trim_(data.name), quarter: trim_(data.quarter), role: role, active: data.active === 'no' ? 'no' : 'yes' });
    return { user: publicUser_(findBy_('Staff', 'id', id)) };
  }
  var pin = String(Math.floor(1000 + Math.random() * 9000));
  var salt = Utilities.getUuid();
  insert_('Staff', { id: id, name: trim_(data.name), quarter: trim_(data.quarter), role: role,
    pinHash: hash_(pin, salt), salt: salt, mustChange: 'yes', active: 'yes', createdAt: now_() });
  return { user: publicUser_(findBy_('Staff', 'id', id)), pin: pin };
}

function resetPin(token, id) {
  requireAdmin_(token);
  if (!findBy_('Staff', 'id', id)) throw new Error('Staff not found.');
  var pin = String(Math.floor(1000 + Math.random() * 9000));
  var salt = Utilities.getUuid();
  update_('Staff', id, { pinHash: hash_(pin, salt), salt: salt, mustChange: 'yes' });
  return { pin: pin };
}

function saveSettings(token, data) {
  requireAdmin_(token);
  if (data.longStayNights !== undefined) setSetting_('longStayNights', String(Math.max(1, Number(data.longStayNights) || 7)));
  if (data.expenseCategories !== undefined) {
    setSetting_('expenseCategories', data.expenseCategories.map(trim_).filter(String).join(','));
  }
  if (data.committeeName !== undefined) setSetting_('committeeName', trim_(data.committeeName) || DEFAULT_SETTINGS.committeeName);
  if (data.schoolName !== undefined) setSetting_('schoolName', trim_(data.schoolName) || DEFAULT_SETTINGS.schoolName);
  if (data.logo !== undefined) {
    var logo = String(data.logo || '');
    // A Google Sheets cell holds 50,000 characters, so the logo is kept small.
    if (logo && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(logo) || logo.length > 45000)) throw new Error('The logo must be a small picture.');
    setSetting_('logo', logo);
  }
  return bootstrap(token).settings;
}

/* ---------- Helpers ---------- */

function user_(token) {
  var id = token ? CacheService.getScriptCache().get('sess_' + token) : null;
  if (!id) throw new Error('SESSION_EXPIRED');
  var s = findBy_('Staff', 'id', id);
  if (!s || s.active !== 'yes') throw new Error('SESSION_EXPIRED');
  return s;
}

function requireCommittee_(token) {
  var u = user_(token);
  if (u.role === 'staff') throw new Error('Only committee members can see this.');
  return u;
}

function requireAdmin_(token) {
  var u = user_(token);
  if (u.role !== 'admin') throw new Error('Only the admin can do this.');
  return u;
}

function staffByName_(name) {
  var n = trim_(name).toLowerCase();
  if (!n) return null;
  return readTable_('Staff').filter(function (s) { return s.name.trim().toLowerCase() === n; })[0] || null;
}

// Staff names for the name box: the staff list, plus names typed in earlier visitor reports.
function knownNames_(staffList) {
  var byName = {};
  staffList.forEach(function (s) { byName[s.name.toLowerCase()] = { name: s.name, quarter: s.quarter }; });
  readTable_('Visitors').sort(byCreatedDesc_).forEach(function (v) {
    var k = String(v.staffName || '').toLowerCase();
    if (k && !byName[k]) byName[k] = { name: v.staffName, quarter: v.quarter };
  });
  return Object.keys(byName).sort().map(function (k) { return byName[k]; });
}

function publicUser_(s) {
  return { id: s.id, name: s.name, quarter: s.quarter, role: s.role, mustChange: s.mustChange === 'yes', active: s.active };
}

function fundTotals_() {
  var collected = readTable_('Donations').reduce(function (n, d) { return n + money_(d.amount); }, 0);
  var spent = readTable_('Expenses').reduce(function (n, x) { return n + money_(x.total); }, 0);
  return { collected: collected, spent: spent, balance: collected - spent };
}

function eventSummary_(e) {
  var donations = readTable_('Donations').filter(function (d) { return d.eventId === e.id; });
  var expenses = readTable_('Expenses').filter(function (x) { return x.eventId === e.id; });
  var collected = donations.reduce(function (n, d) { return n + money_(d.amount); }, 0);
  var spent = expenses.reduce(function (n, x) { return n + money_(x.total); }, 0);
  return { id: e.id, name: e.name, date: e.date, status: e.status, collected: collected, spent: spent,
    balance: collected - spent, donationCount: donations.length, expenseCount: expenses.length,
    expensesWithBills: expenses.filter(function (x) { return x.photoIds; }).length };
}

function disputeSummary_(d) {
  return { id: d.id, caseNo: d.caseNo, kind: d.kind, involved: d.involved, place: d.place, status: d.status,
    meetingDate: d.meetingDate, happenedOn: d.happenedOn, createdAt: d.createdAt };
}

function savePhoto_(dataUrl, name) {
  var m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl));
  if (!m) throw new Error('Photo must be a JPEG, PNG or WebP image.');
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 5 * 1024 * 1024) throw new Error('Photo is too large (5 MB at most).');
  var folder = DriveApp.getFolderById(getSettings_().photoFolderId);
  var ext = m[1] === 'image/png' ? '.png' : m[1] === 'image/webp' ? '.webp' : '.jpg';
  return folder.createFile(Utilities.newBlob(bytes, m[1], name + ext)).getId();
}

function getSettings_() {
  var out = {};
  readTable_('Settings').forEach(function (r) { out[r.key] = r.value; });
  return out;
}

function setSetting_(key, value) {
  var sh = sheet_('Settings');
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === key) { sh.getRange(i + 1, 2).setValue(value); return; }
  }
  sh.appendRow([key, value]);
}

function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" is missing. Run setup() from the script editor.');
  return sh;
}

function readTable_(name) {
  var values = sheet_(name).getDataRange().getValues();
  var head = SCHEMA[name];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    if (values[i].join('') === '') continue;
    var o = {};
    for (var c = 0; c < head.length; c++) o[head[c]] = cell_(values[i][c]);
    out.push(o);
  }
  return out;
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}

function insert_(name, obj) {
  withLock_(function () {
    sheet_(name).appendRow(SCHEMA[name].map(function (k) { return obj[k] === undefined ? '' : String(obj[k]); }));
  });
}

function update_(name, id, patch) {
  withLock_(function () {
    var sh = sheet_(name);
    var head = SCHEMA[name];
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(id)) {
        var row = values[i].map(cell_);
        Object.keys(patch).forEach(function (k) {
          var c = head.indexOf(k);
          if (c >= 0) row[c] = patch[k] === undefined || patch[k] === null ? '' : String(patch[k]);
        });
        while (row.length < head.length) row.push('');
        sh.getRange(i + 1, 1, 1, head.length).setValues([row.slice(0, head.length)]);
        return;
      }
    }
    throw new Error('Record not found.');
  });
}

function remove_(name, id) {
  withLock_(function () {
    var sh = sheet_(name);
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(id)) { sh.deleteRow(i + 1); return; }
    }
    throw new Error('Record not found.');
  });
}

function findBy_(name, key, value) {
  var rows = readTable_(name);
  for (var i = 0; i < rows.length; i++) if (rows[i][key] === String(value)) return rows[i];
  return null;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { fn(); } finally { lock.releaseLock(); }
}

function hash_(pin, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function required_(data, keys) {
  keys.forEach(function (k) {
    if (data[k] === undefined || data[k] === null || String(data[k]).trim() === '') {
      throw new Error('Please fill in: ' + k.replace(/([A-Z])/g, ' $1').toLowerCase());
    }
  });
}

function nightsBetween_(a, b) {
  var d1 = new Date(a + 'T00:00:00Z'), d2 = new Date(b + 'T00:00:00Z');
  return Math.max(0, Math.round((d2 - d1) / 86400000));
}

function money_(v) {
  var n = Number(String(v === undefined ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function trim_(v) { return v === undefined || v === null ? '' : String(v).trim(); }
function newId_(prefix) { return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function now_() { return new Date().toISOString(); }
function today_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function byCreatedDesc_(a, b) { return a.createdAt < b.createdAt ? 1 : -1; }
function byDateDesc_(a, b) { return a.date === b.date ? byCreatedDesc_(a, b) : (a.date < b.date ? 1 : -1); }
