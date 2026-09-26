/* Read-only drilldowns for the overview. Data stays in the console's current
   snapshot; opening a detail never writes a record or starts another fetch. */
(function () {
  'use strict';

  var dialog, body, title, current, opener, navigating = false;
  var kinds = ['attendance', 'commits', 'subscription', 'quiet', 'attention'];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c];
    });
  }
  function list(value) { return Array.isArray(value) ? value : []; }
  function amount(value) {
    return (Number(value) || 0).toLocaleString('en-US', {style:'currency', currency:'USD'});
  }
  function dateLabel(value) {
    var valueString = String(value || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valueString)) return valueString || 'No date recorded';
    var date = new Date(valueString + 'T12:00:00Z');
    return Number.isNaN(date.getTime()) ? valueString : date.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'UTC'});
  }
  function stamp(value) {
    var date = new Date(value);
    return !value || Number.isNaN(date.getTime()) ? 'Time not recorded' : date.toLocaleString();
  }
  function personLink(who) {
    return '<a href="#/person/' + encodeURIComponent(who) + '">' + esc(who) + '</a>';
  }
  function note(value) { return '<p class="ov-detail-note">' + esc(value) + '</p>'; }
  function empty(value) { return '<div class="ov-detail-empty">' + esc(value) + '</div>'; }
  function footer(href, label, resetLedger) {
    return '<div class="ov-detail-footer"><a class="mini" href="' + href + '"' + (resetLedger ? ' data-ledger-query=""' : '') + '>' + esc(label) + ' →</a></div>';
  }
  function facts(entries) {
    return '<dl class="ov-detail-facts">' + entries.map(function (entry) {
      return '<div><dt>' + esc(entry[0]) + '</dt><dd>' + esc(entry[1]) + '</dd></div>';
    }).join('') + '</dl>';
  }
  function readSnapshot() {
    return window.FOMO_OVERVIEW && typeof window.FOMO_OVERVIEW.snapshot === 'function'
      ? window.FOMO_OVERVIEW.snapshot() : null;
  }

  function attendance(data, selected) {
    var rows = list(data.days).filter(function (day) {
      return (!selected.who || day.who === selected.who) &&
        (!selected.date || day.day === selected.date) &&
        (selected.period !== 'week' || day.day >= data.weekStart);
    }).slice().sort(function (a, b) {
      return String(b.day).localeCompare(String(a.day)) || String(a.who).localeCompare(String(b.who));
    });
    var heading = selected.who ? selected.who + ' · attendance' : 'Attendance';
    var range = selected.date ? dateLabel(selected.date) : selected.period === 'week'
      ? 'Since Monday, ' + dateLabel(data.weekStart) : 'All recorded days';
    var html = note(range + ' · ' + rows.length + (rows.length === 1 ? ' person-day' : ' person-days'));
    html += note('Attendance records days, not hours. ' + (data.attendanceSource === 'sheet'
      ? 'These records come from the shared sheet.' : data.attendanceSource === 'device'
        ? 'These records are kept in this browser only.' : 'Showing the attendance currently loaded in the console.'));
    html += rows.length ? '<ul class="ov-detail-list">' + rows.map(function (day) {
      return '<li><div><b>' + personLink(day.who) + '</b><span>' + esc(dateLabel(day.day)) +
        '</span></div><small>Recorded ' + esc(stamp(day.marked)) + '</small></li>';
    }).join('') + '</ul>' : empty('No attendance days are recorded for this selection.');
    return {title:heading, html:html + footer('#/attendance', 'Open attendance')};
  }

  function githubUrl(value) {
    try {
      var url = new URL(String(value || ''));
      return url.protocol === 'https:' && url.hostname.toLowerCase() === 'github.com' && !url.username && !url.password && !url.port ? url.href : '';
    } catch (error) { return ''; }
  }
  function commits(data, selected) {
    var people = selected.who ? [selected.who] : list(data.ghPeople || data.people);
    var from = selected.date || (selected.period === 'week' ? data.weekStart : data.since);
    var to = selected.date || data.today;
    var html = note((selected.date ? dateLabel(selected.date) : dateLabel(from) + ' – ' + dateLabel(to)) + ' · UTC');
    if (data.ghBusy) html += note('GitHub activity is refreshing. These details update when it finishes.');
    html += people.length ? '<div class="ov-detail-people">' + people.map(function (who) {
      var got = (data.ghData || {})[who], error = (data.ghErrors || {})[who];
      var logins = String((data.logins || {})[who] || '').split(/[,\s]+/).filter(Boolean);
      var summary = '', detail = '';
      if (!logins.length) summary = 'No GitHub account linked.';
      else if (error) summary = 'GitHub activity unavailable: ' + error;
      else if (!got) summary = data.ghBusy ? 'Loading GitHub activity…' : 'GitHub activity is not available yet.';
      else if (!got.days || typeof got.days !== 'object') summary = 'Commit counts were not included in this result.';
      else {
        var availableFrom = got.from || data.since, availableTo = got.through || data.today;
        if (to < availableFrom || from > availableTo) {
          summary = 'This selection is outside the loaded activity range.';
        } else {
          var partialRange = from < availableFrom || to > availableTo;
          var count = 0;
          var byDay = got.commitsByDay || {};
          var dates = Object.keys(got.days).concat(Object.keys(byDay)).filter(function (day, index, all) {
            return all.indexOf(day) === index && day >= from && day <= to && day >= availableFrom && day <= availableTo;
          }).sort().reverse();
          dates.forEach(function (day) { count += Number(got.days[day]) || 0; });
          summary = count ? count + (got.truncated ? '+' : '') + (count === 1 && !got.truncated ? ' public commit' : ' public commits')
            : got.truncated || partialRange ? 'No commits returned in this partial result.' : 'No public commits returned for this selection.';
          if (got.truncated) detail += note('Partial result: GitHub’s read limit was reached. Counts are a minimum.');
          if (partialRange) detail += note('Only ' + dateLabel(availableFrom) + ' – ' + dateLabel(availableTo) + ' is loaded. Dates outside that range are unavailable.');
          var entriesShown = 0;
          dates.forEach(function (day) {
            var dayCount = Number(got.days[day]) || 0;
            var entries = list(byDay[day]);
            if (!dayCount && !entries.length) return;
            var items = entries.map(function (commit) {
              var url = githubUrl(commit.url);
              if (!url) return '';
              entriesShown++;
              var commitDate = new Date(commit.date);
              var time = !commit.date || Number.isNaN(commitDate.getTime()) ? '' : commitDate.toISOString().slice(11, 16) + ' UTC';
              return '<li><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
                esc(commit.message || String(commit.sha || '').slice(0, 7) || 'Open commit') + '</a><small>' +
                esc([commit.repo, time].filter(Boolean).join(' · ')) + '</small></li>';
            }).join('');
            detail += '<section class="ov-detail-commit-day"><h4>' + esc(dateLabel(day)) + ' <span>' +
              dayCount + (dayCount === 1 ? ' commit' : ' commits') + '</span></h4>' +
              (items ? '<ul class="ov-detail-commits">' + items + '</ul>' : note('Commit links were not included in this result.')) + '</section>';
          });
          if (count > entriesShown) detail += note(entriesShown ? 'Showing ' + entriesShown + ' of ' + count + (got.truncated ? '+' : '') + ' commits. Only the available commit links are included.' : 'Commit details were not included in this cached result.');
          if (!count && got.calendar && Number(got.calendar.total) > 0) detail += note('GitHub’s contribution calendar also includes issues, pull requests, reviews, and some private activity. Those contributions are separate from the public commits shown here.');
        }
      }
      var profiles = logins.map(function (login) {
        return '<a href="https://github.com/' + encodeURIComponent(login) + '" target="_blank" rel="noopener noreferrer">@' + esc(login) + ' ↗</a>';
      }).join(' · ');
      return '<article class="ov-detail-person"><h3>' + personLink(who) + '</h3><p class="ov-detail-summary">' + esc(summary) + '</p>' +
        detail + (profiles ? '<div class="ov-detail-profiles">' + profiles + '</div>' : '') + '</article>';
    }).join('') + '</div>' : empty('No people are available in the current roster.');
    html += note('These are public commits in each person’s own repositories. Private work and commits to other people’s repositories are not included.');
    return {title:(selected.who ? selected.who + ' · ' : '') + 'GitHub activity', html:html + footer('#/commits', 'Open commits')};
  }

  function subscription(data, selected) {
    var rule = list(data.subs).find(function (row) { return String(row.id) === selected.id; });
    if (!rule) return {title:'Recurring spend', html:empty('This recurring rule is no longer in the loaded records.') + footer('#/subs', 'Open recurring spend')};
    var entries = [
      ['Amount', amount(rule.amount) + ' per month'], ['Paid by', rule.who || 'Not recorded'],
      ['Status', String(rule.active) === 'no' ? 'Paused' : 'Active'],
      ['Billing day', rule.day ? 'Day ' + rule.day + ' of each month' : 'Not recorded'],
      ['Next charge', rule.next ? dateLabel(rule.next) : 'Not recorded'],
      ['Category', typeof data.categoryLabel === 'function' ? data.categoryLabel(rule.category) : rule.category || 'Not recorded']
    ];
    if (rule.last) entries.push(['Last processed charge', dateLabel(rule.last)]);
    if (rule.created) entries.push(['Created', stamp(rule.created)]);
    if (rule.shared) entries.push(['Shared with', Array.isArray(rule.shared) ? rule.shared.join(', ') : rule.shared]);
    var html = facts(entries);
    if (rule.note) html += '<section class="ov-detail-section"><h3>Note</h3><p class="ov-detail-user-note">' + esc(rule.note) + '</p></section>';
    var related = list(data.rows).filter(function (row) { return row.sub_id != null && String(row.sub_id) === String(rule.id); })
      .slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    if (related.length) html += '<section class="ov-detail-section"><h3>Linked charges</h3><ul class="ov-detail-list">' + related.map(function (row) {
      return '<li><a href="#/charge/' + encodeURIComponent(row.id) + '"><b>' + esc(row.what || 'Recurring charge') + '</b><span>' + esc(dateLabel(row.date)) + ' · ' + esc(row.who) + '</span></a><strong>' + esc(amount(row.amount)) + '</strong></li>';
    }).join('') + '</ul></section>';
    return {title:rule.what || 'Recurring spend', html:html + footer('#/subs', 'Open recurring spend')};
  }

  function quiet(data) {
    var rows = list(data.quiet), skipped = list(data.skipped);
    var html = note('Spend days with fewer than four public commits in the loaded activity window. This is a prompt to look closer, not a measure of all work.');
    html += rows.length ? '<ul class="ov-detail-list ov-detail-quiet">' + rows.map(function (row) {
      return '<li><div><b>' + personLink(row.who) + '</b><span>' + esc(dateLabel(row.day)) + '</span></div><div class="ov-detail-row-actions">' +
        '<button type="button" class="mini" data-ledger-date="' + esc(row.day) + '" data-ledger-who="' + esc(row.who) + '">' + esc(amount(row.spend)) + ' · ' + esc(row.lines) + (row.lines === 1 ? ' charge' : ' charges') + '</button>' +
        '<button type="button" class="mini ghost" data-ov-detail="commits" data-detail-date="' + esc(row.day) + '" data-detail-who="' + esc(row.who) + '">' + esc(row.commits) + (row.commits === 1 ? ' commit' : ' commits') + '</button></div></li>';
    }).join('') + '</ul>' : empty('No spend days meet this threshold in the available records.');
    if (skipped.length) html += note('Not counted for ' + skipped.join(', ') + ': no linked account, no completed read, or a partial GitHub result. Missing data is not a zero.');
    html += note('Private work, unpushed changes, and other kinds of work are not represented by these commit counts.');
    return {title:'Quiet days with a spend', html:html + footer('#/ledger', 'Open ledger', true)};
  }

  function render() {
    var data = readSnapshot();
    if (!data || !current) return false;
    var output;
    if (current.kind === 'attendance') output = attendance(data, current);
    else if (current.kind === 'commits') output = commits(data, current);
    else if (current.kind === 'subscription') output = subscription(data, current);
    else if (current.kind === 'quiet') output = quiet(data);
    else output = {title:'Needs attention', html:'<div class="ov-detail-attention">' + (data.attention || empty('Nothing needs attention in the current records.')) + '</div>'};
    title.textContent = output.title;
    body.innerHTML = output.html;
    return true;
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'ov-details';
    dialog.className = 'ov-details';
    dialog.setAttribute('aria-labelledby', 'ov-details-title');
    dialog.innerHTML = '<header class="ov-detail-header"><div><span class="ov-detail-eyebrow">Overview details</span><h2 id="ov-details-title"></h2></div><button type="button" class="mini ghost" data-ov-close autofocus aria-label="Close details">Close ×</button></header><div class="ov-detail-body"></div>';
    (document.getElementById('app') || document.body).appendChild(dialog);
    body = dialog.querySelector('.ov-detail-body');
    title = dialog.querySelector('h2');
    dialog.addEventListener('click', function (event) {
      var control = event.target.closest('a[href^="#/"], [data-go2], [data-review], [data-ledger-date], [data-ledger-who], [data-ledger-cat], [data-ledger-cats], [data-ledger-status], [data-ledger-query]');
      if (control) { navigating = true; dialog.close(); return; }
      if (event.target.closest('[data-ov-close]')) { dialog.close(); return; }
      if (event.target === dialog) {
        var rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      }
    });
    dialog.addEventListener('close', function () {
      current = null;
      document.documentElement.classList.remove('ov-detail-open');
      if (!navigating && opener) {
        var restore = opener.isConnected ? opener : Array.prototype.find.call(document.querySelectorAll('[data-ov-detail]'), function (control) {
          return !dialog.contains(control) && ['ovDetail', 'detailWho', 'detailDate', 'detailId', 'detailPeriod'].every(function (key) {
            return (control.dataset[key] || '') === (opener.dataset[key] || '');
          });
        });
        if (restore) restore.focus({preventScroll:true});
      }
      navigating = false;
      opener = null;
    });
  }

  document.addEventListener('click', function (event) {
    var control = event.target.closest('[data-ov-detail]');
    if (!control || kinds.indexOf(control.dataset.ovDetail) === -1 || !readSnapshot()) return;
    event.preventDefault();
    event.stopPropagation();
    ensureDialog();
    if (!dialog.open) opener = control;
    current = {kind:control.dataset.ovDetail, who:control.dataset.detailWho || '', date:control.dataset.detailDate || '', period:control.dataset.detailPeriod || 'all', id:control.dataset.detailId || ''};
    if (!render()) return;
    body.scrollTop = 0;
    if (!dialog.open) dialog.showModal();
    else dialog.querySelector('[data-ov-close]').focus({preventScroll:true});
    document.documentElement.classList.add('ov-detail-open');
  }, true);

  window.addEventListener('fomo:overview-updated', function () {
    if (!dialog || !dialog.open || !current) return;
    var scroll = body.scrollTop, focused = document.activeElement;
    var hadFocus = body.contains(focused);
    var focusKey = hadFocus ? focused.outerHTML : '';
    if (render()) {
      body.scrollTop = scroll;
      if (hadFocus) {
        var next = Array.prototype.find.call(body.querySelectorAll('a,button'), function (control) { return control.outerHTML === focusKey; });
        (next || dialog.querySelector('[data-ov-close]')).focus({preventScroll:true});
      }
    }
  });

  window.addEventListener('hashchange', function () {
    if (dialog && dialog.open) { navigating = true; dialog.close(); }
  });
}());
