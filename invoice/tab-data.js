/* Session-only transport for internal tabs. Warm snapshots are consumed once. */
(function (root) {
  'use strict';
  root.createInternalTabData = function (options) {
    var fetchRequest = options.fetch || root.fetch.bind(root);
    var session = options.session || function () { return ''; };
    var operator = options.operator || function () { return false; };
    var warmApis = new Set(['beta', 'visits', 'refer', 'admin', 'schedules', 'posts', 'campus']);
    var restrictedApis = new Set(['beta', 'refer', 'admin']);
    var flights = new Map(), cache = new Map(), revisions = new Map();
    var queue = [], active = new Set(), scheduled = false, epoch = 0;
    var currentSession = session();

    function error(code, message) {
      var result = new Error(message);
      result.code = code;
      return result;
    }
    function stale() { return error('STALE', 'This request is no longer current.'); }
    function revision(api) { return revisions.get(api) || 0; }
    function valid(record) {
      return !record.settled && record.epoch === epoch && record.revision === revision(record.api) &&
        record.session === session() && !!record.session;
    }
    function mayWarm(api, token) {
      return !!token && warmApis.has(api) && (!restrictedApis.has(api) || operator());
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(function () {
        scheduled = false;
        syncSession();
        if (active.size) return;
        while (queue.length) {
          var record = queue.shift();
          if (record.settled || record.started) continue;
          if (!valid(record) || !mayWarm(record.api, currentSession)) {
            finish(record, stale());
            continue;
          }
          start(record);
          break;
        }
      });
    }
    function finish(record, failure, output) {
      if (record.settled) return;
      record.settled = true;
      clearTimeout(record.timer);
      active.delete(record);
      if (flights.get(record.key) === record) flights.delete(record.key);
      if (failure) record.reject(failure);
      else record.resolve(output);
      schedule();
    }
    function cancel(record) {
      finish(record, stale());
      if (record.controller) record.controller.abort();
    }
    function reset() {
      epoch++;
      cache.clear();
      queue = [];
      Array.from(flights.values()).forEach(cancel);
      revisions.clear();
    }
    function syncSession() {
      var token = session();
      if (token !== currentSession) {
        currentSession = token;
        reset();
      }
      return token;
    }
    function requestKey(api, action, payload) {
      return JSON.stringify([api, action, payload], function (_key, value) {
        if (value && Object.prototype.toString.call(value) === '[object Object]') {
          var sorted = {};
          Object.keys(value).sort().forEach(function (key) { sorted[key] = value[key]; });
          return sorted;
        }
        return value;
      });
    }
    function create(api, action, payload, key, token) {
      var record = {api: api, action: action, payload: payload, key: key, session: token,
        epoch: epoch, revision: revision(api), foreground: false, warm: false, started: false, settled: false};
      record.promise = new Promise(function (resolve, reject) { record.resolve = resolve; record.reject = reject; });
      flights.set(key, record);
      return record;
    }
    function start(record) {
      if (record.started || record.settled) return;
      if (!valid(record)) { finish(record, stale()); return; }
      record.started = true;
      active.add(record);
      record.controller = new AbortController();
      record.timer = setTimeout(function () {
        finish(record, valid(record) ? error('TIMEOUT', 'Request timed out. Please try again.') : stale());
        record.controller.abort();
      }, 20000);
      (async function () {
        try {
          var body = Object.assign({}, record.payload, {_api: record.api, _key: options.key || '',
            _session: record.session, action: record.action});
          var visiting = record.api === 'visits';
          if (visiting && record.action !== 'list') throw error('INVALID', 'Only the visit list can be preloaded.');
          var response = await fetchRequest(visiting ? '/api/visits?action=list' : options.endpoint, visiting ? {
            method:'GET', credentials:'same-origin', cache:'no-store',
            headers:{'X-Fomo-Internal-Session':record.session}, signal:record.controller.signal
          } : {method: 'POST', body: JSON.stringify(body), signal: record.controller.signal});
          if (!response.ok) {
            var failure = error('HTTP_ERROR', 'Request failed (' + response.status + ').');
            failure.status = response.status;
            if (visiting) {
              var refused = await response.json().catch(function(){return {};});
              failure.message = refused && typeof refused.error === 'string' && refused.error || 'Visit requests could not be loaded. Please try again.';
            }
            throw failure;
          }
          var output = await response.json();
          if (!valid(record)) throw stale();
          if (visiting && !Array.isArray(output && output.requests)) throw error('INVALID', 'Visit requests could not be loaded.');
          if (record.warm && !record.foreground && mayWarm(record.api, record.session) && output && (output.ok === true || visiting)) {
            cache.set(record.key, {api: record.api, output: output, expires: Date.now() + 60000});
          }
          finish(record, null, output);
        } catch (failure) {
          finish(record, valid(record) ? failure : stale());
        }
      })();
    }
    function read(api, action, payload, settings) {
      action = action || 'list';
      payload = payload || {};
      settings = settings || {};
      var token = syncSession();
      if (!token) return Promise.reject(error('AUTH_REQUIRED', 'Sign in to load this tab.'));
      var key;
      try { key = requestKey(api, action, payload); }
      catch (failure) { return Promise.reject(failure); }
      var snapshot = cache.get(key);
      cache.delete(key);
      if (!settings.fresh && snapshot && snapshot.expires > Date.now() && mayWarm(api, token)) {
        var snapshotEpoch = epoch, snapshotRevision = revision(api);
        return Promise.resolve().then(function () {
          if (session() !== token || epoch !== snapshotEpoch || revision(api) !== snapshotRevision || !mayWarm(api, token)) throw stale();
          return snapshot.output;
        });
      }
      var record = flights.get(key) || create(api, action, payload, key, token);
      record.foreground = true;
      // A requested tab immediately promotes its queued warm read.
      start(record);
      return record.promise;
    }
    function warm(api) {
      var token = syncSession();
      if (!mayWarm(api, token)) return Promise.resolve();
      var key = requestKey(api, 'list', {}), snapshot = cache.get(key);
      if (snapshot && snapshot.expires > Date.now()) return Promise.resolve(snapshot.output);
      cache.delete(key);
      var record = flights.get(key) || create(api, 'list', {}, key, token);
      if (!record.warm) {
        record.warm = true;
        if (!record.started) queue.push(record);
      }
      schedule();
      // Speculation is best effort; foreground callers still receive failures.
      return record.promise.catch(function () {});
    }
    function invalidate(api) {
      syncSession();
      revisions.set(api, revision(api) + 1);
      cache.forEach(function (snapshot, key) { if (snapshot.api === api) cache.delete(key); });
      Array.from(flights.values()).forEach(function (record) { if (record.api === api) cancel(record); });
      queue = queue.filter(function (record) { return record.api !== api; });
    }
    function clear() { currentSession = session(); reset(); }
    return {read: read, warm: warm, invalidate: invalidate, clear: clear};
  };
})(typeof window === 'undefined' ? globalThis : window);
